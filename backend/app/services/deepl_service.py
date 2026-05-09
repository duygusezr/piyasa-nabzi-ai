"""
DeepL Free API — sadece İngilizce makaleler için (lang=="en")
Türkçe makalelerde (lang=="tr") title/description direkt kullanılır.
Ücretsiz: 500.000 karakter/ay | https://www.deepl.com/pro#developer
"""
import httpx
from app.config import settings

_DEEPL_FREE_URL = "https://api-free.deepl.com/v2/translate"
_DEEPL_PRO_URL  = "https://api.deepl.com/v2/translate"


def _endpoint() -> str:
    key = settings.DEEPL_API_KEY
    return _DEEPL_FREE_URL if key.endswith(":fx") else _DEEPL_PRO_URL


async def translate_texts(texts: list[str], target_lang: str = "TR") -> list[str]:
    """
    Verilen metinleri toplu DeepL isteğiyle çevirir.
    Hata veya API key yoksa orijinal metinleri döndürür.
    """
    if not settings.DEEPL_API_KEY or not texts:
        return texts

    non_empty_idx   = [i for i, t in enumerate(texts) if t.strip()]
    non_empty_texts = [texts[i] for i in non_empty_idx]

    if not non_empty_texts:
        return texts

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(
                _endpoint(),
                headers={"Authorization": f"DeepL-Auth-Key {settings.DEEPL_API_KEY}"},
                data={
                    "text":            non_empty_texts,
                    "target_lang":     target_lang,
                    "source_lang":     "EN",
                    "tag_handling":    "xml",
                    "split_sentences": "0",
                },
            )
            resp.raise_for_status()
            translations = resp.json().get("translations", [])
    except Exception as exc:
        print(f"[deepl] Çeviri hatası: {exc}")
        return texts

    result = list(texts)
    for order_idx, orig_idx in enumerate(non_empty_idx):
        if order_idx < len(translations):
            result[orig_idx] = translations[order_idx].get("text", texts[orig_idx])

    return result


async def translate_articles(articles: list[dict]) -> list[dict]:
    """
    Makale listesindeki İngilizce (lang=='en') makaleleri Türkçeye çevirir.
    Türkçe (lang=='tr') makalelerde tr_title/tr_summary = orijinal değer.
    """
    # Türkçe makaleler için direkt kopyala — DeepL çağrısı yok
    for a in articles:
        if a.get("lang", "en") == "tr":
            a["tr_title"]   = a.get("title", "")
            a["tr_summary"] = a.get("description") or a.get("summary") or ""

    # İngilizce makaleleri belirle
    en_idx      = [i for i, a in enumerate(articles) if a.get("lang", "en") == "en"]
    en_articles = [articles[i] for i in en_idx]

    if not en_articles or not settings.DEEPL_API_KEY:
        # API key yoksa İngilizce makaleler de olduğu gibi
        for a in en_articles:
            a["tr_title"]   = a.get("title", "")
            a["tr_summary"] = a.get("description") or a.get("summary") or ""
        return articles

    # EN makalelerin başlık + açıklamalarını tek istekte çevir
    titles       = [a.get("title", "")                                   for a in en_articles]
    descriptions = [a.get("description") or a.get("summary") or ""      for a in en_articles]

    combined    = titles + descriptions
    translated  = await translate_texts(combined)

    tr_titles       = translated[:len(en_articles)]
    tr_descriptions = translated[len(en_articles):]

    for idx, orig_idx in enumerate(en_idx):
        articles[orig_idx]["tr_title"]   = tr_titles[idx]       if idx < len(tr_titles)       else articles[orig_idx]["title"]
        articles[orig_idx]["tr_summary"] = tr_descriptions[idx] if idx < len(tr_descriptions) else (articles[orig_idx].get("description") or "")

    tr_count = sum(1 for a in articles if a.get("lang") == "tr")
    en_count = len(en_articles)
    print(f"[deepl] {tr_count} TR makale direkt · {en_count} EN makale DeepL ile çevrildi")

    return articles
