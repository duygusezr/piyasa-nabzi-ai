"""
RSS Haber Servisi — Türkçe + İngilizce kaynaklar, auth gerektirmez, ~1-2s
Türkçe kaynaklar: Bloomberg HT, NTV Ekonomi, AA Ekonomi, AA Dünya (çeviri gerekmez)
İngilizce kaynaklar: Yahoo Finance, CNBC (DeepL ile çevrilir)
"""
import asyncio
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import httpx

RSS_FEEDS = [
    # ── Türkçe kaynaklar (tr_title = orijinal, DeepL çağrılmaz) ──────────────
    {"url": "https://www.bloomberght.com/rss",                            "source": "Bloomberg HT",  "lang": "tr"},
    {"url": "https://www.ntv.com.tr/ekonomi.rss",                         "source": "NTV Ekonomi",   "lang": "tr"},
    {"url": "https://www.haberturk.com/rss/ekonomi.xml",                  "source": "Haberturk",     "lang": "tr"},
    {"url": "https://www.aa.com.tr/tr/rss/ekonomi",                       "source": "AA Ekonomi",    "lang": "tr"},
    {"url": "https://www.aa.com.tr/tr/rss/dunya",                         "source": "AA Dünya",      "lang": "tr"},
    # ── İngilizce kaynaklar (DeepL ile Türkçeye çevrilir) ───────────────────
    {"url": "https://finance.yahoo.com/rss/topfinstories",                "source": "Yahoo Finance", "lang": "en"},
    {"url": "https://www.cnbc.com/id/10001147/device/rss/rss.html",      "source": "CNBC",          "lang": "en"},
]

# Kesinlikle finans dışı — hem TR hem EN için
_EXCLUDE_KEYWORDS = [
    # Spor
    "futbol", "basketbol", "voleybol", "formula 1", "şampiyonluk",
    "maç", "gol", "penaltı", "transfer (futbol)", "nba", "nfl", "soccer",
    # Eğlence
    "müzik", "dizi", "film", "oscar", "grammy", "konsert", "ödül töreni",
    "celebrity", "movie", "album", "fashion", "recipe",
]

# Türkçe varlık tespiti
ASSET_MAP = {
    "Bitcoin":  ["bitcoin", "btc", "kripto", "cryptocurrency", "crypto"],
    "Ethereum": ["ethereum", "eth"],
    "Altın":    ["altın", "gold", "xau", "ons altın"],
    "Petrol":   ["petrol", "doğalgaz", "enerji", "oil", "crude", "brent", "wti"],
    "USD/TRY":  ["dolar", "usd", "usd/try", "kur", "turkey", "turkish", "lira"],
    "BIST 100": ["bist", "borsa", "borsa istanbul", "xu100"],
    "Euro":     ["euro", "eur", "avro"],
    "ASELSAN":  ["aselsan", "savunma sanayi", "nato", "defense", "military"],
    "THY":      ["türk hava yolları", "thy", "turkish airlines"],
}

RISK_KEYWORDS = {
    "high":   ["savaş", "kriz", "çöküş", "saldırı", "gerilim", "yaptırım", "kaos",
               "war", "crisis", "crash", "collapse", "attack", "sanction", "tension"],
    "medium": ["enflasyon", "faiz", "belirsizlik", "volatilite", "uyarı", "endişe",
               "inflation", "rate", "uncertainty", "risk", "concern", "warning"],
    "low":    ["büyüme", "iyimserlik", "artış", "toparlanma", "anlaşma",
               "growth", "optimism", "recovery", "deal", "agreement"],
}


def _strip_html(text: str) -> str:
    text = re.sub(r"<!\[CDATA\[|\]\]>", "", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _detect_risk(text: str) -> str:
    t = text.lower()
    for level in ("high", "medium", "low"):
        if any(k in t for k in RISK_KEYWORDS[level]):
            return level
    return "medium"


def _detect_assets(text: str) -> list[str]:
    t = text.lower()
    found = [asset for asset, kws in ASSET_MAP.items() if any(k in t for k in kws)]
    return found or ["BIST 100", "USD/TRY"]


def _is_excluded(title: str, desc: str) -> bool:
    t = (title + " " + desc).lower()
    return any(k in t for k in _EXCLUDE_KEYWORDS)


def _is_relevant_en(title: str, desc: str) -> bool:
    """İngilizce feed'ler için finansal ilgililik kontrolü."""
    FINANCE_KW = [
        "market", "stock", "economy", "inflation", "interest rate", "fed",
        "bitcoin", "crypto", "gold", "oil", "dollar", "euro", "trade",
        "central bank", "recession", "rate", "tariff", "gdp", "earnings",
        "turkey", "emerging", "geopolit", "war", "conflict", "sanction",
    ]
    t = (title + " " + desc).lower()
    return any(k in t for k in FINANCE_KW)


def _parse_date(date_str: str) -> str:
    try:
        dt = parsedate_to_datetime(date_str)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


def _find_items(root: ET.Element) -> list[ET.Element]:
    items = root.findall(".//item")
    if not items:
        items = (root.findall(".//{http://www.w3.org/2005/Atom}entry") or [])
    return items


def _get_text(element: ET.Element, *tags: str) -> str:
    for tag in tags:
        val = element.findtext(tag) or ""
        val = _strip_html(val).strip()
        if val:
            return val
    return ""


async def _fetch_rss(feed: dict) -> list[dict]:
    lang = feed.get("lang", "en")
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(
                feed["url"],
                headers={"User-Agent": "Mozilla/5.0 (compatible; PiyasaNabziBot/1.0)"},
            )
            resp.raise_for_status()
            root = ET.fromstring(resp.content)
    except Exception as exc:
        print(f"[rss] {feed['source']} çekilemedi: {exc}")
        return []

    items   = _find_items(root)
    results = []

    for item in items[:12]:
        title = _get_text(item, "title")
        desc  = _get_text(item, "description", "summary",
                          "{http://www.w3.org/2005/Atom}summary",
                          "{http://www.w3.org/2005/Atom}content")
        link  = (item.findtext("link") or
                 item.findtext("{http://www.w3.org/2005/Atom}link") or "").strip()
        pub   = (item.findtext("pubDate") or
                 item.findtext("published") or
                 item.findtext("{http://www.w3.org/2005/Atom}published") or "")

        if not title:
            continue
        if _is_excluded(title, desc):
            continue
        # İngilizce kaynaklar için ek finans filtresi
        if lang == "en" and not _is_relevant_en(title, desc):
            continue
        if not desc:
            desc = title

        results.append({
            "title":           title,
            "description":     desc[:400],
            "url":             link,
            "published_at":    _parse_date(pub),
            "source":          feed["source"],
            "lang":            lang,
            "risk_level":      _detect_risk(title + " " + desc),
            "affected_assets": _detect_assets(title + " " + desc),
        })

    return results


async def fetch_rss_news() -> list[dict]:
    tasks   = [_fetch_rss(f) for f in RSS_FEEDS]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    articles = []
    for r in results:
        if isinstance(r, list):
            articles.extend(r)

    articles.sort(key=lambda x: x["published_at"], reverse=True)

    # Tekrar eden başlıkları kaldır
    seen:   set[str] = set()
    unique: list[dict] = []
    for a in articles:
        key = a["title"].lower()[:60]
        if key not in seen:
            seen.add(key)
            unique.append(a)

    print(f"[rss] {len(unique)} benzersiz haber "
          f"({sum(1 for a in unique if a.get('lang')=='tr')} TR / "
          f"{sum(1 for a in unique if a.get('lang')=='en')} EN)")
    return unique[:20]
