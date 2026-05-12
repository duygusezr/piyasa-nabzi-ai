"""
Market History Service — Gerçek OHLCV (mum grafik) verisi
- Kripto (BTC, ETH, SOL, BNB, XRP, PAXG): Binance klines API (ücretsiz, key gerektirmez)
- Hisse/Endeks/Emtia/Döviz: Yahoo Finance chart API
- In-memory TTL cache ile gereksiz API çağrıları engellenir
"""
import logging
import time as _time
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

# ── Modül-seviyesi USD/TRY kuru (market-data endpointinden güncellenir) ──────────
_usd_try_rate: float = 38.0

def set_usd_try_rate(rate: float) -> None:
    global _usd_try_rate
    if rate and rate > 0:
        _usd_try_rate = rate

def get_usd_try_rate() -> float:
    return _usd_try_rate


# ── Periyot → API parametresi eşlemesi ───────────────────────────────────────────

_BINANCE_PARAMS: dict[str, tuple[str, int]] = {
    "1D": ("15m",  96),   # 24 saat × 4 = 96 mum
    "1W": ("1h",  168),   # 7 gün × 24 = 168 mum
    "1M": ("1d",   30),
    "3M": ("1d",   90),
    "1Y": ("1w",   52),
}

_YAHOO_PARAMS: dict[str, tuple[str, str]] = {
    "1D": ("15m",  "1d"),
    "1W": ("60m",  "5d"),
    "1M": ("1d",  "1mo"),
    "3M": ("1d",  "3mo"),
    "1Y": ("1wk", "1y"),
}

# Kripto sembolleri → Binance USDT çifti
_CRYPTO_MAP: dict[str, str] = {
    "BTC":  "BTCUSDT",
    "ETH":  "ETHUSDT",
    "SOL":  "SOLUSDT",
    "BNB":  "BNBUSDT",
    "XRP":  "XRPUSDT",
    "PAXG": "PAXGUSDT",
}

# Diğer semboller → Yahoo Finance sembolü
_YAHOO_MAP: dict[str, str] = {
    "XAU":    "GC=F",
    "USDTRY": "USDTRY=X",
    "EURTRY": "EURTRY=X",
    "XU100":  "XU100.IS",
    "XU030":  "XU030.IS",
    "ASELS":  "ASELS.IS",
    "THYAO":  "THYAO.IS",
    "GARAN":  "GARAN.IS",
    "AKBNK":  "AKBNK.IS",
    "KCHOL":  "KCHOL.IS",
    "TUPRS":  "TUPRS.IS",
    "SISE":   "SISE.IS",
    "BIMAS":  "BIMAS.IS",
    "FROTO":  "FROTO.IS",
    "EREGL":  "EREGL.IS",
}

# ── TTL cache ─────────────────────────────────────────────────────────────────────
_cache: dict[str, tuple[float, list]] = {}
_CACHE_TTL: dict[str, int] = {
    "1D":  300,    # 5 dakika
    "1W":  1800,   # 30 dakika
    "1M":  3600,   # 1 saat
    "3M":  7200,   # 2 saat
    "1Y":  10800,  # 3 saat
}


def _cache_get(symbol: str, period: str) -> Optional[list]:
    key = f"{symbol}:{period}"
    entry = _cache.get(key)
    if entry:
        ts, data = entry
        if _time.time() - ts < _CACHE_TTL.get(period, 3600):
            return data
    return None


def _cache_set(symbol: str, period: str, data: list) -> None:
    _cache[f"{symbol}:{period}"] = (_time.time(), data)


# ── Binance ───────────────────────────────────────────────────────────────────────

async def _fetch_binance(binance_symbol: str, period: str) -> list[dict]:
    """Binance klines API'den OHLCV çeker. USDT fiyatlar TRY'ye çevrilir."""
    interval, limit = _BINANCE_PARAMS.get(period, ("1d", 30))
    usd_try = _usd_try_rate

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://api.binance.com/api/v3/klines",
                params={"symbol": binance_symbol, "interval": interval, "limit": limit},
            )
            resp.raise_for_status()
            raw: list = resp.json()
    except Exception as exc:
        logger.warning("[history:binance] %s/%s çekilemedi: %s", binance_symbol, period, exc)
        return []

    candles = []
    for k in raw:
        o, h, l, c, v = float(k[1]), float(k[2]), float(k[3]), float(k[4]), float(k[5])
        candles.append({
            "time":   int(k[0]) // 1000,      # ms → saniye
            "open":   round(o * usd_try, 2),
            "high":   round(h * usd_try, 2),
            "low":    round(l * usd_try, 2),
            "close":  round(c * usd_try, 2),
            "volume": round(v, 6),
        })

    logger.info("[history:binance] %s %s → %d mum", binance_symbol, period, len(candles))
    return candles


# ── Yahoo Finance ─────────────────────────────────────────────────────────────────

_YAHOO_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "tr-TR,tr;q=0.9",
}


async def _fetch_yahoo(yahoo_symbol: str, period: str) -> list[dict]:
    """Yahoo Finance chart API'den OHLCV çeker."""
    interval, range_ = _YAHOO_PARAMS.get(period, ("1d", "1mo"))
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                url,
                params={"range": range_, "interval": interval, "events": "div,split"},
                headers=_YAHOO_HEADERS,
                follow_redirects=True,
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("[history:yahoo] %s/%s çekilemedi: %s", yahoo_symbol, period, exc)
        return []

    try:
        result = data["chart"]["result"]
        if not result:
            return []
        result = result[0]
        timestamps: list[int] = result.get("timestamp", [])
        quote = result["indicators"]["quote"][0]
        opens   = quote.get("open",   [])
        highs   = quote.get("high",   [])
        lows    = quote.get("low",    [])
        closes  = quote.get("close",  [])
        volumes = quote.get("volume", [])

        candles = []
        for i, ts in enumerate(timestamps):
            o = opens[i]   if i < len(opens)   else None
            h = highs[i]   if i < len(highs)   else None
            l = lows[i]    if i < len(lows)     else None
            c = closes[i]  if i < len(closes)   else None
            v = volumes[i] if i < len(volumes)  else 0

            # None veya NaN kontrolü
            if o is None or c is None:
                continue
            if o != o or c != c:   # NaN check (float NaN != float NaN)
                continue

            candles.append({
                "time":   int(ts),
                "open":   round(float(o), 4),
                "high":   round(float(h or c), 4),
                "low":    round(float(l or c), 4),
                "close":  round(float(c), 4),
                "volume": int(v or 0),
            })

        logger.info("[history:yahoo] %s %s → %d mum", yahoo_symbol, period, len(candles))
        return candles
    except Exception as exc:
        logger.warning("[history:yahoo] %s parse hatası: %s", yahoo_symbol, exc)
        return []


# ── Genel arayüz ──────────────────────────────────────────────────────────────────

async def get_market_history(symbol: str, period: str) -> list[dict]:
    """
    Verilen sembol + periyot için sıralı OHLCV mum listesi döner.
    Cache miss → API çağrısı → cache'e yazar.
    """
    cached = _cache_get(symbol, period)
    if cached is not None:
        logger.debug("[history] Cache hit: %s/%s", symbol, period)
        return cached

    candles: list[dict] = []

    if symbol in _CRYPTO_MAP:
        candles = await _fetch_binance(_CRYPTO_MAP[symbol], period)
    else:
        yahoo_sym = _YAHOO_MAP.get(symbol, f"{symbol}.IS")
        candles = await _fetch_yahoo(yahoo_sym, period)

    # Zaman sırasına göre sırala (lightweight-charts zorunlu kılar)
    candles.sort(key=lambda x: x["time"])

    if candles:
        _cache_set(symbol, period, candles)

    return candles
