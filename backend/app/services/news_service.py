"""
Haber sinyalleri — RSS çekimi + DeepL çevirisi + Gemini finansal analizi
Pipeline:
  1. RSS → İngilizce ham makaleler
  2. Zenginleştirme cache kontrolü → sadece görülmemiş makaleler işlenir
  3. DeepL (paralel) → tr_title, tr_summary
  4. Gemini (paralel) → gemini_comment, affected_assets, impact_direction, risk_level, confidence
  5. Sonuçlar kalıcı bellek cache'ine yazılır → aynı başlık bir daha işlenmez

Cache key = sha256(lowercase_title)[:20]
  Neden başlık? RSS feed'leri bazen aynı makalenin URL'sini günceller;
  başlık ise değişmez → daha stabil anahtar.
"""
import asyncio
import hashlib
from collections import OrderedDict
from time import time
from datetime import datetime, timezone

from app.config import settings
from app.models.schemas import NewsSignal, RiskLevel
from app.services.rss_service import fetch_rss_news

# ── TTL Cache: /api/news-signals endpoint'i çok sık çağrıldığında RSS'i tekrar çekme ──
_rss_cache: list | None = None
_rss_cache_ts: float = 0.0
_RSS_TTL = 90  # saniye

# ── Kalıcı zenginleştirme cache'i ─────────────────────────────────────────────
# key  : sha256(başlık.lower())[:20]
# value: {tr_title, tr_summary, gemini_comment, affected_assets,
#         impact_direction, risk_level, confidence}
# OrderedDict → en eski girişi silerek boyutu sınırla (LRU-lite)
_enrichment_cache: OrderedDict[str, dict] = OrderedDict()
_ENRICHMENT_CACHE_MAX = 500  # makale sayısı


def _cache_key(article: dict) -> str:
    """
    Makale için kararlı cache anahtarı.
    Sadece başlığa dayanır — URL bazı feed'lerde değişebilir, başlık sabittir.
    """
    raw = article.get("title", "").lower().strip().encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:20]


def _cache_put(key: str, value: dict) -> None:
    """Cache'e yazar; maksimum boyutu aşarsa en eski girişi siler."""
    if key in _enrichment_cache:
        _enrichment_cache.move_to_end(key)
    _enrichment_cache[key] = value
    while len(_enrichment_cache) > _ENRICHMENT_CACHE_MAX:
        _enrichment_cache.popitem(last=False)  # en eskiyi sil


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Mock verisi (USE_MOCK_DATA=true veya RSS başarısız olduğunda) ───────────────
MOCK_NEWS: list[NewsSignal] = [
    NewsSignal(
        id="news-001",
        title="Fed Interest Rate Decision: Below Expectations",
        summary="The US Federal Reserve unexpectedly kept interest rates unchanged.",
        source="Mock", published_at=_now_iso(),
        affected_assets=["Bitcoin", "BIST 100", "USD/TRY"],
        risk_level=RiskLevel.medium,
        market_impact="Simülasyon amaçlıdır.",
        tr_title="Fed Faiz Kararı: Beklentilerin Altında Kaldı",
        tr_summary="ABD Merkez Bankası beklentilerin aksine faiz oranlarını sabit tuttu. Bu karar gelişmekte olan piyasalar için kısa vadeli rahatlama sinyali veriyor.",
        gemini_comment="Fed'in beklenmedik faiz kararı dolar değer kaybına, gelişmekte olan piyasalara fon girişine yol açabilir. BIST ve kripto varlıklar kısa vadede pozitif etki yaratabilir.",
        impact_direction="pozitif",
        confidence="medium",
    ),
    NewsSignal(
        id="news-002",
        title="Middle East Tensions: Impact on Energy Prices",
        summary="Escalating regional conflicts may negatively impact oil supply.",
        source="Mock", published_at=_now_iso(),
        affected_assets=["Altın", "BIST 100", "Petrol"],
        risk_level=RiskLevel.high,
        market_impact="Simülasyon amaçlıdır.",
        tr_title="Orta Doğu Gerilimi: Enerji Fiyatlarına Yansıma",
        tr_summary="Bölgedeki çatışmaların tırmanması petrol arzını olumsuz etkileyebilir. Altın güvenli liman olarak öne çıkıyor.",
        gemini_comment="Jeopolitik risk artışı altın ve petrolde yukarı yönlü baskı oluşturabilir. BIST ihracatçı şirketler olumlu ayrışabilirken enerji ithalatçısı sektörler baskılanabilir.",
        impact_direction="karışık",
        confidence="high",
    ),
    NewsSignal(
        id="news-003",
        title="Turkey Inflation Data Released",
        summary="Annual inflation came in above expectations, policy uncertainty continues.",
        source="Mock", published_at=_now_iso(),
        affected_assets=["USD/TRY", "BIST 100", "Altın"],
        risk_level=RiskLevel.high,
        market_impact="Simülasyon amaçlıdır.",
        tr_title="Türkiye Enflasyon Verisi Açıklandı",
        tr_summary="Yıllık enflasyon beklentilerin üzerinde geldi. Merkez Bankası politika faizine ilişkin belirsizlik sürüyor.",
        gemini_comment="Beklenti üzeri enflasyon TL üzerindeki baskıyı artırabilir. Döviz bazlı varlıklar ve altın talep görebilirken BIST'te sektörel ayrışma yaşanabilir.",
        impact_direction="negatif",
        confidence="high",
    ),
    NewsSignal(
        id="news-004",
        title="Bitcoin ETF Approvals Increasing",
        summary="Institutional demand growth expectations are being priced in.",
        source="Mock", published_at=_now_iso(),
        affected_assets=["Bitcoin", "Ethereum"],
        risk_level=RiskLevel.medium,
        market_impact="Simülasyon amaçlıdır.",
        tr_title="Bitcoin ETF Onayları Artıyor",
        tr_summary="Kurumsal talep artışı beklentisi piyasada fiyatlanıyor.",
        gemini_comment="ETF onay haberleri Bitcoin'de kurumsal fon girişi beklentisi oluşturabilir. Volatilite yüksek kalmaya devam edebilir; pozisyon açılmadan önce risk yönetimi kritik.",
        impact_direction="pozitif",
        confidence="medium",
    ),
    NewsSignal(
        id="news-005",
        title="Defense Spending Rising: NATO Decision",
        summary="NATO members commit to increasing defense budgets.",
        source="Mock", published_at=_now_iso(),
        affected_assets=["ASELSAN", "BIST 100"],
        risk_level=RiskLevel.low,
        market_impact="Simülasyon amaçlıdır.",
        tr_title="Savunma Sanayii Harcamaları Artıyor: NATO Kararı",
        tr_summary="NATO üyesi ülkelerin savunma bütçelerini artırma kararı Türk savunma sanayiine ilgi çekiyor.",
        gemini_comment="NATO savunma harcama taahhütleri Türk savunma sanayii şirketlerinde (ASELSAN, ROKETSAN) sipariş beklentisi oluşturabilir. Haber akışına duyarlılık artabilir.",
        impact_direction="pozitif",
        confidence="low",
    ),
]


def _apply_cache(article: dict) -> dict:
    """Varsa cache'ten zenginleştirme verilerini makaleye uygula."""
    key = _cache_key(article)
    cached = _enrichment_cache.get(key)
    if cached:
        article.update(cached)
    return article


def _rss_to_signal(article: dict, idx: int) -> NewsSignal:
    try:
        risk = RiskLevel(article.get("risk_level", "medium"))
    except ValueError:
        risk = RiskLevel.medium

    # Türkçe başlık varsa onu, yoksa orijinali kullan
    title   = article.get("tr_title")   or article.get("title", "")
    summary = article.get("tr_summary") or article.get("description") or article.get("summary") or title

    return NewsSignal(
        id=f"rss-{idx:04d}",
        title=title,
        summary=summary,
        source=article.get("source", "RSS"),
        published_at=article.get("published_at", _now_iso()),
        affected_assets=article.get("affected_assets", ["BIST 100"]),
        risk_level=risk,
        market_impact="Piyasa etkisi simülasyon amaçlı değerlendirilmektedir.",
        url=article.get("url"),
        tr_title=article.get("tr_title", ""),
        tr_summary=article.get("tr_summary", ""),
        gemini_comment=article.get("gemini_comment", ""),
        impact_direction=article.get("impact_direction", "nötr"),
        confidence=article.get("confidence", "medium"),
    )


async def _enrich_uncached(articles: list[dict]) -> None:
    """
    Cache'te olmayan makaleleri DeepL + Gemini ile paralel zenginleştirir,
    sonuçları _enrichment_cache'e yazar.
    """
    if not articles:
        return

    # DeepL ve Gemini'yi paralel başlat
    deepl_task   = _run_deepl(articles)
    gemini_task  = _run_gemini(articles)

    await asyncio.gather(deepl_task, gemini_task, return_exceptions=True)

    # Sonuçları kalıcı cache'e yaz
    for article in articles:
        key = _cache_key(article)
        _cache_put(key, {
            "tr_title":         article.get("tr_title", ""),
            "tr_summary":       article.get("tr_summary", ""),
            "gemini_comment":   article.get("gemini_comment", ""),
            "affected_assets":  article.get("affected_assets", []),
            "impact_direction": article.get("impact_direction", "nötr"),
            "risk_level":       article.get("risk_level", "medium"),
            "confidence":       article.get("confidence", "medium"),
        })
    print(f"[news:cache] {len(articles)} makale zenginleştirildi ve cache'e yazıldı."
          f" Toplam cache: {len(_enrichment_cache)} makale.")


async def _run_deepl(articles: list[dict]) -> None:
    """DeepL ile başlık ve özetleri Türkçeye çevirir (in-place günceller)."""
    if not settings.DEEPL_API_KEY:
        return
    try:
        from app.services.deepl_service import translate_articles
        await asyncio.wait_for(translate_articles(articles), timeout=15.0)
    except Exception as exc:
        print(f"[news] DeepL çeviri atlandı: {exc}")


async def _run_gemini(articles: list[dict]) -> None:
    """Gemini ile finansal zenginleştirme yapar (in-place günceller)."""
    if not settings.GEMINI_API_KEY:
        return
    try:
        from app.services.gemini_service import enrich_financial_batch
        await asyncio.wait_for(enrich_financial_batch(articles), timeout=25.0)
    except Exception as exc:
        print(f"[news] Gemini finansal analiz atlandı: {exc}")


async def get_news_signals() -> list[NewsSignal]:
    """
    Tam pipeline: RSS + DeepL çevirisi + Gemini finansal analizi.
    /api/news-signals endpoint'i ve 5dk'lık arka plan yenileme tarafından çağrılır.
    İlk yüklemede ~3-5s, sonrasında cache'ten anında döner.
    """
    global _rss_cache, _rss_cache_ts

    if settings.USE_MOCK_DATA:
        return MOCK_NEWS

    # RSS cache kontrolü — 90s içinde tekrar işleme
    if _rss_cache is not None and (time() - _rss_cache_ts) < _RSS_TTL:
        return _rss_cache

    try:
        articles = await fetch_rss_news()
        if not articles:
            return MOCK_NEWS

        uncached  = [a for a in articles if _cache_key(a) not in _enrichment_cache]
        hit_count = len(articles) - len(uncached)

        if uncached:
            print(f"[news:cache] {hit_count} makale cache'ten · "
                  f"{len(uncached)} yeni makale → DeepL + Gemini başlatılıyor…")
            await _enrich_uncached(uncached)
        else:
            print(f"[news:cache] Tüm {hit_count} makale cache'ten geldi — "
                  f"DeepL ve Gemini çağrılmadı. ✓")

        for article in articles:
            _apply_cache(article)

        signals = _build_signals(articles)
        _rss_cache    = signals
        _rss_cache_ts = time()
        return signals

    except Exception as exc:
        print(f"[news] Haber yükleme hatası: {exc}")
        return MOCK_NEWS


async def get_news_signals_quick() -> list[NewsSignal]:
    """
    Hızlı versiyon — sadece AI analiz stream'i için.
    DeepL/Gemini ÇAĞIRMAZ; mevcut cache'i kullanır.

    Öncelik:
      1. _rss_cache geçerliyse anında döner (0ms)
      2. RSS çek (~1s) + mevcut _enrichment_cache uygula (Gemini yok)
      3. Hata → MOCK_NEWS
    """
    if settings.USE_MOCK_DATA:
        return MOCK_NEWS

    # Geçerli cache varsa hemen dön
    if _rss_cache is not None and (time() - _rss_cache_ts) < _RSS_TTL:
        return _rss_cache

    try:
        articles = await fetch_rss_news()
        if not articles:
            return MOCK_NEWS

        # Enrichment cache'ten ne varsa uygula — yeni çağrı YOK
        for article in articles:
            _apply_cache(article)

        cached_count = sum(1 for a in articles if _cache_key(a) in _enrichment_cache)
        print(f"[news:quick] {cached_count}/{len(articles)} makale cache'ten, "
              f"zenginleştirme beklenmedi.")

        return _build_signals(articles)

    except Exception as exc:
        print(f"[news:quick] Hata: {exc}")
        return MOCK_NEWS


def _build_signals(articles: list[dict]) -> list[NewsSignal]:
    """Article listesini NewsSignal listesine dönüştürür; hatalı makaleler atlanır."""
    signals = []
    for i, article in enumerate(articles):
        try:
            signals.append(_rss_to_signal(article, i))
        except Exception as exc:
            print(f"[news] Makale #{i} dönüştürme hatası: {exc}")
    return signals
