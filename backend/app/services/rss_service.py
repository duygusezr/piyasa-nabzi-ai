"""
RSS Haber Servisi — Finansı etkileyen haberler için özelleştirilmiş kaynaklar.
Kelime sınırı (_word_in) ile kısmi eşleşmeler engellenir:
  "gözaltına" → "altın" içeriyor ama kelime değil → eşleşmez.

Kaynaklar (öncelik sırasıyla):
  1. Investing.com TR  — borsa, kripto, döviz, emtia, makro ekonomi (tamamen finans)
  2. Bloomberg HT       — Türkiye finans & piyasa haberleri
  3. NTV Ekonomi        — Türkiye ekonomi haberleri
  4. AA Ekonomi         — Anadolu Ajansı ekonomi
  5. TRT Haber Ekonomi  — kamu yayıncısı ekonomi haberleri
  6. TRT Haber Dünya    — jeopolitik / savaş (finans filtresi uygulanır)
  7. AA Dünya           — dünya haberleri (finans filtresi uygulanır)
  8. CNBC               — küresel makro / Fed / emtia (İngilizce → DeepL)

Finans Filtresi:
  Tüm haberler _is_finance_impacting() fonksiyonundan geçer.
  Finans/ekonomi/jeopolitik anahtar kelimesi içermeyenler kaldırılır.
"""
import asyncio
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import httpx

# ── Kelime sınırı yardımcısı ───────────────────────────────────────────────────
_TR_CHARS = r'a-zA-Z0-9ğüşıöçĞÜŞİÖÇ'
_WORD_IN_CACHE: dict[str, re.Pattern] = {}

def _word_in(keyword: str, text: str) -> bool:
    """
    Türkçe'ye uyumlu kelime sınırı eşleşmesi.
    "altın" kelimesi "gözaltına" içinde EŞLEŞMEZ.
    Hem ASCII hem Türkçe harfler sözcük karakteri sayılır.
    """
    if keyword not in _WORD_IN_CACHE:
        pattern = r'(?<![' + _TR_CHARS + r'])' + re.escape(keyword) + r'(?![' + _TR_CHARS + r'])'
        _WORD_IN_CACHE[keyword] = re.compile(pattern, re.IGNORECASE)
    return bool(_WORD_IN_CACHE[keyword].search(text))

RSS_FEEDS = [
    # ── Tamamen Finans — Filtreye gerek yok ──────────────────────────────────
    {"url": "https://tr.investing.com/rss/news.rss",              "source": "Investing.com TR",  "lang": "tr", "finance_only": True},
    {"url": "https://tr.investing.com/rss/news_301.rss",          "source": "Investing.com TR",  "lang": "tr", "finance_only": True},  # Kripto
    {"url": "https://tr.investing.com/rss/news_8.rss",            "source": "Investing.com TR",  "lang": "tr", "finance_only": True},  # Emtia
    {"url": "https://tr.investing.com/rss/news_25.rss",           "source": "Investing.com TR",  "lang": "tr", "finance_only": True},  # Döviz/Forex
    {"url": "https://www.bloomberght.com/rss",                    "source": "Bloomberg HT",      "lang": "tr", "finance_only": True},
    {"url": "https://www.ntv.com.tr/ekonomi.rss",                 "source": "NTV Ekonomi",       "lang": "tr", "finance_only": True},
    {"url": "https://www.aa.com.tr/tr/rss/ekonomi",               "source": "AA Ekonomi",        "lang": "tr", "finance_only": True},
    {"url": "https://www.trthaber.com/ekonomi.rss",               "source": "TRT Haber",         "lang": "tr", "finance_only": True},
    # ── Dünya Haberleri — Finans filtresi uygulanır ───────────────────────────
    {"url": "https://www.trthaber.com/sondakika.rss",             "source": "TRT Haber",         "lang": "tr", "finance_only": False},
    {"url": "https://www.trthaber.com/dunya.rss",                 "source": "TRT Haber",         "lang": "tr", "finance_only": False},
    {"url": "https://www.aa.com.tr/tr/rss/dunya",                 "source": "AA Dünya",          "lang": "tr", "finance_only": False},
    # ── İngilizce — Küresel makro / Fed / emtia (DeepL ile çevrilir) ─────────
    {"url": "https://www.cnbc.com/id/10001147/device/rss/rss.html", "source": "CNBC",            "lang": "en", "finance_only": False},
]

# ── Tamamen çıkarılacak konular ────────────────────────────────────────────────
_EXCLUDE_KEYWORDS = [
    # Spor
    "futbol", "basketbol", "voleybol", "formula 1", "şampiyonluk",
    "maç sonucu", "gol attı", "penaltı", "nba", "nfl", "soccer", "tenis", "atletizm",
    "liga maç", "süper lig", "champions league", "world cup", "formula 1",
    "olimpiyat", "olimpiyatlar", "spor kulübü",
    # Magazin/Eğlence
    "müzik", "dizi", "film yapım", "oscar ödül", "grammy", "konser", "ödül töreni",
    "celebrity", "movie", "album", "fashion", "recipe", "magazin",
    "oyuncu", "şarkıcı", "manken", "model",
    # Sağlık / Yaşam (piyasayla ilgisi olmayan)
    "diyet", "kilo verme", "sağlık tüyoları",
    "annelik", "anneler günü", "anne günü", "hamilelik", "bebek bakım",
    "kuşakta annelik", "anneler anlatıyor",
    # Suç / Adliye (finans dışı)
    "gözaltına alındı", "gözaltı alındı", "tutuklama kararı",
    "tutuklandı", "mahkûm edildi", "hapis cezası", "cinayet", "hırsızlık",
    "uyuşturucu operasyon", "kaçakçılık operasyon", "terör operasyon",
    "polis operasyon", "jandarma operasyon",
    # Teknoloji (finans dışı)
    "oyun haberleri", "gaming", "sosyal medya trendi", "tiktok trend",
    # Siyaset (ekonomiyle ilgisiz)
    "belediye operasyon", "ibb operasyon", "rüşvet operasyon",
    "seçim kampanya", "parti kongresi", "milletvekili seçim",
]

# ── Finansı etkileyen anahtar kelimeler — her kategoriden ─────────────────────
_FINANCE_KEYWORDS = [
    # Kripto varlıklar
    "bitcoin", "ethereum", "btc", "eth", "kripto", "crypto", "blockchain",
    "nft", "defi", "stablecoin", "altcoin", "binance", "coinbase",
    # Altın & Emtia
    "altın", "gold", "gümüş", "silver", "petrol", "oil", "brent", "wti",
    "doğalgaz", "natural gas", "ons", "emtia", "commodity", "bakır", "copper",
    "demir cevheri", "iron ore", "buğday", "wheat",
    # Borsa & Hisse Senetleri
    "borsa", "bist", "hisse", "imkb", "xu100", "xu030", "endeks",
    "stock", "shares", "equity", "s&p", "nasdaq", "dow jones",
    "aselsan", "thyao", "garan", "akbnk", "kchol", "tuprs",
    "sise", "bimas", "froto", "eregl", "roketsan", "havelsan",
    # Döviz / Forex
    "dolar", "dollar", "usd", "euro", "eur", "sterlin", "gbp",
    "döviz", "kur", "forex", "fx", "lira", "try", "dolar/tl", "usd/try",
    "yuan", "yen", "ruble", "çin yuanı",
    # Makroekonomi & Merkez Bankaları
    "enflasyon", "inflation", "faiz", "interest rate", "tcmb",
    "fed", "ecb", "boe", "merkez bankası", "central bank",
    "para politikası", "monetary policy", "büyüme", "gdp", "gsyih",
    "işsizlik", "unemployment", "istihdam", "employment",
    "bütçe", "budget", "borç", "debt", "hazine", "treasury",
    "tüfe", "üfe", "cpi", "ppi", "resesyon", "recession",
    "stagflasyon", "stagflation", "deflasyon", "deflation",
    # KAP / Şirket Haberleri
    "bilanço", "earnings", "temettü", "dividend", "kap ", "kamuoyu",
    "özel durum", "halka arz", "ipo", "satın alma", "birleşme",
    "acquisition", "merger", "sözleşme", "ihale", "contract",
    "yatırım", "investment", "fon", "fund", "portföy", "portfolio",
    # Enerji & Kaynak Politikası
    "opec", "enerji", "energy", "nükleer", "nuclear", "yenilenebilir",
    "renewable", "elektrik fiyatı", "doğalgaz fiyatı",
    # Jeopolitik (Piyasaları etkileyen)
    "savaş", "war", "çatışma", "conflict", "yaptırım", "sanction",
    "gümrük", "tariff", "ticaret savaşı", "trade war",
    "jeopolitik", "geopolit", "rusya", "russia", "ukrayna", "ukraine",
    "çin", "china", "iran", "orta doğu", "middle east", "körfez",
    "nato", "g7", "g20", "imf", "dünya bankası", "world bank",
    # Türkiye Özeli
    "türkiye ekonomi", "türk ekonomi", "türkiye büyüme",
    "türkiye enflasyon", "merkez bankası faiz", "tcmb faiz",
    "piyasa", "market", "ihracat", "export", "ithalat", "import",
    "cari açık", "current account", "dış ticaret",
]


# ── Yardımcı fonksiyonlar ──────────────────────────────────────────────────────

def _strip_html(text: str) -> str:
    text = re.sub(r"<!\[CDATA\[|\]\]>", "", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _is_excluded(title: str, desc: str) -> bool:
    """Kesinlikle finans dışı konular → at."""
    t = (title + " " + desc).lower()
    return any(k in t for k in _EXCLUDE_KEYWORDS)


def _is_finance_impacting(title: str, desc: str) -> bool:
    """
    Haberin finansı/ekonomiyi/jeopolitiği etkileyip etkilemediğini kontrol eder.
    Kelime sınırı eşleşmesi kullanır → "gözaltına" ≠ "altın".
    En az 1 finans anahtar kelimesi gerekir.
    """
    t = (title + " " + desc).lower()
    return any(_word_in(k, t) for k in _FINANCE_KEYWORDS)


# ── Varlık & Risk tespiti ──────────────────────────────────────────────────────

ASSET_MAP = {
    "Bitcoin":  ["bitcoin", "btc", "kripto", "cryptocurrency", "crypto"],
    "Ethereum": ["ethereum", "eth"],
    "Altın":    ["altın", "gold", "xau", "ons altın"],
    "Petrol":   ["petrol", "doğalgaz", "enerji", "oil", "crude", "brent", "wti", "opec"],
    "USD/TRY":  ["dolar", "usd", "usd/try", "kur", "döviz", "lira", "turkey", "turkish"],
    "BIST 100": ["bist", "borsa", "borsa istanbul", "xu100", "imkb"],
    "Euro":     ["euro", "eur", "avro"],
    "ASELSAN":  ["aselsan", "savunma sanayi", "nato", "defense", "military", "roketsan"],
    "THY":      ["türk hava yolları", "thy", "turkish airlines"],
    "Tahvil":   ["tahvil", "faiz", "bond", "hazine bonosu", "eurobond"],
}

RISK_KEYWORDS = {
    "high":   ["savaş", "kriz", "çöküş", "saldırı", "gerilim", "yaptırım", "kaos",
               "war", "crisis", "crash", "collapse", "attack", "sanction", "tension",
               "füze", "bomba", "işgal", "invasion", "nükleer", "nuclear"],
    "medium": ["enflasyon", "faiz", "belirsizlik", "volatilite", "uyarı", "endişe",
               "inflation", "rate", "uncertainty", "risk", "concern", "warning",
               "durgunluk", "recession", "düşüş", "decline", "kayıp", "loss"],
    "low":    ["büyüme", "iyimserlik", "artış", "toparlanma", "anlaşma",
               "growth", "optimism", "recovery", "deal", "agreement",
               "yükseliş", "rally", "kazanç", "gain"],
}


def _detect_risk(text: str) -> str:
    t = text.lower()
    for level in ("high", "medium", "low"):
        if any(_word_in(k, t) for k in RISK_KEYWORDS[level]):
            return level
    return "medium"


def _detect_assets(text: str) -> list[str]:
    """Kelime sınırı eşleşmesiyle varlık tespiti — kısmi eşleşme yok."""
    t = text.lower()
    found = [asset for asset, kws in ASSET_MAP.items() if any(_word_in(k, t) for k in kws)]
    return found or ["BIST 100", "USD/TRY"]


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


# ── RSS çekimi ─────────────────────────────────────────────────────────────────

async def _fetch_rss(feed: dict) -> list[dict]:
    lang = feed.get("lang", "tr")
    finance_only = feed.get("finance_only", False)

    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(
                feed["url"],
                headers={"User-Agent": "Mozilla/5.0 (compatible; PiyasaNabziBot/1.0)"},
            )
            resp.raise_for_status()
            root = ET.fromstring(resp.content)
    except Exception as exc:
        print(f"[rss] {feed['source']} ({feed['url']}) çekilemedi: {exc}")
        return []

    items   = _find_items(root)
    results = []

    for item in items[:15]:  # feed başına en fazla 15 makale al
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

        # 1. Çöp filtresi (spor, magazin vb.)
        if _is_excluded(title, desc):
            continue

        # 2. Finans etkisi filtresi (finance_only=False olan kaynaklara uygulanır)
        if not finance_only and not _is_finance_impacting(title, desc):
            continue

        if not desc:
            desc = title

        results.append({
            "title":           title,
            "description":     desc[:450],
            "url":             link,
            "published_at":    _parse_date(pub),
            "source":          feed["source"],
            "lang":            lang,
            "risk_level":      _detect_risk(title + " " + desc),
            "affected_assets": _detect_assets(title + " " + desc),
        })

    return results


async def fetch_rss_news() -> list[dict]:
    """
    Tüm RSS kaynaklarını paralel çeker.
    Sonuçlar tarihe göre sıralanır, tekrarlar kaldırılır.
    Sadece finansı etkileyen haberler döner.
    """
    tasks   = [_fetch_rss(f) for f in RSS_FEEDS]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    articles: list[dict] = []
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

    tr_count = sum(1 for a in unique if a.get("lang") == "tr")
    en_count = sum(1 for a in unique if a.get("lang") == "en")
    print(f"[rss] {len(unique)} finansal haber "
          f"({tr_count} TR / {en_count} EN) — "
          f"{len(articles) - len(unique)} tekrar kaldırıldı.")
    return unique[:40]  # CollectAPI fallback → daha geniş havuz
