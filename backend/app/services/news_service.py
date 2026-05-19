"""
Haber sinyalleri — RSS çekimi + DeepL çevirisi + Gemini finansal analizi
Pipeline:
  1. CollectAPI (birincil, ~300-600ms) veya RSS fallback
  2. Finans filtresi — sadece piyasaları etkileyen haberler
  3. Zenginleştirme cache kontrolü → sadece görülmemiş makaleler işlenir
  4. DeepL (paralel) → tr_title, tr_summary (İngilizce haberler için)
  5. Gemini (paralel) → gemini_comment, affected_assets, impact_direction, risk_level, confidence
  6. Sonuçlar kalıcı bellek cache'ine yazılır → aynı başlık bir daha işlenmez
  7. _last_known_signals → son başarılı çekim hafızada tutulur; hata olursa mock yerine o kullanılır

Cache key = sha256(lowercase_title)[:20]
  Neden başlık? RSS feed'leri bazen aynı makalenin URL'sini günceller;
  başlık ise değişmez → daha stabil anahtar.
"""
import asyncio
import hashlib
import logging
from collections import OrderedDict
from time import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

from app.config import settings
from app.models.schemas import NewsSignal, RiskLevel
from app.services.rss_service import fetch_rss_news, _word_in
from app.services.collect_api_service import fetch_collect_news

# ── TTL Cache: /api/news-signals endpoint'i çok sık çağrıldığında RSS'i tekrar çekme ──
_rss_cache: list | None = None
_rss_cache_ts: float = 0.0
_RSS_TTL = 300  # saniye (5 dakika — CollectAPI rate limit ve Gemini çağrı sayısını azaltır)

# ── Son başarılı çekim hafızası ────────────────────────────────────────────────
# Herhangi bir API/RSS hatası olduğunda MOCK_NEWS yerine son gerçek veriler döner.
# Process restart'ta sıfırlanır (tasarım gereği — in-memory).
_last_known_signals: list = []

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


# ── Son çare mock verisi ───────────────────────────────────────────────────────
# Yalnızca hiç gerçek veri çekilmediğinde (cold start + tüm kaynaklar başarısız) kullanılır.
# Normalde _last_known_signals bu görevi üstlenir.
MOCK_NEWS: list[NewsSignal] = [
    NewsSignal(
        id="mock-001",
        title="Fed Faiz Kararı: Beklentilerin Altında Kaldı",
        summary="ABD Merkez Bankası beklentilerin aksine faiz oranlarını sabit tuttu.",
        source="Önbellek", published_at=_now_iso(),
        affected_assets=["Bitcoin", "BIST 100", "USD/TRY"],
        risk_level=RiskLevel.medium,
        market_impact="Piyasa etkisi simülasyon amaçlı değerlendirilmektedir.",
        tr_title="Fed Faiz Kararı: Beklentilerin Altında Kaldı",
        tr_summary="ABD Merkez Bankası beklentilerin aksine faiz oranlarını sabit tuttu. Bu karar gelişmekte olan piyasalar için kısa vadeli rahatlama sinyali veriyor.",
        gemini_comment="Fed'in beklenmedik faiz kararı dolar değer kaybına, gelişmekte olan piyasalara fon girişine yol açabilir. BIST ve kripto varlıklar kısa vadede pozitif etki yaratabilir.",
        impact_direction="pozitif",
        confidence="medium",
        category="Merkez Bankaları",
    ),
    NewsSignal(
        id="mock-002",
        title="Orta Doğu Gerilimi: Enerji Fiyatlarına Yansıma",
        summary="Bölgedeki çatışmaların tırmanması petrol arzını olumsuz etkileyebilir. Altın güvenli liman olarak öne çıkıyor.",
        source="Önbellek", published_at=_now_iso(),
        affected_assets=["Altın", "Petrol", "BIST 100"],
        risk_level=RiskLevel.high,
        market_impact="Piyasa etkisi simülasyon amaçlı değerlendirilmektedir.",
        tr_title="Orta Doğu Gerilimi: Enerji Fiyatlarına Yansıma",
        tr_summary="Bölgedeki çatışmaların tırmanması petrol arzını olumsuz etkileyebilir. Altın güvenli liman olarak öne çıkıyor.",
        gemini_comment="Jeopolitik risk artışı altın ve petrolde yukarı yönlü baskı oluşturabilir. BIST ihracatçı şirketler olumlu ayrışabilirken enerji ithalatçısı sektörler baskılanabilir.",
        impact_direction="karışık",
        confidence="high",
        category="Dünya Siyaseti",
    ),
    NewsSignal(
        id="mock-003",
        title="Türkiye Enflasyon Verisi Açıklandı",
        summary="Yıllık enflasyon beklentilerin üzerinde geldi. Merkez Bankası politika faizine ilişkin belirsizlik sürüyor.",
        source="Önbellek", published_at=_now_iso(),
        affected_assets=["USD/TRY", "BIST 100", "Altın"],
        risk_level=RiskLevel.high,
        market_impact="Piyasa etkisi simülasyon amaçlı değerlendirilmektedir.",
        tr_title="Türkiye Enflasyon Verisi Açıklandı",
        tr_summary="Yıllık enflasyon beklentilerin üzerinde geldi. Merkez Bankası politika faizine ilişkin belirsizlik sürüyor.",
        gemini_comment="Beklenti üzeri enflasyon TL üzerindeki baskıyı artırabilir. Döviz bazlı varlıklar ve altın talep görebilirken BIST'te sektörel ayrışma yaşanabilir.",
        impact_direction="negatif",
        confidence="high",
        category="Türkiye Ekonomisi",
    ),
    NewsSignal(
        id="mock-004",
        title="Bitcoin ETF Onayları Artıyor: Kurumsal Talep Güçleniyor",
        summary="Kurumsal yatırımcıların Bitcoin ETF'lerine talebi artıyor. Piyasa bu gelişmeyi fiyatlamaya başladı.",
        source="Önbellek", published_at=_now_iso(),
        affected_assets=["Bitcoin", "Ethereum"],
        risk_level=RiskLevel.medium,
        market_impact="Piyasa etkisi simülasyon amaçlı değerlendirilmektedir.",
        tr_title="Bitcoin ETF Onayları Artıyor: Kurumsal Talep Güçleniyor",
        tr_summary="Kurumsal yatırımcıların Bitcoin ETF'lerine talebi artıyor. Piyasa bu gelişmeyi fiyatlamaya başladı.",
        gemini_comment="ETF onay haberleri Bitcoin'de kurumsal fon girişi beklentisi oluşturabilir. Volatilite yüksek kalmaya devam edebilir; pozisyon açılmadan önce risk yönetimi kritik.",
        impact_direction="pozitif",
        confidence="medium",
        category="Kripto",
    ),
    NewsSignal(
        id="mock-005",
        title="NATO Savunma Harcamaları Artırıyor: Türk Savunma Sanayiine Talep",
        summary="NATO üyesi ülkelerin savunma bütçelerini artırma kararı Türk savunma sanayiine ilgi çekiyor.",
        source="Önbellek", published_at=_now_iso(),
        affected_assets=["ASELSAN", "BIST 100"],
        risk_level=RiskLevel.low,
        market_impact="Piyasa etkisi simülasyon amaçlı değerlendirilmektedir.",
        tr_title="NATO Savunma Harcamaları Artırıyor: Türk Savunma Sanayiine Talep",
        tr_summary="NATO üyesi ülkelerin savunma bütçelerini artırma kararı Türk savunma sanayiine ilgi çekiyor.",
        gemini_comment="NATO savunma harcama taahhütleri Türk savunma sanayii şirketlerinde (ASELSAN, ROKETSAN) sipariş beklentisi oluşturabilir. Haber akışına duyarlılık artabilir.",
        impact_direction="pozitif",
        confidence="low",
        category="Borsa İstanbul",
    ),
    NewsSignal(
        id="mock-006",
        title="Altın Fiyatı Rekor Kırdı: Güvenli Liman Talebi Güçleniyor",
        summary="Küresel belirsizlik ortamında altın ons fiyatı rekor seviyeye ulaştı. Merkez bankaları alımları sürüyor.",
        source="Önbellek", published_at=_now_iso(),
        affected_assets=["Altın", "USD/TRY"],
        risk_level=RiskLevel.medium,
        market_impact="Piyasa etkisi simülasyon amaçlı değerlendirilmektedir.",
        tr_title="Altın Fiyatı Rekor Kırdı: Güvenli Liman Talebi Güçleniyor",
        tr_summary="Küresel belirsizlik ortamında altın ons fiyatı rekor seviyeye ulaştı. Merkez bankaları alımları sürüyor.",
        gemini_comment="Merkez bankası alımları ve jeopolitik risk altın talebini destekliyor. TL bazlı gram altın da döviz hareketlerine paralel yukarı yönlü seyredebilir.",
        impact_direction="pozitif",
        confidence="high",
        category="Değerli Madenler",
    ),
    NewsSignal(
        id="mock-007",
        title="TCMB Faiz Kararı: Para Politikası Sıkılaşmaya Devam Ediyor",
        summary="Türkiye Merkez Bankası politika faizini beklentilerle uyumlu şekilde açıkladı. Enflasyonla mücadele sürecek.",
        source="Önbellek", published_at=_now_iso(),
        affected_assets=["USD/TRY", "BIST 100", "Altın"],
        risk_level=RiskLevel.medium,
        market_impact="Piyasa etkisi simülasyon amaçlı değerlendirilmektedir.",
        tr_title="TCMB Faiz Kararı: Para Politikası Sıkılaşmaya Devam Ediyor",
        tr_summary="Türkiye Merkez Bankası politika faizini beklentilerle uyumlu şekilde açıkladı. Enflasyonla mücadele sürecek.",
        gemini_comment="Faiz kararı piyasa beklentileriyle örtüştüğünde kısa vadeli aşırı oynaklık beklenmez. TL'de kısmi değer kazanımı görülebilir; sabit getirili araçlar öne çıkabilir.",
        impact_direction="nötr",
        confidence="medium",
        category="Merkez Bankaları",
    ),
]


def _detect_category(title: str, summary: str, source: str) -> str:
    """
    Haber başlığı ve kaynağa göre kategori belirle.
    Kelime sınırı eşleşmesi (_word_in) kullanır:
      "gözaltına" içindeki "altın" Değerli Madenler'e girdirilmez.
    """
    t = (title + " " + summary + " " + source).lower()

    def has(*kws: str) -> bool:
        return any(_word_in(k, t) for k in kws)

    if has("bitcoin", "ethereum", "kripto", "crypto", "btc", "eth", "sol", "bnb", "blockchain", "altcoin"):
        return "Kripto"
    if has("bist", "borsa istanbul", "xu100", "xu030", "hisse senedi", "hisse fiyat",
           "imkb", "aselsan", "thyao", "garan", "akbnk", "kchol", "tuprs", "sise", "bimas", "eregl"):
        return "Borsa İstanbul"
    if has("yatırım fonu", "portföy yönetimi", "tefas", "fon getiri", "fon yönetimi"):
        return "Fonlar"
    if has("altın fiyat", "gram altın", "ons altın", "altın ons", "gümüş fiyat",
           "petrol fiyat", "brent petrol", "ham petrol", "wti petrol",
           "değerli maden", "emtia fiyat"):
        return "Değerli Madenler"
    # Daha genel emtia/altın — ama altın kendi başınaysa da yakala
    if has("altın", "gold", "gümüş", "silver", "petrol", "oil", "brent", "ons"):
        return "Değerli Madenler"
    if has("dolar", "euro", "usd", "eur", "döviz kuru", "kur değişim", "gbp", "forex", "döviz"):
        return "Döviz"
    if has("tcmb", "merkez bankası", "fed faiz", "ecb faiz", "faiz kararı",
           "politika faizi", "central bank", "para politikası"):
        return "Merkez Bankaları"
    if has("kap açıklama", "özel durum", "bilanço", "temettü", "halka arz", "finansal sonuç", "finansal rapor"):
        return "KAP / Finansal Duyurular"
    if has("enflasyon", "gsyih", "işsizlik oranı", "türkiye büyüme", "türkiye ekonomi",
           "tüfe", "üfe", "hazine bütçe", "bütçe açığı", "cari açık"):
        return "Türkiye Ekonomisi"
    if has("savaş", "çatışma", "yaptırım", "nato", "rusya", "ukrayna",
           "orta doğu", "jeopolitik", "war", "conflict", "sanction", "gerilim"):
        return "Dünya Siyaseti"
    if has("satın alma", "birleşme", "şirket anlaşma", "ihracat anlaşma", "sözleşme imzalandı"):
        return "Şirket Haberleri"
    return "Genel"


def _apply_cache(article: dict) -> dict:
    """Varsa cache'ten zenginleştirme verilerini makaleye uygula."""
    key = _cache_key(article)
    cached = _enrichment_cache.get(key)
    if cached:
        article.update(cached)
    if "category" not in article:
        article["category"] = _detect_category(
            article.get("title", ""),
            article.get("description") or article.get("summary") or "",
            article.get("source", ""),
        )
    return article


def _generate_rule_based_comment(article: dict) -> str:
    """
    Gemini yorumu boş geldiğinde makaleye özgü kural tabanlı yorum üretir.
    Her makale için farklı içerik çıkar: başlık, varlıklar, yön ve risk
    kombinasyonu benzersiz bir metin oluşturur.
    """
    title     = (article.get("tr_title") or article.get("title") or "").strip()[:80]
    assets    = article.get("affected_assets") or []
    assets_str = ", ".join(assets[:3]) if assets else "ilgili varlıklar"
    direction = article.get("impact_direction", "nötr")
    risk      = article.get("risk_level", "medium")
    category  = article.get("category", "Genel")

    risk_labels = {"high": "yüksek riskli", "medium": "orta riskli", "low": "düşük riskli"}
    risk_label  = risk_labels.get(str(risk), "orta riskli")

    dir_texts = {
        "pozitif": (
            f"{assets_str} için kısa vadeli yukarı yönlü hareket potansiyeli taşıyan bu gelişme, "
            f"{risk_label} bir senaryo oluşturmaktadır. "
            "Piyasa bu haberi olumlu fiyatlamaya başlamış olabilir; "
            "hacim artışı ve momentum sinyalleri teyit için izlenmelidir. "
            "Tek habere dayalı pozisyon açmak yerine trend onayı beklemek önerilir."
        ),
        "negatif": (
            f"{assets_str} üzerinde baskı oluşturabilecek bu haber {risk_label} kapsamındadır. "
            "Kısa vadede satış baskısı ve volatilite artışı gündeme gelebilir. "
            "Stop-loss seviyeleri belirlenmeli ve pozisyon büyüklüğü bu koşullara göre ayarlanmalıdır. "
            "Ek haber akışına dikkat edilmesi kritik önem taşımaktadır."
        ),
        "karışık": (
            f"Bu haber {assets_str} varlıklarını farklı yönlerde etkileyebilir. "
            f"{category} kategorisinde sektörel ayrışma yaşanması olasıdır. "
            "Belirsizlik ortamında çeşitlendirme stratejisi korunmalı; "
            "her varlık birbirinden bağımsız değerlendirilmelidir."
        ),
        "nötr": (
            f"Bu gelişmenin {assets_str} üzerindeki doğrudan etkisi sınırlı görünmektedir. "
            f"{category} kategorisindeki genel trend değişmediği sürece "
            "piyasa tepkisi ılımlı kalabilir. "
            "Makroekonomik bağlam ve sonraki haber akışı yakından takip edilmelidir."
        ),
    }

    base = dir_texts.get(direction, dir_texts["nötr"])

    if title:
        short_title = title if len(title) <= 60 else title[:57] + "…"
        return f'"{short_title}" — {risk_label} bir gelişme. {base}'
    return base


def _rss_to_signal(article: dict, idx: int) -> NewsSignal:
    try:
        risk = RiskLevel(article.get("risk_level", "medium"))
    except ValueError:
        risk = RiskLevel.medium

    # Türkçe başlık varsa onu, yoksa orijinali kullan
    title   = article.get("tr_title")   or article.get("title", "")
    summary = article.get("tr_summary") or article.get("description") or article.get("summary") or title

    # Gemini yorumu boşsa makaleye özgü kural tabanlı yorum üret
    raw_comment = (article.get("gemini_comment") or "").strip()
    if not raw_comment:
        # article'a kategori ve impact_direction uygula ki rule-based doğru çalışsın
        temp = dict(article)
        temp["tr_title"] = title
        temp.setdefault("impact_direction", "nötr")
        temp.setdefault("category", _detect_category(title, summary, article.get("source", "")))
        raw_comment = _generate_rule_based_comment(temp)
        logger.debug("[news] #%d: gemini_comment boştu, rule-based yorum kullanıldı.", idx)

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
        gemini_comment=raw_comment,
        impact_direction=article.get("impact_direction", "nötr"),
        confidence=article.get("confidence", "medium"),
        category=_detect_category(title, summary, article.get("source", "")),
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
            "category":         article.get("category", "Genel"),
        })
    logger.info("[news:cache] %d makale zenginleştirildi ve cache'e yazıldı. Toplam cache: %d makale.",
                len(articles), len(_enrichment_cache))


async def _run_deepl(articles: list[dict]) -> None:
    """DeepL ile başlık ve özetleri Türkçeye çevirir (in-place günceller)."""
    if not settings.DEEPL_API_KEY:
        return
    try:
        from app.services.deepl_service import translate_articles
        await asyncio.wait_for(translate_articles(articles), timeout=15.0)
    except Exception as exc:
        logger.warning("[news] DeepL çeviri atlandı: %s", exc)


async def _run_gemini(articles: list[dict]) -> None:
    """Gemini ile finansal zenginleştirme yapar (in-place günceller)."""
    if not settings.GEMINI_API_KEY:
        return
    try:
        from app.services.gemini_service import enrich_financial_batch
        await asyncio.wait_for(enrich_financial_batch(articles), timeout=25.0)
    except Exception as exc:
        logger.warning("[news] Gemini finansal analiz atlandı: %s", exc)


async def _fetch_articles() -> list[dict]:
    """
    Haber kaynağı önceliği:
      1. CollectAPI — Türkçe, ~300-600ms, çeviri gerekmez (KEY varsa)
      2. RSS        — fallback, ~1-2s, EN haberler DeepL ile çevrilir
    """
    # CollectAPI dene
    articles = await fetch_collect_news()
    if articles:
        logger.info("[news] Kaynak: CollectAPI (%d haber)", len(articles))
        return articles

    # Fallback: RSS
    logger.info("[news] CollectAPI boş/yok → RSS fallback")
    return await fetch_rss_news()


async def get_news_signals() -> list[NewsSignal]:
    """
    Tam pipeline: CollectAPI (önce) veya RSS + DeepL + Gemini finansal analizi.
    /api/news-signals endpoint'i tarafından çağrılır.
    İlk yüklemede ~1-3s (CollectAPI), sonrasında cache'ten anında döner.

    Fallback önceliği (hata durumunda):
      1. _last_known_signals → son başarılı gerçek çekim
      2. MOCK_NEWS           → son çare (sadece hiç gerçek veri yoksa)
    """
    global _rss_cache, _rss_cache_ts, _last_known_signals

    if settings.USE_MOCK_DATA:
        return _last_known_signals or MOCK_NEWS

    # Cache kontrolü — 90s içinde tekrar işleme
    if _rss_cache is not None and (time() - _rss_cache_ts) < _RSS_TTL:
        return _rss_cache

    try:
        articles = await _fetch_articles()
        if not articles:
            logger.warning("[news] Kaynaklardan haber çekilemedi → son bilinen haberler kullanılıyor.")
            return _last_known_signals or MOCK_NEWS

        uncached  = [a for a in articles if _cache_key(a) not in _enrichment_cache]
        hit_count = len(articles) - len(uncached)

        if uncached:
            logger.info("[news:cache] %d makale cache'ten · %d yeni → DeepL + Gemini başlatılıyor…",
                        hit_count, len(uncached))
            await _enrich_uncached(uncached)
        else:
            logger.info("[news:cache] Tüm %d makale cache'ten geldi — DeepL/Gemini çağrılmadı. ✓",
                        hit_count)

        for article in articles:
            _apply_cache(article)

        signals = _build_signals(articles)
        _rss_cache    = signals
        _rss_cache_ts = time()

        # ✅ Başarılı çekimi hafızaya yaz (hata fallback'i için)
        if signals:
            _last_known_signals = signals
            logger.debug("[news] Son bilinen haberler güncellendi: %d sinyal.", len(signals))

        return signals

    except Exception as exc:
        logger.error("[news] Haber yükleme hatası: %s", exc)
        if _last_known_signals:
            logger.info("[news] Son bilinen %d haber fallback olarak döndürülüyor.", len(_last_known_signals))
            return _last_known_signals
        return MOCK_NEWS


async def get_news_signals_quick() -> list[NewsSignal]:
    """
    Hızlı versiyon — sadece AI analiz stream'i için.
    DeepL/Gemini ÇAĞIRMAZ; mevcut cache'i kullanır.

    Öncelik:
      1. _rss_cache geçerliyse anında döner (0ms)
      2. CollectAPI (~300-600ms, Türkçe, çeviri yok) → en hızlı
      3. RSS fallback (~1-2s)
      4. Hata → _last_known_signals veya MOCK_NEWS
    """
    global _last_known_signals

    if settings.USE_MOCK_DATA:
        return _last_known_signals or MOCK_NEWS

    # Geçerli cache varsa hemen dön
    if _rss_cache is not None and (time() - _rss_cache_ts) < _RSS_TTL:
        return _rss_cache

    try:
        articles = await _fetch_articles()
        if not articles:
            return _last_known_signals or MOCK_NEWS

        # Enrichment cache'ten ne varsa uygula — yeni çağrı YOK
        for article in articles:
            _apply_cache(article)

        cached_count = sum(1 for a in articles if _cache_key(a) in _enrichment_cache)
        logger.debug("[news:quick] %d/%d makale cache'ten, zenginleştirme beklenmedi.",
                     cached_count, len(articles))

        signals = _build_signals(articles)
        if signals:
            _last_known_signals = signals
        return signals

    except Exception as exc:
        logger.error("[news:quick] Hata: %s", exc)
        return _last_known_signals or MOCK_NEWS


def _build_signals(articles: list[dict]) -> list[NewsSignal]:
    """Article listesini NewsSignal listesine dönüştürür; hatalı makaleler atlanır."""
    signals = []
    for i, article in enumerate(articles):
        try:
            signals.append(_rss_to_signal(article, i))
        except Exception as exc:
            logger.warning("[news] Makale #%d dönüştürme hatası: %s", i, exc)
    return signals
