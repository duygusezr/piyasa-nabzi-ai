"""
TEFAS Fon Servisi — Türkiye Elektronik Fon Alım Satım Platformu
Kaynak: ws.tefas.com.tr (ücretsiz, public API)
Fallback: Gerçekçi mock veriler (API cevap vermezse)
"""
import asyncio
import logging
from datetime import datetime, timezone
import httpx
from app.models.schemas import AssetPrice

logger = logging.getLogger(__name__)

# ── Hedef fon kodları → (ad, kategori) ────────────────────────────────────────
TARGET_FUNDS: dict[str, tuple[str, str]] = {
    "AAK": ("Ak Portföy Para Piyasası Likit Fonu",    "Para Piyasası"),
    "YAK": ("Yapı Kredi Port. Para Piyasası Fonu",    "Para Piyasası"),
    "GHK": ("Garanti Portföy Hisse Senedi Fonu",      "Hisse Senedi"),
    "TTE": ("İş Portföy Altın Fonu",                  "Altın"),
    "IAK": ("İş Portföy Hisse Senedi Fonu",           "Hisse Senedi"),
    "AFA": ("Ak Portföy Altın Fonu",                  "Altın"),
    "YBG": ("Yapı Kredi Port. Borç. Araç. Fonu",      "Tahvil/Bono"),
}

# Gerçekçi fallback fiyatlar (API kapalıysa)
_MOCK_PRICES: dict[str, tuple[float, float]] = {
    "AAK": (1.4523,  0.042),
    "YAK": (1.2134,  0.038),
    "GHK": (3.1892, -0.87),
    "TTE": (2.0341,  0.92),
    "IAK": (4.5671, -0.34),
    "AFA": (1.9823,  0.76),
    "YBG": (1.1234,  0.21),
}

_TEFAS_BASE = "https://ws.tefas.com.tr/api/data"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Origin": "https://www.tefas.com.tr",
    "Referer": "https://www.tefas.com.tr/",
}


def _parse_tefas_row(row: dict, code: str) -> tuple[float, float] | None:
    """TEFAS API yanıtından fiyat ve değişim yüzdesi çıkarır."""
    # Olası alan adları (API versiyonuna göre değişebilir)
    price_keys  = ["BIRIMPAYDEGERI", "birimpaydegeri", "price", "nav"]
    change_keys = ["GUNLUKGETIRI", "gunlukgetiri", "dailyReturn", "change_pct"]

    price = None
    for k in price_keys:
        v = row.get(k)
        if v is not None:
            try:
                price = float(v)
                break
            except (ValueError, TypeError):
                pass

    change = 0.0
    for k in change_keys:
        v = row.get(k)
        if v is not None:
            try:
                change = float(v)
                break
            except (ValueError, TypeError):
                pass

    if price and price > 0:
        return price, change
    return None


async def _fetch_single_fund(code: str) -> tuple[float, float] | None:
    """Tek bir fonun güncel NAV'ını TEFAS'tan çeker."""
    url = f"{_TEFAS_BASE}/tefasfund/?fonkod={code}"
    try:
        async with httpx.AsyncClient(timeout=8.0, headers=_HEADERS) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        # Yanıt liste veya dict olabilir
        if isinstance(data, list) and len(data) > 0:
            return _parse_tefas_row(data[0], code)
        elif isinstance(data, dict):
            return _parse_tefas_row(data, code)
    except Exception as exc:
        logger.debug("[tefas] %s çekilemedi: %s", code, exc)
    return None


async def _fetch_yield_list() -> dict[str, tuple[float, float]]:
    """TEFAS toplu getiri listesinden hedef fonları çeker (tek çağrı)."""
    url = f"{_TEFAS_BASE}/tefasfundyieldlist/"
    try:
        async with httpx.AsyncClient(timeout=12.0, headers=_HEADERS) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        result: dict[str, tuple[float, float]] = {}
        rows = data if isinstance(data, list) else data.get("results", [])

        for row in rows:
            code = (
                row.get("FONKODU")
                or row.get("fonkodu")
                or row.get("code")
                or row.get("fonkod", "")
            ).strip().upper()

            if code in TARGET_FUNDS:
                parsed = _parse_tefas_row(row, code)
                if parsed:
                    result[code] = parsed

        if result:
            logger.info("[tefas] Toplu liste: %d/%d fon alındı", len(result), len(TARGET_FUNDS))
        return result

    except Exception as exc:
        logger.warning("[tefas] Toplu liste çekilemedi: %s", exc)
        return {}


async def get_fund_assets() -> list[AssetPrice]:
    """
    Hedef TEFAS fonlarının güncel NAV verilerini döner.
    Strateji:
      1. Toplu getiri listesi (tek çağrı, en verimli)
      2. Başarısız olanlar için tek tek çekme
      3. Hâlâ eksik olanlar için gerçekçi mock
    """
    ts = datetime.now(timezone.utc).isoformat()
    prices: dict[str, tuple[float, float]] = {}

    # 1. Toplu çekme
    bulk = await _fetch_yield_list()
    prices.update(bulk)

    # 2. Eksik olanlar için tek tek dene
    missing = [c for c in TARGET_FUNDS if c not in prices]
    if missing:
        tasks = [_fetch_single_fund(code) for code in missing]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for code, res in zip(missing, results):
            if isinstance(res, tuple) and res:
                prices[code] = res

    # 3. Hâlâ eksik → mock
    for code in TARGET_FUNDS:
        if code not in prices:
            prices[code] = _MOCK_PRICES.get(code, (1.0, 0.0))

    # AssetPrice listesine dönüştür
    assets: list[AssetPrice] = []
    for code, (fund_name, fund_type) in TARGET_FUNDS.items():
        price, change_pct = prices.get(code, _MOCK_PRICES.get(code, (1.0, 0.0)))
        is_mock = code not in bulk and code not in {
            c for c, r in zip(missing, []) if r
        }
        # Kaynağı belirle
        source = "TEFAS" if prices.get(code) != _MOCK_PRICES.get(code) else "Mock"

        assets.append(AssetPrice(
            symbol=code,
            name=f"{fund_name} ({fund_type})",
            price=round(price, 6),
            currency="TRY",
            change_24h=round(price * change_pct / 100, 6),
            change_pct_24h=round(change_pct, 4),
            timestamp=ts,
            source=source,
            is_mock=(source == "Mock"),
        ))

    logger.info("[tefas] %d fon döndürüldü (%d TEFAS, %d mock)",
                len(assets),
                sum(1 for a in assets if not a.is_mock),
                sum(1 for a in assets if a.is_mock))
    return assets
