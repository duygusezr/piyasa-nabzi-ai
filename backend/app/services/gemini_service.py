import asyncio
import json
import logging
import re
import time
import google.generativeai as genai
from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Sen finansal karar destek sisteminde çalışan güvenli bir analiz ajanısın.
Görevin yatırım tavsiyesi vermek DEĞİL; kullanıcının hedefini, piyasa verilerini ve haber sinyallerini analiz ederek risk/fırsat senaryoları üretmektir.
ZORUNLU KURALLAR:
- "Kesin al", "kesin sat", "garanti kazanç", "zarar etmez" gibi ifadeler KULLANMA
- Bunların yerine: "olası senaryo", "risk sinyali", "takip edilebilir", "simülasyon amaçlı" kullan
- Cevaplarını SADECE geçerli JSON formatında üret, başka hiçbir metin ekleme
- Türkçe cevap ver"""

ASSISTANT_SYSTEM_PROMPT = """Sen Piyasa Nabzı AI platformunda çalışan profesyonel bir AI Finansal Asistan'sın.

GÖREV: Kullanıcının sorusunu analiz ederek güncel piyasa verileri, haber etkisi ve varlık sinyalleri üzerinden yapılandırılmış bir karar destek analizi üret.

KESİNLİKLE YASAK — Bu ifadeleri asla tek başına kullanma:
- "Haberleri takip edin" / "Piyasaları takip edin"
- "Riskleri değerlendirin"
- "Uzmana danışın" / "Finans uzmanına başvurun"
- "Birikimlerinizi dağıtmayı düşünün"
- "Gelir giderinizi kontrol edin"
- "Canım", "Arkadaşım", "Dostum" gibi hitaplar
- "kesin al", "kesin sat", "garanti", "zarar etmez", "fırsatı kaçırma"
- "sermayen sıfır olduğu için" veya sermayeyi engel olarak gösteren ifadeler

ZORUNLU KURALLAR:
- Her cevapta somut piyasa bağlamı, etkilenen varlıklar, senaryo yüzdeleri ve riskler OLMALI
- Senaryo yüzdeleri toplamı 100 olmalı
- Para miktarı belirtilmemişse "yüzdesel dağılım üzerinden değerlendirme yapılmıştır" ifadesini kullan
- "değerlendirilebilir", "simüle edilebilir", "incelenebilir", "etkilenebilir", "risk oluşturabilir" gibi güvenli ama faydalı ifadeler kullan
- Senaryo isimleri: "Koruyucu Senaryo", "Dengeli Senaryo", "Agresif Senaryo"

TON: Profesyonel, net, ciddi. Finans terminali dili. Laubali değil.

ÇIKTI: SADECE geçerli JSON. Başka hiçbir metin, açıklama veya kod bloğu ekleme."""


def _get_model():
    if not settings.GEMINI_API_KEY:
        logger.warning("[gemini] GEMINI_API_KEY ayarlı değil — model oluşturulamıyor.")
        return None
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        system_instruction=SYSTEM_PROMPT,
    )


def _get_assistant_model():
    """AI Finansal Asistan için güçlü sistem promptuyla model."""
    if not settings.GEMINI_API_KEY:
        logger.warning("[gemini:assistant] GEMINI_API_KEY ayarlı değil — model oluşturulamıyor.")
        return None
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        system_instruction=ASSISTANT_SYSTEM_PROMPT,
    )


def _get_text_model():
    if not settings.GEMINI_API_KEY:
        return None
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel(model_name=settings.GEMINI_MODEL)


def _extract_json(text: str) -> dict:
    """Gemini yanıtından JSON çıkarır. Hata durumunda ayrıntılı log basar."""
    original = text
    text = text.strip()
    # Markdown kod bloklarını temizle
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(
            "[gemini] JSON ayrıştırma HATASI: %s\n"
            "--- Ham yanıt (ilk 500 karakter) ---\n%s\n"
            "--- Temizlenmiş metin (ilk 500 karakter) ---\n%s",
            e, original[:500], text[:500]
        )
        raise


async def analyze_goal_with_gemini(user_message: str) -> dict | None:
    model = _get_model()
    if not model:
        return None

    prompt = f"""Kullanıcının finansal hedefini analiz et ve aşağıdaki JSON formatında döndür:

Kullanıcı mesajı: "{user_message}"

Döndüreceğin JSON:
{{
  "capital": <sayısal sermaye miktarı, bulunamazsa 0>,
  "capital_currency": "<TRY veya USD>",
  "duration_days": <gün sayısı, bulunamazsa 7>,
  "target": "<hedef özeti>",
  "assets": ["<varlık1>", "<varlık2>"],
  "risk_appetite": "<düşük/orta/yüksek>",
  "summary": "<hedef analiz özeti>",
  "realism": "<hedefin gerçekçilik değerlendirmesi>",
  "risk_level": "<low/medium/high>",
  "warning": "<risk uyarısı>",
  "action_items": [
    "<somut adım 1 — basit Türkçe, 1 cümle>",
    "<somut adım 2>",
    "<somut adım 3>"
  ]
}}

action_items için: Kullanıcının hedefine ve varlıklarına göre 3-4 somut adım yaz.
- "Haberleri takip edin", "riskleri değerlendirin", "uzmana danışın" gibi boş cümleler YAZMA
- Her adım spesifik olsun: hangi varlık, neden, ne zaman"""

    t0 = time.time()
    try:
        response = await model.generate_content_async(prompt)
        elapsed = time.time() - t0
        logger.info("[gemini:goal] Yanıt alındı (%.2fs) — %d karakter", elapsed, len(response.text))
        return _extract_json(response.text)
    except Exception as exc:
        logger.error("[gemini:goal] HATA (%.2fs): %s", time.time() - t0, exc, exc_info=True)
        return None


async def generate_scenarios_with_gemini(
    goal: dict, market_data: dict, news_signals: list
) -> dict | None:
    model = _get_model()
    if not model:
        return None

    market_summary = json.dumps(market_data, ensure_ascii=False, indent=2)
    news_summary = json.dumps(news_signals[:5], ensure_ascii=False, indent=2)

    prompt = f"""Aşağıdaki kullanıcı hedefi, piyasa verileri ve haber sinyallerine göre 3 senaryo üret.

KULLANICI HEDEFİ:
{json.dumps(goal, ensure_ascii=False)}

PİYASA VERİLERİ (özet):
{market_summary[:1500]}

HABER SİNYALLERİ:
{news_summary[:1000]}

Aşağıdaki JSON formatında SADECE 3 senaryo döndür:
{{
  "protective": {{
    "name": "Koruyucu Senaryo",
    "allocation": [
      {{"asset": "<varlık>", "percentage": <yüzde>, "rationale": "<gerekçe>"}}
    ],
    "risk_score": <0-10>,
    "opportunity_score": <0-10>,
    "volatility_score": <0-10>,
    "expected_behavior": "<beklenen davranış>",
    "explanation": "<açıklama>",
    "warnings": ["<uyarı1>", "<uyarı2>"]
  }},
  "balanced": {{...aynı yapı...}},
  "aggressive": {{...aynı yapı...}}
}}"""

    t0 = time.time()
    try:
        response = await model.generate_content_async(prompt)
        elapsed = time.time() - t0
        logger.info("[gemini:scenarios] Yanıt alındı (%.2fs)", elapsed)
        return _extract_json(response.text)
    except Exception as exc:
        logger.error("[gemini:scenarios] HATA (%.2fs): %s", time.time() - t0, exc, exc_info=True)
        return None


async def summarize_news_with_gemini(articles: list[dict]) -> list[dict] | None:
    model = _get_model()
    if not model or not articles:
        return None

    titles_payload = [
        {"title": a.get("title", ""), "url": a.get("url", ""), "group": a.get("group_label", "")}
        for a in articles[:10]
    ]

    prompt = f"""Aşağıdaki finansal/jeopolitik haber başlıklarını analiz et.
Her haber için Türkçe özet, risk seviyesi ve piyasa etkisi üret.

HABERLER:
{json.dumps(titles_payload, ensure_ascii=False)}

Her haber için aşağıdaki JSON array formatında döndür:
[
  {{
    "url": "<kaynak url>",
    "title": "<orijinal başlık>",
    "summary": "<Türkçe 1-2 cümle özet>",
    "risk_level": "<low/medium/high>",
    "market_impact": "<piyasa etkisi açıklaması, simülasyon amaçlı>",
    "affected_assets": ["<varlık1>", "<varlık2>"]
  }}
]"""

    t0 = time.time()
    try:
        response = await model.generate_content_async(prompt)
        logger.info("[gemini:news_summary] Yanıt alındı (%.2fs)", time.time() - t0)
        data = _extract_json(response.text)
        if isinstance(data, list):
            return data
        logger.warning("[gemini:news_summary] Beklenen list, gelen: %s", type(data))
        return None
    except Exception as exc:
        logger.error("[gemini:news_summary] HATA (%.2fs): %s", time.time() - t0, exc, exc_info=True)
        return None


def _build_fallback_analysis(user_message: str, market_snapshot: dict, assets: list[str]) -> dict:
    """Gemini başarısız olursa somut, yapılandırılmış fallback analiz döndürür."""
    usd = market_snapshot.get("usd_try", 0)
    gold = market_snapshot.get("gold_try", 0)
    btc = market_snapshot.get("btc_try", 0)
    bist = market_snapshot.get("bist100", 0)
    assets_str = ", ".join(assets) if assets else "Bitcoin, Altın, BIST 100"
    logger.info("[gemini:assistant] Fallback analiz döndürülüyor — assets: %s", assets_str)
    return {
        "directAnswer": (
            f"Soru analiz edildi. Mevcut piyasa verilerine göre — "
            f"USD/TRY: {usd:.2f}, Altın: {gold:,.0f} TL, Bitcoin: {btc:,.0f} TL, BIST 100: {bist:,.0f} — "
            f"ilgili varlıklar ({assets_str}) için üç senaryo üzerinden değerlendirme yapılmıştır. "
            f"Para miktarı belirtilmediği için yüzdesel dağılım üzerinden analiz oluşturulmuştur."
        ),
        "marketContext": (
            f"USD/TRY {usd:.2f} seviyesinde seyrediyor. "
            f"Gram altın {gold:,.0f} TL, Bitcoin {btc:,.0f} TL, BIST 100 {bist:,.0f} değerinde. "
            "Kur ve emtia hareketleri, portföy dağılımı kararlarında belirleyici olabilir."
        ),
        "affectedAssets": [
            {"asset": "Altın", "possibleEffect": "Kur ve küresel belirsizlik ortamında desteklenebilir", "reason": "Güvenli liman talebi ve döviz etkisi", "riskLevel": "orta"},
            {"asset": "USD/TRY", "possibleEffect": "Enflasyon ve faiz dinamiklerine bağlı volatilite görülebilir", "reason": "Merkez bankası politikası ve küresel risk algısı", "riskLevel": "orta-yüksek"},
            {"asset": "BIST 100", "possibleEffect": "Kur ve enflasyon etkisiyle sektörel ayrışma yaşanabilir", "reason": "İhracatçı vs ithalatçı şirket dinamiği", "riskLevel": "orta"},
            {"asset": "Bitcoin", "possibleEffect": "Küresel likidite ve risk iştahına bağlı yüksek volatilite görülebilir", "reason": "Kripto piyasası duyarlılığı", "riskLevel": "yüksek"},
        ],
        "actionableOptions": [
            {"title": "Korunma odaklı seçenek", "description": "Altın ve döviz bazlı varlıkların ağırlıklı olduğu koruyucu senaryo simüle edilebilir.", "whenUseful": "Kur oynaklığı yüksekken veya belirsizlik ortamında", "risk": "düşük"},
            {"title": "Dengeli büyüme", "description": "Altın, BIST ve nakit karışımıyla orta risk-getiri dengesi değerlendirilebilir.", "whenUseful": "Uzun vadeli pozisyon hedefleniyorsa", "risk": "orta"},
            {"title": "Yüksek risk-getiri", "description": "Kripto ve BIST tema hisseleri küçük oranla agresif senaryoda incelenebilir.", "whenUseful": "Kısa vadeli, yüksek risk toleransında", "risk": "yüksek"},
        ],
        "scenarios": [
            {"name": "Koruyucu Senaryo", "allocation": [{"asset": "Altın", "percent": 35}, {"asset": "USD/Döviz", "percent": 30}, {"asset": "TL/Nakit", "percent": 20}, {"asset": "BIST Düşük Volatilite", "percent": 15}], "logic": "Belirsizlik ortamında sermayeyi korumak öncelikli.", "riskScore": 2, "opportunityScore": 4, "volatilityScore": 2},
            {"name": "Dengeli Senaryo", "allocation": [{"asset": "Altın", "percent": 30}, {"asset": "BIST 100", "percent": 30}, {"asset": "USD/Döviz", "percent": 25}, {"asset": "TL/Nakit", "percent": 15}], "logic": "Risk ve büyüme potansiyelini dengeler.", "riskScore": 5, "opportunityScore": 6, "volatilityScore": 5},
            {"name": "Agresif Senaryo", "allocation": [{"asset": "BIST Tema Hisseleri", "percent": 35}, {"asset": "Bitcoin", "percent": 20}, {"asset": "USD/Döviz", "percent": 25}, {"asset": "Altın", "percent": 20}], "logic": "Yüksek büyüme hedefi; kayıp riski yüksek.", "riskScore": 8, "opportunityScore": 8, "volatilityScore": 9},
        ],
        "whatToWatch": ["USD/TRY günlük değişim", "TCMB faiz kararı", "Enflasyon verisi", "Ons altın", "BIST 100", "Bitcoin fiyatı"],
        "scenarioInvalidation": [
            "Dolar/TL hızlı geri çekilirse döviz bazlı senaryo zayıflayabilir.",
            "Ons altın düşerse altın tarafı kur artışına rağmen baskılanabilir.",
            "BIST genelinde sert satış olursa hisse ağırlıklı senaryo bozulabilir.",
            "Beklenmedik merkez bankası kararı tüm senaryoları yeniden değerlendirebilir.",
        ],
        "risks": [
            "Kısa vadede haber akışı fiyatları hızlı değiştirebilir.",
            "Döviz ve emtia çift yönlü volatilite taşır.",
            "Geç pozisyon almak, geri çekilme riskini artırır.",
        ],
        "conclusion": "En sağlıklı yaklaşım tek bir varlığa yönelmek değil, senaryo bazlı dağılım üzerinden değerlendirme yapmaktır.",
        "disclaimer": "Bu içerik yatırım tavsiyesi değildir; eğitim ve simülasyon amaçlıdır.",
    }


async def generate_assistant_analysis(
    user_message: str,
    capital: float,
    capital_currency: str,
    duration_days: int,
    assets: list[str],
    market_snapshot: dict,
    news_headlines: list[str] | None = None,
) -> dict:
    """Yapılandırılmış JSON formatında karar destek analizi üretir."""
    logger.info(
        "[gemini:assistant] Analiz başlatılıyor — mesaj: '%s...' | sermaye: %.0f %s | süre: %d gün | varlıklar: %s",
        user_message[:60], capital, capital_currency, duration_days, assets
    )

    model = _get_assistant_model()
    if not model:
        logger.warning("[gemini:assistant] Model yok -> fallback analiz döndürülüyor.")
        return _build_fallback_analysis(user_message, market_snapshot, assets)

    btc   = market_snapshot.get("btc_try", 0)
    gold  = market_snapshot.get("gold_try", 0)
    usd   = market_snapshot.get("usd_try", 0)
    bist  = market_snapshot.get("bist100", 0)
    assets_str = ", ".join(assets) if assets else "Bitcoin, Altın, BIST 100"
    capital_note = (
        f"{capital:,.0f} {capital_currency} sermaye"
        if capital > 0
        else "Para miktarı belirtilmemiş; yüzdesel dağılım üzerinden analiz yap"
    )
    news_block = ""
    if news_headlines:
        news_block = "Güncel haber başlıkları:\n" + "\n".join(f"- {h}" for h in news_headlines[:6])

    prompt = f"""SORU: "{user_message}"
PİYASA: BTC={btc:,.0f}TL Altın={gold:,.0f}TL USD/TRY={usd:.2f} BIST={bist:,.0f} | {capital_note} | Süre:{duration_days}g | Varlıklar:{assets_str}
{news_block}

JSON formatında karar destek analizi üret. Alanlar:
- directAnswer: soruya 2-3 cümle doğrudan somut cevap (piyasa verisini kullan)
- marketContext: güncel veriler ve haber akışının soruyla ilişkisi
- affectedAssets: array, her item → asset/possibleEffect/reason/riskLevel(düşük|orta|yüksek), min 4 item
- actionableOptions: array, her item → title/description/whenUseful/risk(düşük|orta|yüksek), min 3 item
- scenarios: 3 item — "Koruyucu Senaryo"/"Dengeli Senaryo"/"Agresif Senaryo", her biri → name/allocation(array of asset+percent, toplam=100)/logic/riskScore(1-10)/opportunityScore(1-10)/volatilityScore(1-10)
- whatToWatch: string array, min 5 gösterge
- scenarioInvalidation: string array, min 3 madde
- risks: string array, min 3 risk
- conclusion: 1-2 cümle net sonuç
- disclaimer: "Bu içerik yatırım tavsiyesi değildir; eğitim ve simülasyon amaçlıdır."

SADECE JSON döndür."""

    logger.debug("[gemini:assistant] Prompt gönderiliyor (%d karakter)", len(prompt))

    t0 = time.time()
    try:
        response = await model.generate_content_async(prompt)
        elapsed = time.time() - t0
        raw_text = response.text
        logger.info(
            "[gemini:assistant] [OK] Yanit alindi (%.2fs) — %d karakter",
            elapsed, len(raw_text)
        )
        logger.debug("[gemini:assistant] Ham yanıt (ilk 300 karakter):\n%s", raw_text[:300])

        data = _extract_json(raw_text)

        if not isinstance(data, dict):
            logger.error("[gemini:assistant] Beklenen dict, gelen: %s — fallback'e dönülüyor.", type(data))
            return _build_fallback_analysis(user_message, market_snapshot, assets)

        if "directAnswer" not in data:
            logger.warning(
                "[gemini:assistant] 'directAnswer' alanı eksik — mevcut anahtarlar: %s",
                list(data.keys())
            )
            return _build_fallback_analysis(user_message, market_snapshot, assets)

        logger.info("[gemini:assistant] [OK] JSON gecerli, analiz hazir.")
        return data

    except Exception as exc:
        elapsed = time.time() - t0
        logger.error(
            "[gemini:assistant] [FAIL] HATA (%.2fs): %s",
            elapsed, exc, exc_info=True
        )
        return _build_fallback_analysis(user_message, market_snapshot, assets)


async def generate_natural_response(
    user_message: str,
    capital: float,
    capital_currency: str,
    duration_days: int,
    assets: list[str],
    market_snapshot: dict,
    action_items: list[str],
    news_headlines: list[str] | None = None,
) -> str:
    """Geriye dönük uyumluluk — artık kullanılmıyor."""
    return ""


async def enrich_financial_batch(articles: list[dict]) -> list[dict]:
    """
    RSS haberlerini finansal açıdan zenginleştirir — çeviri YAPMAZ.
    Her haber için üretilir:
      gemini_comment   : Türkçe finans yorumu (3-4 cümle)
      affected_assets  : Etkilenebilecek varlıklar (Türkçe isimler)
      impact_direction : pozitif | negatif | karışık | nötr
      risk_level       : low | medium | high
      confidence       : low | medium | high
    """
    model = _get_model()
    if not model or not articles:
        logger.warning("[gemini:enrich] Model yok veya makale listesi boş — atlanıyor.")
        return articles

    payload = [
        {
            "i":    i,
            "title": a.get("title", ""),
            "desc":  (a.get("description") or "")[:120],
        }
        for i, a in enumerate(articles[:15])
    ]

    logger.info("[gemini:enrich] %d makale zenginleştiriliyor...", len(payload))

    prompt = f"""Aşağıdaki finansal/ekonomi haberlerini analiz et.
Her haber için SADECE finansal etki değerlendirmesi yap (çeviri yapma):
- gemini_comment  : Türkçe finans yorumu (3-4 cümle). Güvenli dil:
    "etki yaratabilir", "risk sinyali oluşturabilir", "volatiliteyi artırabilir",
    "takip edilebilir", "baskı yaratabilir". Yatırım tavsiyesi YASAK.
- affected_assets : Etkilenebilecek Türkçe varlık adları listesi
    (örn: "Bitcoin", "Altın", "USD/TRY", "BIST 100", "Petrol", "ASELSAN", "THY")
- impact_direction: "pozitif" | "negatif" | "karışık" | "nötr"
- risk_level      : "low" | "medium" | "high"
- confidence      : "low" | "medium" | "high"

HABERLER:
{json.dumps(payload, ensure_ascii=False)}

SADECE JSON array döndür:
[
  {{
    "i": 0,
    "gemini_comment": "...",
    "affected_assets": ["..."],
    "impact_direction": "...",
    "risk_level": "...",
    "confidence": "..."
  }}
]"""

    t0 = time.time()
    try:
        response = await model.generate_content_async(prompt)
        elapsed = time.time() - t0
        logger.info("[gemini:enrich] [OK] Yanit alindi (%.2fs)", elapsed)
        data = _extract_json(response.text)
        if isinstance(data, list):
            enriched_map = {item["i"]: item for item in data if "i" in item}
            hit = 0
            for i, article in enumerate(articles[:15]):
                enriched = enriched_map.get(i)
                if enriched:
                    article["gemini_comment"]   = enriched.get("gemini_comment", "")
                    article["affected_assets"]  = enriched.get("affected_assets", article.get("affected_assets", []))
                    article["impact_direction"] = enriched.get("impact_direction", "nötr")
                    article["risk_level"]       = enriched.get("risk_level", "medium")
                    article["confidence"]       = enriched.get("confidence", "medium")
                    hit += 1
            logger.info("[gemini:enrich] [OK] %d/%d makale zenginleştirildi.", hit, len(payload))
        else:
            logger.warning("[gemini:enrich] Beklenen list, gelen: %s", type(data))
    except Exception as exc:
        logger.error("[gemini:enrich] HATA (%.2fs): %s", time.time() - t0, exc, exc_info=True)
    return articles


async def enrich_news_batch(articles: list[dict]) -> list[dict]:
    """Eski fonksiyon — geriye dönük uyumluluk."""
    model = _get_model()
    if not model or not articles:
        return articles

    payload = [
        {
            "i": i,
            "title": a.get("title", ""),
            "desc":  (a.get("description") or "")[:150],
        }
        for i, a in enumerate(articles[:6])
    ]

    prompt = f"""Aşağıdaki finansal/ekonomi haberlerini analiz et.
Her haber için şunları üret:
- tr_title  : Türkçe başlık (doğal gazetecilik dili, 10-15 kelime)
- tr_summary: Türkçe kısa özet (2-3 cümle, piyasayı ilgilendiren yönü öne çıkar)
- gemini_comment: Türkçe finans yorumu (3-4 cümle).
- affected_assets: Etkilenebilecek Türkçe varlık adları listesi
- impact_direction: "pozitif" | "negatif" | "karışık" | "nötr"
- risk_level      : "low" | "medium" | "high"
- confidence      : "low" | "medium" | "high"

HABERLER:
{json.dumps(payload, ensure_ascii=False)}

Aşağıdaki JSON array formatında SADECE JSON döndür:
[
  {{
    "i": 0,
    "tr_title": "...",
    "tr_summary": "...",
    "gemini_comment": "...",
    "affected_assets": ["..."],
    "impact_direction": "...",
    "risk_level": "...",
    "confidence": "..."
  }}
]"""

    t0 = time.time()
    try:
        response = await model.generate_content_async(prompt)
        logger.info("[gemini:enrich_news] [OK] Yanıt alındı (%.2fs)", time.time() - t0)
        data = _extract_json(response.text)
        if isinstance(data, list):
            enriched_map = {item["i"]: item for item in data if "i" in item}
            for i, article in enumerate(articles[:6]):
                enriched = enriched_map.get(i)
                if enriched:
                    article["tr_title"]         = enriched.get("tr_title", "")
                    article["tr_summary"]        = enriched.get("tr_summary", "")
                    article["gemini_comment"]    = enriched.get("gemini_comment", "")
                    article["affected_assets"]   = enriched.get("affected_assets", article.get("affected_assets", []))
                    article["impact_direction"]  = enriched.get("impact_direction", "nötr")
                    article["risk_level"]        = enriched.get("risk_level", "medium")
                    article["confidence"]        = enriched.get("confidence", "medium")
    except Exception as exc:
        logger.error("[gemini:enrich_news] HATA (%.2fs): %s", time.time() - t0, exc, exc_info=True)
    return articles


async def translate_news_batch(articles: list[dict]) -> list[dict]:
    """RSS haberlerinin başlık ve özetlerini Türkçeye çevirir."""
    model = _get_model()
    if not model or not articles:
        return articles

    payload = [
        {"i": i, "t": a.get("title", ""), "d": (a.get("description") or "")[:120]}
        for i, a in enumerate(articles[:12])
    ]

    prompt = f"""Aşağıdaki finans/ekonomi haberlerini doğal Türkçeye çevir.

{json.dumps(payload, ensure_ascii=False)}

Aynı JSON array formatında döndür, sadece "t" (başlık) ve "d" (açıklama) alanlarını Türkçeye çevir, "i" alanını koru.
Çeviri akıcı ve doğal Türkçe olsun."""

    t0 = time.time()
    try:
        response = await model.generate_content_async(prompt)
        logger.info("[gemini:translate] [OK] Yanıt alındı (%.2fs)", time.time() - t0)
        data = _extract_json(response.text)
        if isinstance(data, list):
            tr_map = {item["i"]: item for item in data if "i" in item}
            for i, article in enumerate(articles[:12]):
                if i in tr_map:
                    article["title"]       = tr_map[i].get("t", article["title"])
                    article["description"] = tr_map[i].get("d", article.get("description", ""))
    except Exception as exc:
        logger.error("[gemini:translate] HATA (%.2fs): %s", time.time() - t0, exc, exc_info=True)
    return articles


async def analyze_news_impact_with_gemini(
    news_items: list, assets: list[str]
) -> dict | None:
    model = _get_model()
    if not model:
        return None

    prompt = f"""Aşağıdaki haberlerin {assets} varlıkları üzerindeki etkisini analiz et.

HABERLER:
{json.dumps(news_items[:5], ensure_ascii=False)}

Aşağıdaki JSON formatında döndür:
{{
  "impact_map": [
    {{
      "asset": "<varlık adı>",
      "direction": "<positive/negative/neutral>",
      "confidence": "<low/medium/high>",
      "reason": "<gerekçe>",
      "signal_sources": ["<kaynak1>"]
    }}
  ]
}}"""

    t0 = time.time()
    try:
        response = await model.generate_content_async(prompt)
        logger.info("[gemini:impact] [OK] Yanıt alındı (%.2fs)", time.time() - t0)
        return _extract_json(response.text)
    except Exception as exc:
        logger.error("[gemini:impact] HATA (%.2fs): %s", time.time() - t0, exc, exc_info=True)
        return None
