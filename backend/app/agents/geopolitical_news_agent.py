from app.models.schemas import NewsSignal
from app.services.news_service import get_news_signals, get_news_signals_quick


async def run(quick: bool = False) -> list[NewsSignal]:
    """
    quick=False (default) → tam pipeline: RSS + DeepL + Gemini (yavaş, /api/news-signals için)
    quick=True            → sadece cache + RSS (hızlı, AI analiz stream'i için)
    """
    if quick:
        return await get_news_signals_quick()
    return await get_news_signals()
