"""
Yahoo Finance — BIST hisse & endeks verisi (ücretsiz, auth yok)
Sembol formatı: ASELS.IS, XU100.IS, THYAO.IS ...
"""
import asyncio
import httpx
from datetime import datetime, timezone
from app.config import settings
from app.models.schemas import AssetPrice

BIST_SYMBOLS: dict[str, tuple[str, str]] = {
    "XU100.IS":  ("XU100",  "BIST 100"),
    "ASELS.IS":  ("ASELS",  "ASELSAN"),
    "THYAO.IS":  ("THYAO",  "THY"),
    "EREGL.IS":  ("EREGL",  "Ereğli"),
    "GARAN.IS":  ("GARAN",  "Garanti BBVA"),
    "KCHOL.IS":  ("KCHOL",  "Koç Holding"),
}

_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; PiyasaNabziBot/1.0)"}


async def _fetch_yahoo(yf_symbol: str) -> dict | None:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yf_symbol}"
    params = {"interval": "1d", "range": "2d"}
    try:
        async with httpx.AsyncClient(timeout=6.0, headers=_HEADERS) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        result = data["chart"]["result"][0]
        meta   = result["meta"]
        price  = float(meta.get("regularMarketPrice", 0))
        prev   = float(meta.get("previousClose") or meta.get("chartPreviousClose", price))
        change_pct = ((price - prev) / prev * 100) if prev else 0.0
        return {
            "price":       price,
            "prev_close":  prev,
            "change_pct":  round(change_pct, 4),
            "change_abs":  round(price - prev, 4),
            "timestamp":   datetime.now(timezone.utc).isoformat(),
        }
    except Exception:
        return None


async def get_bist_assets() -> list[AssetPrice]:
    tasks = {sym: asyncio.create_task(_fetch_yahoo(sym)) for sym in BIST_SYMBOLS}
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)

    assets = []
    for (yf_sym, (display_sym, display_name)), raw in zip(BIST_SYMBOLS.items(), results):
        if isinstance(raw, dict) and raw.get("price", 0) > 0:
            assets.append(AssetPrice(
                symbol=display_sym,
                name=display_name,
                price=raw["price"],
                currency="TRY",
                change_24h=raw["change_abs"],
                change_pct_24h=raw["change_pct"],
                timestamp=raw["timestamp"],
                source="Yahoo Finance",
                is_mock=False,
            ))
        else:
            # fallback mock
            mock_prices = {"XU100":9850.0,"ASELS":54.8,"THYAO":301.5,"EREGL":36.2,"GARAN":122.3,"KCHOL":168.9}
            assets.append(AssetPrice(
                symbol=display_sym, name=display_name,
                price=mock_prices.get(display_sym, 100.0),
                currency="TRY", change_24h=0.0, change_pct_24h=0.0,
                timestamp=datetime.now(timezone.utc).isoformat(),
                source="Mock", is_mock=True,
            ))
    return assets
