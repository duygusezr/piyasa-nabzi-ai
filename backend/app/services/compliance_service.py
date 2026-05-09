import re

BANNED_PHRASES = [
    r"kesin\s+al",
    r"kesin\s+sat",
    r"garanti\s+kazan[cç]",
    r"zarar\s+etmez",
    r"şu\s+hisse\s+uçacak",
    r"para[nı]\s+\d+['e]\s+katlar",
    r"100\s*%\s+güvenli",
    r"riski\s+yok",
    r"kaybet(me|mez)zsin",
    r"guaranteed\s+profit",
    r"sure\s+thing",
]

SAFE_REPLACEMENTS = {
    "kesin al": "olası alım sinyali (simülasyon amaçlı)",
    "kesin sat": "olası satış sinyali (simülasyon amaçlı)",
    "garanti kazanç": "potansiyel fırsat (garanti değildir)",
    "zarar etmez": "risk taşıdığı unutulmamalıdır",
}

DISCLAIMER = "\n\n⚠️ Bu içerik yatırım tavsiyesi değildir. Gerçek para ile otomatik işlem yapılmaz. Çıktılar yalnızca eğitim, analiz ve simülasyon amaçlıdır."


def check_compliance(text: str) -> tuple[bool, list[str]]:
    """Returns (is_compliant, list_of_violations)."""
    violations = []
    for pattern in BANNED_PHRASES:
        if re.search(pattern, text, re.IGNORECASE | re.UNICODE):
            violations.append(pattern)
    return len(violations) == 0, violations


def sanitize_text(text: str) -> str:
    """Replace banned phrases with safe alternatives."""
    for banned, safe in SAFE_REPLACEMENTS.items():
        text = re.sub(banned, safe, text, flags=re.IGNORECASE | re.UNICODE)
    return text


def add_disclaimer(text: str) -> str:
    if "yatırım tavsiyesi değildir" not in text.lower():
        return text + DISCLAIMER
    return text


def process_output(text: str) -> str:
    return sanitize_text(text)
