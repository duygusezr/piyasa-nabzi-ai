"""
CollectAPI Haber Servisi — Türkçe haberler, çeviri gerektirmez, ~300-600ms
Doküman: https://collectapi.com/api/news/news-api
Tag seçenekleri: general, economy, finance, world, technology, health, sport

Pipeline: CollectAPI → finans filtresi → doğrudan Türkçe başlık/özet → NewsSignal
DeepL'e gerek yok → get_news_signals_quick() için ideal birincil kaynak
"""
import asyncio
import logging
from datetime import datetime, timezone

import httpx

from app.config import settings
from app.services.rss_service import (
    ASSET_MAP, RISK_KEYWORDS,
    _is_excluded, _is_finance_impacting, _detect_risk, _detect_assets,
)

logger = logging.getLogger(__name__)

# Finans/ekonomi odaklı tag'ler
_TAGS = ["economy", "finance", "world"]
_MAX_PER_TAG = 20   # tag başına maksimum haber (daha fazla → filtreden sonra yeterli kalır)
_TIMEOUT     = 8.0  # saniye

# CollectAPI'de "economy" tag'i altında gelen ama finans dışı kaynaklar
# Bu kaynaklardan gelen haberler sıkı finans filtresine tabi tutulur
_NON_FINANCE_SOURCES = {
    "bbc gündem", "bbc türkçe", "bbc", "sabah gündem", "hürriyet gündem",
    "milliyet gündem", "sözcü gündem", "posta", "takvim",
}


def _parse_date(date_str: str | None) -> str:
    if not date_str:
        return datetime.now(timezone.utc).isoformat()
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


async def _fetch_tag(tag: str) -> list[dict]:
    """Tek bir tag için CollectAPI'dan haber çeker."""
    if not settings.COLLECTAPI_KEY:
        return []

    headers = {
        "content-type":  "application/json",
        "authorization": f"apikey {settings.COLLECTAPI_KEY}",
    }
    params = {"country": "tr", "tag": tag}

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                settings.COLLECTAPI_URL,
                headers=headers,
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("[collectapi] tag=%s çekilemedi: %s", tag, exc)
        return []

    if not data.get("success"):
        logger.warning("[collectapi] tag=%s — API başarısız: %s", tag, data)
        return []

    articles = []
    for item in data.get("result", [])[:_MAX_PER_TAG]:
        title   = (item.get("name") or "").strip()
        desc    = (item.get("description") or title).strip()
        url     = (item.get("url") or "").strip()
        source  = (item.get("source") or "CollectAPI").strip()
        pub_raw = item.get("publishDate") or item.get("date") or ""

        if not title:
            continue

        # 1. Çöp filtresi (spor, magazin, suç/adliye vb.)
        if _is_excluded(title, desc):
            continue

        # 2. Finans etkisi filtresi — TÜM tag'lere uygulanır.
        #    CollectAPI'nin "economy" tag'i de zaman zaman finans dışı içerik verebilir
        #    (BBC Gündem, genel haber siteleri vb.)
        source_lower = source.lower()
        is_non_finance_source = any(s in source_lower for s in _NON_FINANCE_SOURCES)

        # Genel haber kaynağı VEYA world/general tag → sıkı filtre
        if is_non_finance_source or tag in ("world", "general"):
            if not _is_finance_impacting(title, desc):
                continue
        # economy/finance tag + bilinen finans kaynağı → yine de filtrele (ama daha toleranslı)
        elif not _is_finance_impacting(title, desc):
            continue

        articles.append({
            "title":           title,
            "description":     desc[:450],
            "url":             url,
            "published_at":    _parse_date(pub_raw),
            "source":          source,
            "lang":            "tr",          # CollectAPI TR → çeviri gerekmez
            "tr_title":        title,         # zaten Türkçe
            "tr_summary":      desc[:450],
            "risk_level":      _detect_risk(title + " " + desc),
            "affected_assets": _detect_assets(title + " " + desc),
        })

    return articles


async def fetch_collect_news() -> list[dict]:
    """
    Tüm tag'leri paralel çeker, tekrarları kaldırır, tarihe göre sıralar.
    Başarılı olursa ~300-600ms içinde Türkçe finansal haber döner.
    COLLECTAPI_KEY yoksa boş liste döner (RSS fallback devreye girer).
    """
    if not settings.COLLECTAPI_KEY:
        logger.debug("[collectapi] Key tanımlı değil, atlanıyor.")
        return []

    tasks   = [_fetch_tag(tag) for tag in _TAGS]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    articles: list[dict] = []
    for r in results:
        if isinstance(r, list):
            articles.extend(r)

    # Tekrar eden başlıkları kaldır
    seen:   set[str] = set()
    unique: list[dict] = []
    for a in articles:
        key = a["title"].lower()[:60]
        if key not in seen:
            seen.add(key)
            unique.append(a)

    unique.sort(key=lambda x: x["published_at"], reverse=True)

    logger.info("[collectapi] %d finansal haber çekildi (%d tag).",
                len(unique), len(_TAGS))
    return unique[:35]  # Daha fazla haber → frontend'de yeterli içerik
