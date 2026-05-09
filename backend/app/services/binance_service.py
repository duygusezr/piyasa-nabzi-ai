"""
Binance Public REST API — birincil kripto veri kaynağı.
API key gerektirmez (public endpoints).
Rate limit: 1200 istek/dakika (ağırlıklı).
Docs: https://binance-docs.github.io/apidocs/spot/en/
"""

import httpx
from app.config import settings

BASE = settings.BINANCE_API_URL

# Takip edilecek semboller → {binance_symbol: (display_symbol, display_name)}
TRACKED_SYMBOLS: dict[str, tuple[str, str]] = {
    "BTCUSDT":  ("BTC",   "Bitcoin"),
    "ETHUSDT":  ("ETH",   "Ethereum"),
    "PAXGUSDT": ("PAXG",  "PAX Gold"),   # 1 PAXG = 1 troy ons altın
    "BNBUSDT":  ("BNB",   "BNB"),
    "SOLUSDT":  ("SOL",   "Solana"),
    "XRPUSDT":  ("XRP",   "Ripple"),
}


def _build_headers() -> dict:
    headers = {"Content-Type": "application/json"}
    if settings.BINANCE_API_KEY:
        headers["X-MBX-APIKEY"] = settings.BINANCE_API_KEY
    return headers


async def get_ticker_24hr(symbol: str) -> dict | None:
    """Tek bir sembol için 24 saatlik ticker verisi."""
    try:
        async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT) as client:
            resp = await client.get(
                f"{BASE}/ticker/24hr",
                params={"symbol": symbol},
                headers=_build_headers(),
            )
            resp.raise_for_status()
            return resp.json()
    except Exception:
        return None


async def get_multiple_tickers(symbols: list[str]) -> dict[str, dict]:
    """
    Birden fazla sembol için fiyat verisi — tek API çağrısıyla.
    Boş sembol listesi tüm piyasayı döndürür (pahalı), bu yüzden
    sadece ihtiyaç duyulanları gönderiyoruz.
    """
    import json
    symbols_json = json.dumps(symbols)
    try:
        async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT) as client:
            resp = await client.get(
                f"{BASE}/ticker/24hr",
                params={"symbols": symbols_json},
                headers=_build_headers(),
            )
            resp.raise_for_status()
            data = resp.json()
            # Liste formatından {symbol: data} sözlüğüne çevir
            return {item["symbol"]: item for item in data}
    except Exception:
        return {}


async def get_all_crypto_prices() -> dict[str, dict]:
    """
    Takip edilen tüm sembollerin fiyatını çeker.
    Döndürür: {binance_symbol: ticker_data}
    """
    symbols = list(TRACKED_SYMBOLS.keys())
    result = await get_multiple_tickers(symbols)

    # Başarısız olanlar için tek tek dene
    for sym in symbols:
        if sym not in result:
            single = await get_ticker_24hr(sym)
            if single:
                result[sym] = single

    return result


async def get_exchange_info() -> dict | None:
    """Borsa bilgisi — sembol doğrulama için kullanılabilir."""
    try:
        async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT) as client:
            resp = await client.get(f"{BASE}/exchangeInfo")
            resp.raise_for_status()
            return resp.json()
    except Exception:
        return None


def parse_ticker(raw: dict, usdt_to_try: float = 1.0) -> dict:
    """
    Binance ticker'ını standart formata dönüştürür.
    usdt_to_try: USDT -> TRY çarpanı (TCMB'den gelir).
    """
    price_usdt      = float(raw.get("lastPrice", 0))
    change_pct      = float(raw.get("priceChangePercent", 0))
    price_try       = price_usdt * usdt_to_try
    change_try      = price_try * change_pct / 100

    return {
        "price_usdt":   price_usdt,
        "price_try":    price_try,
        "change_pct_24h": change_pct,
        "change_try_24h": change_try,
        "high_24h":     float(raw.get("highPrice", 0)) * usdt_to_try,
        "low_24h":      float(raw.get("lowPrice", 0))  * usdt_to_try,
        "volume":       float(raw.get("volume", 0)),
        "quote_volume": float(raw.get("quoteVolume", 0)),
    }
