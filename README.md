# Piyasa Nabzı AI

> Gerçek zamanlı piyasa verileri ve dünya siyasetiyle finansal senaryo analizi.
> **Bu sistem yatırım tavsiyesi sunmaz. Gerçek para ile işlem yapmaz.**

---

## Proje Hakkında

Piyasa Nabzı AI; kripto, altın, döviz ve BIST verilerini, jeopolitik haberleri ve makroekonomik gelişmeleri analiz eden yapay zekâ destekli bir **karar destek ve simülasyon** aracıdır.

Kullanıcı hedefini girer, sistem:
1. Hedefi analiz eder (sermaye, süre, risk iştahı)
2. Gerçek zamanlı piyasa verisi çeker
3. Haber sinyallerini yorumlar
4. Varlık etki haritası oluşturur
5. Koruyucu / Dengeli / Agresif senaryo simülasyonları üretir
6. Uyum kontrol ajanı çıktıyı denetler

---

## Teknoloji

| Katman | Teknoloji |
|---|---|
| Backend | Python 3.11+, FastAPI, Pydantic v2 |
| AI | Google Gemini API (gemini-1.5-flash) |
| Piyasa Verisi | CoinGecko API (mock fallback) |
| Haberler | News API (mock fallback) |
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS v3, Recharts |

---

## Kurulum

### Gereksinimler

- Python 3.11+
- Node.js 20+
- Git

---

### 1. Repoyu Klonla

```bash
git clone <repo-url>
cd piyasa-nabzi-ai
```

---

### 2. Backend Kurulumu

```bash
cd backend

# Sanal ortam oluştur
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# Bağımlılıkları yükle
pip install -r requirements.txt

# .env dosyasını oluştur
cp .env.example .env
```

`.env` dosyasını düzenle:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

> **Gemini API Key:** https://aistudio.google.com/app/apikey adresinden ücretsiz alabilirsin.
> API key yoksa sistem mock data ile çalışır.

---

### 3. Backend'i Başlat

```bash
# backend/ klasöründeyken
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API dokümantasyonu: http://localhost:8000/docs

---

### 4. Frontend Kurulumu

```bash
cd frontend

# Bağımlılıkları yükle
npm install
```

---

### 5. Frontend'i Başlat

```bash
npm run dev
```

Uygulama: http://localhost:5173

---

## Ortam Değişkenleri

| Değişken | Açıklama | Varsayılan |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API anahtarı | (boş — mock mod) |
| `GEMINI_MODEL` | Kullanılacak Gemini modeli | `gemini-1.5-flash` |
| `COINGECKO_API_KEY` | CoinGecko API key (opsiyonel) | (boş) |
| `NEWS_API_KEY` | News API key (opsiyonel) | (boş) |
| `USE_MOCK_DATA` | Tüm verileri mock'a zorla | `false` |
| `CACHE_TTL_SECONDS` | Önbellek süresi (sn) | `60` |

---

## Mock Mod

API key yoksa veya `USE_MOCK_DATA=true` ise sistem tamamen mock veriyle çalışır. Demo için herhangi bir API key gerekmez.

---

## Agent Mimarisi

```
UserGoalAgent           → Kullanıcı hedefini ayrıştırır
MarketDataAgent         → Kripto / altın / döviz / BIST fiyatları
GeopoliticalNewsAgent   → Haber sinyali analizi
AssetImpactAgent        → Haberlerin varlıklara etkisi
ScenarioGeneratorAgent  → Koruyucu / Dengeli / Agresif senaryolar
ComplianceGuardAgent    → Yasak ifadeleri engeller
SimulationPortfolioAgent → Sanal portföy oluşturur
```

---

## API Endpointleri

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/` | API durumu |
| POST | `/api/analyze-goal` | Kullanıcı hedefini analiz et |
| GET | `/api/market-data` | Piyasa verileri |
| GET | `/api/news-signals` | Haber sinyalleri |
| POST | `/api/generate-scenarios` | Senaryo üret |
| POST | `/api/full-analysis` | Tam analiz (tüm ajanlar) |

---

## Klasör Yapısı

```
piyasa-nabzi-ai/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + endpoints
│   │   ├── config.py            # Ortam değişkenleri
│   │   ├── agents/              # 7 agent modülü
│   │   ├── services/            # Gemini, market, news, scenario, compliance
│   │   └── models/schemas.py    # Pydantic modelleri
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.tsx              # Ana sayfa
    │   ├── components/          # Header, GoalInput, MarketDataCards, vb.
    │   ├── services/api.ts      # Backend API istemcisi
    │   └── types/index.ts       # TypeScript tipleri
    ├── package.json
    └── vite.config.ts
```

---

## Hukuki Uyarı

- Bu sistem **yatırım danışmanlığı** değildir.
- Gerçek para ile **otomatik işlem yapmaz**.
- Çıktılar **eğitim, analiz ve simülasyon** amaçlıdır.
- Yatırım kararlarınızda **lisanslı bir mali müşavire** danışın.
- Piyasalarda **sermayenin tamamı kaybedilebilir**.
