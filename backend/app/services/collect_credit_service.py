"""
CollectAPI Kredi Faiz Servisi — Banka bazlı faiz oranları, ~400-700ms
Endpoint: GET /credit/creditBid
Query türleri: ihtiyac | konut | tasit

Tüm türler paralel çekilir → CreditRates nesnesi döner.
Cache: 10 dakika (faiz oranları sık değişmez)
"""
import asyncio
import logging
from datetime import datetime, timezone
from time import time

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_CREDIT_URL = "https://api.collectapi.com/credit/creditBid"
_TIMEOUT    = 8.0
_CACHE_TTL  = 600  # 10 dakika

# ── Cache ──────────────────────────────────────────────────────────────────────
_cache: dict | None = None
_cache_ts: float    = 0.0

# Sorgu türleri: (API param, Türkçe ad)
_LOAN_TYPES = [
    ("ihtiyac", "İhtiyaç Kredisi"),
    ("konut",   "Konut Kredisi"),
    ("tasit",   "Taşıt Kredisi"),
]

# Varsayılan sorgu parametreleri
_DEFAULT_PRICE = 100_000   # TL
_DEFAULT_MONTH = 12        # ay


async def _fetch_loan_type(query: str, price: int = _DEFAULT_PRICE, month: int = _DEFAULT_MONTH) -> list[dict]:
    """Tek kredi türü için CollectAPI'dan faiz oranlarını çeker."""
    if not settings.COLLECTAPI_KEY:
        return []

    headers = {
        "content-type":  "application/json",
        "authorization": f"apikey {settings.COLLECTAPI_KEY}",
    }
    params = {
        "data.price": price,
        "data.month": month,
        "data.query": query,
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(_CREDIT_URL, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("[credit] %s çekilemedi: %s", query, exc)
        return []

    if not data.get("success"):
        logger.warning("[credit] %s — API başarısız: %s", query, data)
        return []

    results = []
    for item in data.get("result", []):
        bank_name   = (item.get("bankName")      or item.get("name")        or "").strip()
        rate        = item.get("interestRate")    or item.get("rate")        or 0
        monthly_pay = item.get("monthlyPayment")  or item.get("monthly")     or 0
        total_pay   = item.get("totalPayment")    or item.get("total")       or 0
        logo        = item.get("logo")            or item.get("bankLogo")    or ""

        if not bank_name:
            continue

        results.append({
            "bank":          bank_name,
            "interest_rate": float(rate),
            "monthly_pay":   float(monthly_pay),
            "total_pay":     float(total_pay),
            "logo":          logo,
        })

    # Faiz oranına göre artan sırala (en düşük önce)
    results.sort(key=lambda x: x["interest_rate"])
    return results


async def get_credit_rates(
    price: int = _DEFAULT_PRICE,
    month: int = _DEFAULT_MONTH,
) -> dict:
    """
    Tüm kredi türlerini paralel çeker.
    Dönen yapı:
    {
      "ihtiyac": [{"bank": ..., "interest_rate": ..., "monthly_pay": ..., "total_pay": ..., "logo": ...}, ...],
      "konut":   [...],
      "tasit":   [...],
      "params":  {"price": 100000, "month": 12},
      "fetched_at": "...",
      "is_mock": False,
    }
    """
    global _cache, _cache_ts

    # Cache kontrolü (aynı parametre kombinasyonu için)
    cache_key = f"{price}_{month}"
    if (_cache is not None
            and _cache.get("_key") == cache_key
            and (time() - _cache_ts) < _CACHE_TTL):
        logger.debug("[credit] Cache'ten döndü.")
        return _cache

    if not settings.COLLECTAPI_KEY:
        logger.info("[credit] COLLECTAPI_KEY tanımlı değil → mock veri")
        return _mock_rates(price, month)

    tasks = [_fetch_loan_type(q, price, month) for q, _ in _LOAN_TYPES]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    data: dict = {
        "params":     {"price": price, "month": month},
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "is_mock":    False,
        "_key":       cache_key,
    }

    all_empty = True
    for (query, _), result in zip(_LOAN_TYPES, results):
        if isinstance(result, list) and result:
            data[query] = result
            all_empty = False
        else:
            data[query] = []

    if all_empty:
        logger.warning("[credit] Tüm kredi türleri boş döndü → mock")
        return _mock_rates(price, month)

    total = sum(len(data.get(q, [])) for q, _ in _LOAN_TYPES)
    logger.info("[credit] %d banka faiz oranı çekildi (%d ay, %s TL).",
                total, month, f"{price:,}")

    _cache    = data
    _cache_ts = time()
    return data


def _mock_rates(price: int, month: int) -> dict:
    """API yokken gösterilecek örnek veriler."""
    ts = datetime.now(timezone.utc).isoformat()
    mock_banks = [
        {"bank": "Ziraat Bankası", "interest_rate": 3.89, "monthly_pay": 9_250.0, "total_pay": 111_000.0, "logo": ""},
        {"bank": "Halkbank",       "interest_rate": 3.95, "monthly_pay": 9_310.0, "total_pay": 111_720.0, "logo": ""},
        {"bank": "Vakıfbank",      "interest_rate": 4.10, "monthly_pay": 9_460.0, "total_pay": 113_520.0, "logo": ""},
        {"bank": "Garanti BBVA",   "interest_rate": 4.25, "monthly_pay": 9_620.0, "total_pay": 115_440.0, "logo": ""},
        {"bank": "İş Bankası",     "interest_rate": 4.35, "monthly_pay": 9_720.0, "total_pay": 116_640.0, "logo": ""},
        {"bank": "Yapı Kredi",     "interest_rate": 4.49, "monthly_pay": 9_860.0, "total_pay": 118_320.0, "logo": ""},
        {"bank": "Akbank",         "interest_rate": 4.55, "monthly_pay": 9_920.0, "total_pay": 119_040.0, "logo": ""},
        {"bank": "QNB Finansbank", "interest_rate": 4.65, "monthly_pay": 10_020.0,"total_pay": 120_240.0, "logo": ""},
    ]
    return {
        "ihtiyac":   mock_banks,
        "konut":     [{**b, "interest_rate": round(b["interest_rate"] - 0.5, 2)} for b in mock_banks[:6]],
        "tasit":     [{**b, "interest_rate": round(b["interest_rate"] + 0.3, 2)} for b in mock_banks[:5]],
        "params":    {"price": price, "month": month},
        "fetched_at": ts,
        "is_mock":   True,
        "_key":      f"{price}_{month}",
    }
