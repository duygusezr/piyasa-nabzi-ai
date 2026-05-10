import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # ── DeepL (çeviri) ────────────────────────────────────────────
    DEEPL_API_KEY: str  = os.getenv("DEEPL_API_KEY", "")

    # ── Gemini ────────────────────────────────────────────────────
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str   = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # ── Binance (primary crypto — public API, no key required) ───
    BINANCE_API_URL: str = "https://api.binance.com/api/v3"
    BINANCE_API_KEY: str = os.getenv("BINANCE_API_KEY", "")   # optional for higher rate limits

    # ── CoinGecko (fallback crypto) ───────────────────────────────
    COINGECKO_API_URL: str = "https://api.coingecko.com/api/v3"
    COINGECKO_API_KEY: str = os.getenv("COINGECKO_API_KEY", "")

    # ── TCMB (döviz + makro) ──────────────────────────────────────
    # XML: ücretsiz, auth gerektirmez (hafta içi güncellenir)
    TCMB_XML_URL: str  = "https://www.tcmb.gov.tr/kurlar/today.xml"
    # EVDS: kayıt gerektirir, daha detaylı seri verisi
    TCMB_EVDS_URL: str = "https://evds2.tcmb.gov.tr/service/evds"
    TCMB_API_KEY: str  = os.getenv("TCMB_API_KEY", "")

    # ── CollectAPI (Türkçe haber — en hızlı kaynak) ──────────────
    COLLECTAPI_KEY: str        = os.getenv("COLLECTAPI_KEY", "")
    COLLECTAPI_URL: str        = "https://api.collectapi.com/news/getNews"


    # ── GDELT (dünya siyaseti/haber — ücretsiz, auth yok) ────────
    GDELT_API_URL: str     = "https://api.gdeltproject.org/api/v2/doc/doc"
    GDELT_MAX_RECORDS: int = int(os.getenv("GDELT_MAX_RECORDS", "10"))

    # ── CORS ──────────────────────────────────────────────────────
    # Üretimde: CORS_ORIGINS=* veya https://alanadi.com,https://www.alanadi.com
    # Geliştirmede: boş bırakılırsa localhost varsayılanları kullanılır
    @property
    def CORS_ORIGINS(self) -> list:
        raw = os.getenv("CORS_ORIGINS", "")
        if raw.strip() == "*":
            return ["*"]
        if raw.strip():
            return [o.strip() for o in raw.split(",") if o.strip()]
        # Varsayılan — local geliştirme
        return [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
        ]

    # ── Genel ─────────────────────────────────────────────────────
    USE_MOCK_DATA: bool    = os.getenv("USE_MOCK_DATA", "false").lower() == "true"
    CACHE_TTL_SECONDS: int = int(os.getenv("CACHE_TTL_SECONDS", "60"))
    REQUEST_TIMEOUT: float = float(os.getenv("REQUEST_TIMEOUT", "10"))


settings = Settings()
