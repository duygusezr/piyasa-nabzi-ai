"""
TCMB Veri Servisi
─────────────────
Birincil kaynak : TCMB günlük kur XML (auth gerektirmez)
  URL: https://www.tcmb.gov.tr/kurlar/today.xml
  Kapsam: USD, EUR, GBP, CHF, JPY, SAR, vb. — hafta içi güncellenir.

İkincil kaynak  : TCMB EVDS REST API (API key gerekir, isteğe bağlı)
  Kayıt: https://evds2.tcmb.gov.tr/
  Kapsam: Tarihsel seri, enflasyon, faiz, ödemeler dengesi, vb.

Not: Hafta sonları / tatillerde XML güncellenmez → son geçerli veri döner.
"""

import httpx
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from app.config import settings

# ── Sabitler ─────────────────────────────────────────────────────────────────
EVDS_SERIES = {
    "usd_try":   "TP.DK.USD.A",   # USD/TRY günlük alış ortalaması
    "eur_try":   "TP.DK.EUR.A",   # EUR/TRY
    "gbp_try":   "TP.DK.GBP.A",   # GBP/TRY
    "gold_oz_usd": "TP.MK.F.RAN.C11",  # İstanbul Altın Borsası (ons, USD)
    "cpi_monthly": "TP.FE.OKTG01",     # TÜFE aylık değişim
    "policy_rate": "TP.KTF10",         # TCMB politika faizi
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── XML (ücretsiz, günlük) ───────────────────────────────────────────────────

async def fetch_tcmb_xml() -> dict | None:
    """
    TCMB günlük kur XML'ini çeker ve {currency_code: {buying, selling}} döndürür.
    Hafta içi iş saatlerinde güncellenir (~09:30 TR saati).
    """
    try:
        async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT) as client:
            resp = await client.get(settings.TCMB_XML_URL)
            resp.raise_for_status()
            root = ET.fromstring(resp.content)
    except Exception:
        return None

    rates: dict[str, dict] = {}
    for currency in root.findall("Currency"):
        code = currency.get("CurrencyCode", "")
        if not code:
            continue

        def _safe_float(tag: str) -> float | None:
            el = currency.find(tag)
            if el is not None and el.text:
                try:
                    return float(el.text.replace(",", "."))
                except ValueError:
                    pass
            return None

        unit    = int(currency.findtext("Unit") or "1")
        buying  = _safe_float("ForexBuying")
        selling = _safe_float("ForexSelling")

        if buying and selling:
            rates[code] = {
                "unit":    unit,
                "buying":  buying  / unit,
                "selling": selling / unit,
                "mid":     ((buying + selling) / 2) / unit,
            }

    return rates or None


async def get_usd_try() -> float:
    """USD/TRY orta kurunu döndürür. Hata durumunda mock değer."""
    rates = await fetch_tcmb_xml()
    if rates and "USD" in rates:
        return rates["USD"]["mid"]
    return 32.85   # mock fallback


async def get_tcmb_rates() -> dict:
    """
    Ana döviz kurlarını ve varsa altın verisini döndürür.
    {
      "usd_try": 32.85,
      "eur_try": 35.10,
      "gbp_try": 41.20,
      "xau_try_gram": 3180.0,   # hesaplanan
      "source": "TCMB XML",
      "timestamp": "...",
      "is_mock": False
    }
    """
    rates = await fetch_tcmb_xml()

    if not rates:
        return _mock_rates()

    usd_try = rates.get("USD", {}).get("mid", 32.85)
    eur_try = rates.get("EUR", {}).get("mid", 35.10)
    gbp_try = rates.get("GBP", {}).get("mid", 41.20)

    # Altın (ons) TCMB XML'de XAU olarak yer alır, USD bazlı
    xau_entry = rates.get("XAU", {})
    if xau_entry:
        xau_usd_oz  = xau_entry.get("mid", 2350.0)
        xau_try_gram = (xau_usd_oz / 31.1035) * usd_try
    else:
        # Proxy: gram altın ≈ (uluslararası ons fiyatı / 31.1035) * USD/TRY
        # Fallback ons fiyatı kullanılır (güncellenebilir)
        xau_try_gram = (2350.0 / 31.1035) * usd_try

    return {
        "usd_try":      usd_try,
        "eur_try":      eur_try,
        "gbp_try":      gbp_try,
        "xau_try_gram": round(xau_try_gram, 2),
        "source":       "TCMB XML",
        "timestamp":    _now_iso(),
        "is_mock":      False,
    }


def _mock_rates() -> dict:
    return {
        "usd_try":      32.85,
        "eur_try":      35.10,
        "gbp_try":      41.20,
        "xau_try_gram": 3180.0,
        "source":       "Mock",
        "timestamp":    _now_iso(),
        "is_mock":      True,
    }


# ── EVDS (isteğe bağlı, tarihsel/makro) ─────────────────────────────────────

async def fetch_evds_series(series_key: str, days_back: int = 5) -> list[dict] | None:
    """
    EVDS'den belirtilen seriyi çeker.
    API key gerektirir (TCMB_API_KEY).
    Dönüş: [{"Tarih": "DD-MM-YYYY", "value": float}, ...]
    """
    if not settings.TCMB_API_KEY:
        return None

    series_code = EVDS_SERIES.get(series_key)
    if not series_code:
        return None

    from datetime import timedelta
    end_dt   = datetime.now()
    start_dt = end_dt - timedelta(days=days_back)
    date_fmt = "%d-%m-%Y"

    url = f"{settings.TCMB_EVDS_URL}/data/{series_code}"
    params = {
        "startDate": start_dt.strftime(date_fmt),
        "endDate":   end_dt.strftime(date_fmt),
        "type":      "json",
        "key":       settings.TCMB_API_KEY,
    }

    try:
        async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            items = data.get("items", [])
            result = []
            for item in items:
                raw_val = item.get(series_code)
                if raw_val:
                    try:
                        result.append({
                            "date":  item.get("Tarih", ""),
                            "value": float(str(raw_val).replace(",", ".")),
                        })
                    except (ValueError, TypeError):
                        pass
            return result or None
    except Exception:
        return None


async def get_macro_indicators() -> dict:
    """
    Temel makroekonomik göstergeleri döndürür (EVDS varsa canlı, yoksa mock).
    """
    if not settings.TCMB_API_KEY:
        return _mock_macro()

    cpi    = await fetch_evds_series("cpi_monthly", days_back=60)
    policy = await fetch_evds_series("policy_rate", days_back=30)

    return {
        "cpi_monthly_pct": cpi[-1]["value"]    if cpi    else 3.18,
        "policy_rate_pct": policy[-1]["value"] if policy else 45.0,
        "source":          "TCMB EVDS",
        "timestamp":       _now_iso(),
        "is_mock":         False,
    }


def _mock_macro() -> dict:
    return {
        "cpi_monthly_pct": 3.18,
        "policy_rate_pct": 45.0,
        "source":          "Mock",
        "timestamp":       _now_iso(),
        "is_mock":         True,
    }
