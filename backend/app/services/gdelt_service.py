"""
GDELT Project — Dünya siyaseti ve jeopolitik haber servisi.
─────────────────────────────────────────────────────────────
API key gerektirmez, tamamen ücretsizdir.
Docs: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/

Kullanılan endpoint: Doc API v2 (artlist modu)
  URL: https://api.gdeltproject.org/api/v2/doc/doc
  Parametreler:
    - query     : arama terimi
    - mode      : artlist (makale listesi)
    - maxrecords: max sonuç (1-250)
    - format    : json
    - startdatetime / enddatetime: YYYYMMDDHHMMSS
    - sourcelang: eng (İngilizce), tur (Türkçe) veya boş (tümü)

Rate limit: Belgelenmemiş ama makul kullanımda sorun çıkmaz.
"""

import httpx
from datetime import datetime, timezone, timedelta
from app.config import settings

# ── Sorgu şablonları ─────────────────────────────────────────────────────────
QUERY_GROUPS: list[dict] = [
    {
        "id":     "turkey_economy",
        "label":  "Türkiye Ekonomi",
        "query":  "Turkey economy inflation interest rate central bank",
        "assets": ["usd_try", "bist100", "gold"],
    },
    {
        "id":     "middle_east",
        "label":  "Orta Doğu Jeopolitiği",
        "query":  "Middle East geopolitics oil energy war conflict",
        "assets": ["gold", "oil", "bist100"],
    },
    {
        "id":     "fed_monetary",
        "label":  "Fed & Küresel Para Politikası",
        "query":  "Federal Reserve interest rate monetary policy inflation USA",
        "assets": ["bitcoin", "usd_try", "bist100"],
    },
    {
        "id":     "crypto_regulation",
        "label":  "Kripto & Dijital Varlık",
        "query":  "Bitcoin cryptocurrency regulation SEC ETF institutional",
        "assets": ["bitcoin", "ethereum"],
    },
    {
        "id":     "defense_nato",
        "label":  "Savunma & NATO",
        "query":  "NATO defense spending Turkey military procurement",
        "assets": ["ASELS", "bist100"],
    },
]

# Etkilenen varlık → risk yönü kural tablosu (Gemini yoksa kullanılır)
KEYWORD_RISK: dict[str, tuple[list[str], str]] = {
    "gerilim":     (["gold", "usd_try"],        "high"),
    "savaş":       (["gold", "oil"],             "high"),
    "faiz artış":  (["bitcoin", "bist100"],      "high"),
    "faiz indirim":(["bitcoin", "bist100"],      "medium"),
    "enflasyon":   (["gold", "usd_try"],         "high"),
    "yaptırım":    (["usd_try", "bist100"],      "high"),
    "btc etf":     (["bitcoin"],                 "medium"),
    "savunma":     (["ASELS"],                   "low"),
}


def _gdelt_datetime(hours_back: int = 24) -> tuple[str, str]:
    """GDELT datetime formatı: YYYYMMDDHHMMSS"""
    now   = datetime.now(timezone.utc)
    start = now - timedelta(hours=hours_back)
    fmt   = "%Y%m%d%H%M%S"
    return start.strftime(fmt), now.strftime(fmt)


async def _fetch_gdelt_articles(query: str, max_records: int = 5) -> list[dict]:
    """Belirli bir sorgu için GDELT makale listesini çeker."""
    start_dt, end_dt = _gdelt_datetime(hours_back=48)
    params = {
        "query":         query,
        "mode":          "artlist",
        "maxrecords":    max_records,
        "format":        "json",
        "startdatetime": start_dt,
        "enddatetime":   end_dt,
        "sourcelang":    "english",
    }
    try:
        async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT) as client:
            resp = await client.get(settings.GDELT_API_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
            return data.get("articles", [])
    except Exception:
        return []


def _infer_risk_level(title: str, summary: str) -> str:
    """Basit kural tabanlı risk seviyesi tahmini."""
    text = (title + " " + summary).lower()
    for kw, (_, level) in KEYWORD_RISK.items():
        if kw in text:
            return level
    return "medium"


def _infer_affected_assets(group_assets: list[str], title: str) -> list[str]:
    """Haber başlığına göre etkilenen varlıkları tespit eder."""
    title_lower = title.lower()
    extra = []
    if "bitcoin" in title_lower or "crypto" in title_lower:
        extra.append("bitcoin")
    if "gold" in title_lower or "altın" in title_lower:
        extra.append("gold")
    if "turkey" in title_lower or "türkiye" in title_lower:
        extra += ["usd_try", "bist100"]
    return list(dict.fromkeys(group_assets + extra))  # deduplicate, preserve order


async def fetch_gdelt_signals() -> list[dict]:
    """
    Tüm sorgu grupları için GDELT haberleri çeker.
    Döndürür: ham makale listesi, her madde grubun meta verisiyle zenginleştirilmiş.
    """
    all_articles: list[dict] = []
    per_group = max(2, settings.GDELT_MAX_RECORDS // len(QUERY_GROUPS))

    for group in QUERY_GROUPS:
        articles = await _fetch_gdelt_articles(group["query"], max_records=per_group)
        for art in articles:
            all_articles.append({
                "group_id":       group["id"],
                "group_label":    group["label"],
                "group_assets":   group["assets"],
                "title":          art.get("title", ""),
                "url":            art.get("url", ""),
                "domain":         art.get("domain", ""),
                "seendate":       art.get("seendate", ""),
                "sourcelang":     art.get("language", "English"),
                "sourcecountry":  art.get("sourcecountry", ""),
                "socialimage":    art.get("socialimage", ""),
            })

    return all_articles


def build_news_signals_from_gdelt(
    articles: list[dict],
    gemini_summaries: list[dict] | None = None,
) -> list[dict]:
    """
    GDELT makalelerini NewsSignal formatına dönüştürür.
    gemini_summaries varsa Gemini'nin zenginleştirmesini kullanır.
    """
    from datetime import datetime as dt

    # Gemini özetlerini id ile eşleştir
    gemini_map: dict[str, dict] = {}
    if gemini_summaries:
        for gs in gemini_summaries:
            key = gs.get("url") or gs.get("title", "")
            if key:
                gemini_map[key] = gs

    signals = []
    for i, art in enumerate(articles[:settings.GDELT_MAX_RECORDS]):
        title   = art.get("title", "")
        url     = art.get("url", "")
        domain  = art.get("domain", "")
        seendate = art.get("seendate", "")
        assets  = _infer_affected_assets(art.get("group_assets", []), title)

        # Tarih parse
        try:
            published = dt.strptime(seendate, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc).isoformat()
        except Exception:
            published = datetime.now(timezone.utc).isoformat()

        # Gemini zenginleştirmesi
        gem = gemini_map.get(url) or gemini_map.get(title)
        if gem:
            summary      = gem.get("summary", title)
            risk_level   = gem.get("risk_level", "medium")
            market_impact = gem.get("market_impact", "Piyasa etkisi analiz edilmektedir.")
            affected      = gem.get("affected_assets", assets)
        else:
            summary      = title
            risk_level   = _infer_risk_level(title, "")
            market_impact = f"{art.get('group_label', '')} kaynaklı haber — simülasyon amaçlı değerlendirme yapılmaktadır."
            affected      = assets

        signals.append({
            "id":              f"gdelt-{i:04d}",
            "title":           title,
            "summary":         summary,
            "source":          f"GDELT / {domain}",
            "published_at":    published,
            "affected_assets": affected,
            "risk_level":      risk_level,
            "market_impact":   market_impact + " Bu içerik simülasyon amaçlıdır.",
            "url":             url,
        })

    return signals
