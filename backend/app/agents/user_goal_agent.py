import re
from app.models.schemas import ParsedGoal, GoalAnalysis, RiskLevel
from app.services.gemini_service import analyze_goal_with_gemini

ASSET_KEYWORDS = {
    "bitcoin": ["bitcoin", "btc"],
    "ethereum": ["ethereum", "eth"],
    "gold": ["altın", "gold", "xau", "gram altın"],
    "usd_try": ["dolar", "usd", "döviz", "usd/try"],
    "bist100": ["bist", "borsa", "hisse", "xu100"],
    "ASELS": ["aselsan", "asels"],
    "THYAO": ["thy", "türk hava yolları", "thyao"],
    "SASA": ["sasa"],
    "KRDMD": ["kardemir", "krdmd"],
}


def _extract_capital(text: str) -> tuple[float, str]:
    patterns = [
        (r"(\d[\d.,]*)\s*(bin|binlerce)?\s*tl", "TRY"),
        (r"(\d[\d.,]*)\s*(bin|binlerce)?\s*lira", "TRY"),
        (r"\$\s*(\d[\d.,]*)", "USD"),
        (r"(\d[\d.,]*)\s*dolar", "USD"),
        (r"(\d[\d.,]*)", "TRY"),
    ]
    for pattern, currency in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            raw = m.group(1).replace(".", "").replace(",", ".")
            try:
                amount = float(raw)
                if "bin" in (m.group(2) or "").lower():
                    amount *= 1000
                return amount, currency
            except ValueError:
                continue
    return 100.0, "TRY"


def _extract_duration(text: str) -> int:
    patterns = [
        (r"(\d+)\s*gün", 1),
        (r"(\d+)\s*hafta", 7),
        (r"(\d+)\s*ay", 30),
        (r"(\d+)\s*yıl", 365),
    ]
    for pattern, multiplier in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return int(m.group(1)) * multiplier
    return 7


def _extract_assets(text: str) -> list[str]:
    found = []
    lower = text.lower()
    for asset, keywords in ASSET_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            found.append(asset)
    if not found:
        found = ["bitcoin", "gold", "bist100"]
    return found


def _extract_risk_appetite(text: str) -> str:
    lower = text.lower()
    if any(w in lower for w in ["agresif", "yüksek risk", "maksimum", "çok kazanmak"]):
        return "yüksek"
    if any(w in lower for w in ["güvenli", "düşük risk", "koruyucu", "kaybetmek istemiyorum"]):
        return "düşük"
    return "orta"


def _rule_based_analysis(message: str) -> GoalAnalysis:
    capital, currency = _extract_capital(message)
    duration = _extract_duration(message)
    assets = _extract_assets(message)
    risk = _extract_risk_appetite(message)

    parsed = ParsedGoal(
        capital=capital,
        capital_currency=currency,
        duration_days=duration,
        target="maksimum getiri" if risk == "yüksek" else "dengeli büyüme",
        assets=assets,
        risk_appetite=risk,
        raw_message=message,
    )

    if duration <= 3 and risk == "yüksek":
        realism = "Çok kısa vadede yüksek getiri beklentisi gerçekçi değildir."
        risk_level = RiskLevel.high
    elif duration <= 7:
        realism = "Kısa vadeli senaryo — piyasa volatilitesi yüksek olabilir."
        risk_level = RiskLevel.medium
    else:
        realism = "Orta vadeli hedef daha makul bir zaman dilimine sahip."
        risk_level = RiskLevel.low

    return GoalAnalysis(
        summary=f"{capital} {currency} sermaye ile {duration} günlük senaryo analizi.",
        realism=realism,
        risk_level=risk_level,
        warning="Piyasalar her zaman beklenen yönde hareket etmeyebilir. Sermayenin tamamı kaybedilebilir.",
        parsed_goal=parsed,
        action_items=[],
    )


async def run(message: str) -> GoalAnalysis:
    gemini_result = await analyze_goal_with_gemini(message)

    if gemini_result:
        try:
            capital = float(gemini_result.get("capital", 100))
            duration = int(gemini_result.get("duration_days", 7))
            assets = gemini_result.get("assets", ["bitcoin", "gold", "bist100"])
            risk = gemini_result.get("risk_appetite", "orta")
            currency = gemini_result.get("capital_currency", "TRY")

            parsed = ParsedGoal(
                capital=capital,
                capital_currency=currency,
                duration_days=duration,
                target=gemini_result.get("target", "dengeli büyüme"),
                assets=assets,
                risk_appetite=risk,
                raw_message=message,
            )
            risk_level_str = gemini_result.get("risk_level", "medium")
            risk_level = RiskLevel(risk_level_str) if risk_level_str in ("low", "medium", "high") else RiskLevel.medium

            return GoalAnalysis(
                summary=gemini_result.get("summary", ""),
                realism=gemini_result.get("realism", ""),
                risk_level=risk_level,
                warning=gemini_result.get("warning", "Piyasalar her zaman beklenen yönde hareket etmeyebilir."),
                parsed_goal=parsed,
                action_items=gemini_result.get("action_items", []),
            )
        except Exception:
            pass

    return _rule_based_analysis(message)
