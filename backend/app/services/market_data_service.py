"""
Piyasa veri servisi — öncelik:
  Kripto : Binance → CoinGecko fallback → Mock
  Döviz  : TCMB XML → Mock
  Altın  : PAXG/Binance → TCMB XAU → Mock
  BIST   : Yahoo Finance → Mock
  Cache  : 60s TTL (tekrar istek atmaz)
"""
import asyncio
import httpx
from time import time
from datetime import datetime, timezone
from app.config import settings
from app.models.schemas import AssetPrice, MarketData
from app.services.binance_service import get_all_crypto_prices, parse_ticker, TRACKED_SYMBOLS
from app.services.tcmb_service import get_tcmb_rates
from app.services.yahoo_finance_service import get_bist_assets

# ── TTL Cache ─────────────────────────────────────────────────────────────────
_market_cache: MarketData | None = None
_market_cache_ts: float = 0.0
_MARKET_TTL = 60  # saniye


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Mock fallbacks ────────────────────────────────────────────────────────────

def _mock_asset(symbol: str, name: str, price: float, change_pct: float) -> AssetPrice:
    ts = _now_iso()
    return AssetPrice(
        symbol=symbol, name=name, price=price, currency="TRY",
        change_24h=round(price * change_pct / 100, 2),
        change_pct_24h=change_pct, timestamp=ts, source="Mock", is_mock=True,
    )


def _mock_market_data() -> MarketData:
    ts = _now_iso()
    bitcoin  = _mock_asset("BTC",    "Bitcoin",      2_850_000.0,  1.60)
    gold     = _mock_asset("XAU",    "Altın (gram)",     3_180.0,  0.70)
    usd_try  = _mock_asset("USDTRY", "USD/TRY",            32.85,  0.37)
    bist100  = _mock_asset("XU100",  "BIST 100",        9_850.0, -0.46)
    ethereum = _mock_asset("ETH",    "Ethereum",       108_500.0, -1.10)
    bist_rest = [
        _mock_asset("ASELS", "ASELSAN",     54.80,  2.24),
        _mock_asset("THYAO", "THY",         301.5,  1.12),
        _mock_asset("EREGL", "Ereğli",       36.20, -0.55),
        _mock_asset("GARAN", "Garanti BBVA",122.3,  0.82),
        _mock_asset("KCHOL", "Koç Holding", 168.9, -1.23),
    ]
    all_assets = [bitcoin, gold, usd_try, bist100, ethereum] + bist_rest
    return MarketData(bitcoin=bitcoin, gold=gold, usd_try=usd_try,
                      bist100=bist100, assets=all_assets, fetched_at=ts)


# ── CoinGecko fallback ────────────────────────────────────────────────────────

async def _coingecko_fallback(usd_try: float) -> dict[str, AssetPrice]:
    url = f"{settings.COINGECKO_API_URL}/simple/price"
    params = {"ids": "bitcoin,ethereum", "vs_currencies": "usd", "include_24hr_change": "true"}
    headers = {}
    if settings.COINGECKO_API_KEY:
        headers["x-cg-demo-api-key"] = settings.COINGECKO_API_KEY
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return {}
    ts = _now_iso()
    result: dict[str, AssetPrice] = {}
    for cg_id, sym, name in [("bitcoin","BTC","Bitcoin"),("ethereum","ETH","Ethereum")]:
        entry = data.get(cg_id, {})
        price_usd  = float(entry.get("usd", 0))
        change_pct = float(entry.get("usd_24h_change", 0))
        price_try  = price_usd * usd_try
        result[sym] = AssetPrice(
            symbol=sym, name=name, price=round(price_try, 2), currency="TRY",
            change_24h=round(price_try * change_pct / 100, 2),
            change_pct_24h=round(change_pct, 4),
            timestamp=ts, source="CoinGecko", is_mock=False,
        )
    return result


# ── Binance conversion ────────────────────────────────────────────────────────

def _convert_binance_to_assets(raw: dict, usd_try: float) -> dict[str, AssetPrice]:
    ts = _now_iso()
    result: dict[str, AssetPrice] = {}
    for binance_sym, (display_sym, display_name) in TRACKED_SYMBOLS.items():
        ticker = raw.get(binance_sym)
        if not ticker:
            continue
        parsed = parse_ticker(ticker, usdt_to_try=usd_try)
        result[display_sym] = AssetPrice(
            symbol=display_sym, name=display_name,
            price=round(parsed["price_try"], 2), currency="TRY",
            change_24h=round(parsed["change_try_24h"], 2),
            change_pct_24h=round(parsed["change_pct_24h"], 4),
            timestamp=ts, source="Binance", is_mock=False,
        )
    if "PAXG" in result:
        paxg_try = result["PAXG"].price
        paxg_pct = result["PAXG"].change_pct_24h
        gold_gram = round(paxg_try / 31.1035, 2)
        result["XAU"] = AssetPrice(
            symbol="XAU", name="Altın (gram)", price=gold_gram, currency="TRY",
            change_24h=round(gold_gram * paxg_pct / 100, 2),
            change_pct_24h=paxg_pct,
            timestamp=ts, source="Binance/PAXG", is_mock=False,
        )
    return result


def _build_gold_from_tcmb(tcmb: dict) -> AssetPrice:
    price = tcmb.get("xau_try_gram", 3_180.0)
    return AssetPrice(
        symbol="XAU", name="Altın (gram)", price=price, currency="TRY",
        change_24h=0.0, change_pct_24h=0.0, timestamp=_now_iso(),
        source=tcmb.get("source", "TCMB"), is_mock=tcmb.get("is_mock", False),
    )


# ── Ana servis ────────────────────────────────────────────────────────────────

async def get_market_data() -> MarketData:
    global _market_cache, _market_cache_ts

    if settings.USE_MOCK_DATA:
        return _mock_market_data()

    # Cache kontrolü
    if _market_cache is not None and (time() - _market_cache_ts) < _MARKET_TTL:
        return _market_cache

    # Paralel: Binance + TCMB + Yahoo Finance BIST
    raw_binance_task = asyncio.create_task(get_all_crypto_prices())
    tcmb_task        = asyncio.create_task(get_tcmb_rates())
    bist_task        = asyncio.create_task(get_bist_assets())

    raw_binance, tcmb, bist_assets = await asyncio.gather(
        raw_binance_task, tcmb_task, bist_task, return_exceptions=True
    )

    # Hata toleransı
    if isinstance(raw_binance, Exception): raw_binance = {}
    if isinstance(tcmb, Exception):        tcmb = {}
    if isinstance(bist_assets, Exception): bist_assets = []

    usd_try_rate: float = tcmb.get("usd_try", 32.85) if isinstance(tcmb, dict) else 32.85
    ts = _now_iso()

    # Kripto
    crypto_assets: dict[str, AssetPrice] = {}
    if raw_binance:
        crypto_assets = _convert_binance_to_assets(raw_binance, usd_try_rate)

    if not crypto_assets or ("BTC" not in crypto_assets and "ETH" not in crypto_assets):
        cg = await _coingecko_fallback(usd_try_rate)
        crypto_assets.update(cg)

    bitcoin  = crypto_assets.get("BTC")  or _mock_asset("BTC",  "Bitcoin",    2_850_000.0,  1.60)
    ethereum = crypto_assets.get("ETH")  or _mock_asset("ETH",  "Ethereum",   108_500.0,   -1.10)
    gold     = crypto_assets.get("XAU")  or _build_gold_from_tcmb(tcmb if isinstance(tcmb, dict) else {})

    # Döviz
    usd_try_asset = AssetPrice(
        symbol="USDTRY", name="USD/TRY", price=usd_try_rate, currency="TRY",
        change_24h=0.0, change_pct_24h=0.0, timestamp=ts,
        source=tcmb.get("source", "TCMB") if isinstance(tcmb, dict) else "Mock",
        is_mock=tcmb.get("is_mock", False) if isinstance(tcmb, dict) else True,
    )

    # BIST
    if not bist_assets:
        bist_assets = [
            _mock_asset("XU100","BIST 100",9850.0,-0.46),
            _mock_asset("ASELS","ASELSAN",54.8,2.24),
            _mock_asset("THYAO","THY",301.5,1.12),
            _mock_asset("EREGL","Ereğli",36.2,-0.55),
            _mock_asset("GARAN","Garanti BBVA",122.3,0.82),
            _mock_asset("KCHOL","Koç Holding",168.9,-1.23),
        ]
    bist100 = next((a for a in bist_assets if a.symbol == "XU100"), bist_assets[0])

    # Ek kripto
    extras = [crypto_assets[s] for s in ("PAXG","BNB","SOL","XRP") if s in crypto_assets]

    all_assets = [bitcoin, gold, usd_try_asset, bist100, ethereum] + bist_assets[1:] + extras

    result = MarketData(
        bitcoin=bitcoin, gold=gold, usd_try=usd_try_asset,
        bist100=bist100, assets=all_assets, fetched_at=ts,
    )
    _market_cache = result
    _market_cache_ts = time()
    return result
