from app.models.schemas import AssetImpact, NewsSignal
from app.services.gemini_service import analyze_news_impact_with_gemini

RULE_BASED_SIGNALS = {
    "altın": {
        "keywords": ["gerilim", "savaş", "kriz", "faiz düşüş", "enflasyon", "güvenli liman"],
        "direction": "positive",
        "reason": "Jeopolitik belirsizlik ve enflasyon altın talebini artırabilir",
    },
    "bitcoin": {
        "keywords": ["etf", "kurumsal", "faiz düşüş", "likidite"],
        "direction": "positive",
        "reason": "Risk iştahı artışı kripto varlıklara ilgiyi çekebilir",
    },
    "bist100": {
        "keywords": ["enflasyon yüksek", "faiz artış", "tl değer kaybı"],
        "direction": "negative",
        "reason": "Yüksek faiz ve enflasyon hisse değerlemelerini olumsuz etkileyebilir",
    },
    "usd_try": {
        "keywords": ["tl değer kaybı", "enflasyon", "dolar güçleniyor"],
        "direction": "positive",
        "reason": "TL baskı altında kalması dolar değerini yükseltebilir",
    },
    "ASELS": {
        "keywords": ["savunma", "nato", "ordu", "silah", "jeopolitik"],
        "direction": "positive",
        "reason": "Savunma harcaması artışı savunma sanayi hisselerinde haber duyarlılığı yaratabilir",
    },
}


def _rule_based_impact(news_signals: list[NewsSignal], assets: list[str]) -> list[AssetImpact]:
    impacts = []
    all_news_text = " ".join(
        [s.title.lower() + " " + s.summary.lower() for s in news_signals]
    )

    for asset in assets:
        asset_lower = asset.lower()
        rule = RULE_BASED_SIGNALS.get(asset_lower)
        if rule:
            matched = any(kw in all_news_text for kw in rule["keywords"])
            impacts.append(
                AssetImpact(
                    asset=asset,
                    direction=rule["direction"] if matched else "neutral",
                    confidence="medium" if matched else "low",
                    reason=rule["reason"] if matched else "Mevcut haber sinyallerinde doğrudan etki tespit edilmedi.",
                    signal_sources=[s.id for s in news_signals if any(kw in (s.title + s.summary).lower() for kw in rule["keywords"])][:3],
                )
            )
        else:
            impacts.append(
                AssetImpact(
                    asset=asset,
                    direction="neutral",
                    confidence="low",
                    reason="Bu varlık için özel kural tabanlı sinyal bulunmuyor.",
                    signal_sources=[],
                )
            )
    return impacts


async def run(news_signals: list[NewsSignal], assets: list[str]) -> list[AssetImpact]:
    gemini_result = await analyze_news_impact_with_gemini(
        [{"title": n.title, "summary": n.summary} for n in news_signals],
        assets,
    )

    if gemini_result and "impact_map" in gemini_result:
        try:
            return [AssetImpact(**item) for item in gemini_result["impact_map"]]
        except Exception:
            pass

    return _rule_based_impact(news_signals, assets)
