# Piyasa Nabzı AI

> Gerçek zamanlı piyasa verileri, haber sinyalleri ve yapay zekâ destekli senaryo analiziyle çalışan finansal karar destek ve simülasyon platformu.
> **Bu sistem yatırım tavsiyesi sunmaz. Gerçek para ile işlem yapmaz.**

---

## Canlı Ortam

| Katman | Platform | URL |
|---|---|---|
| Backend (API) | Railway | `https://backend-production-edd8.up.railway.app` |
| Frontend | VPS + nginx | Sunucunuzun IP/domain adresi |

Backend ile frontend birbirinden bağımsız deploy edilmektedir. Frontend, `/api/*` isteklerini nginx aracılığıyla Railway backend'ine yönlendirir.

---

## Özellikler

- **Gerçek zamanlı piyasa verisi** — Bitcoin, Ethereum, altın, dolar/TL, BIST hisseleri ve endeksleri
- **TradingView tarzı profesyonel grafik** — Mum grafik, hacim barları, MA20/MA50, OHLCV tooltip, 1G/1H/1A/3A/1Y periyotlar
- **AI Finansal Asistan** — Google Gemini 2.5 Flash ile portföy bazlı kişiselleştirilmiş analiz
- **What-If Senaryo** — "BTC %10 düşerse portföyüm ne olur?" gibi sorulara matematiksel yanıt
- **Sanal Portföy (Paper Trading)** — Gerçek fiyatlarla simülasyon alım-satım, P&L takibi
- **Dönemsel Performans Grafikleri** — SQLite snapshot sistemiyle gerçek geçmiş değer karşılaştırması
- **Haber Sinyalleri** — CollectAPI (Türkçe) + RSS fallback + Gemini ile finansal yorum
- **Faiz Karşılaştırma** — İhtiyaç, konut, taşıt kredisi oranları
- **Ekonomik Takvim** — Önemli merkez bankası ve ekonomik veri tarihleri
- **JWT Kimlik Doğrulama** — Kayıt, giriş, korumalı portföy işlemleri

---

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Backend | Python 3.11+, FastAPI, Pydantic v2, Uvicorn |
| Veritabanı | SQLite (WAL modu) — kullanıcılar, portföy, işlem geçmişi, snapshot |
| AI | Google Gemini 2.5 Flash (`gemini-2.5-flash-preview-05-20`) |
| Kripto Verisi | Binance REST API (canlı) |
| Döviz / Altın | TCMB XML, Yahoo Finance |
| BIST Hisseleri | Yahoo Finance (`.IS` sembolleri) |
| Tarihsel Grafik | Binance klines API (kripto) + Yahoo Finance chart API (diğer) |
| Haberler | CollectAPI (birincil) + RSS feeds (fallback) |
| Auth | JWT (PyJWT), bcrypt parola hash |
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS v3 |
| Grafik | TradingView Lightweight Charts v4, Recharts |
| Deploy (Backend) | Railway (Docker/Nixpack) |
| Deploy (Frontend) | VPS — nginx + static dosyalar |

---

## Mimari

```
Kullanıcı ──► nginx (VPS)
                │
                ├── /* ──────────► React build (static, /var/www/piyasanabzi/)
                └── /api/* ──────► Railway Backend (proxy_pass)
                                        │
                                 FastAPI (uvicorn)
                                        │
                        ┌───────────────┼───────────────┐
                   SQLite DB      7 AI Agent        Dış API'ler
                 (users, sim,    (Gemini 2.5)    (Binance, Yahoo,
                  snapshots)                   TCMB, CollectAPI)
```

### Agent Mimarisi

```
UserGoalAgent           → Kullanıcı hedefini ayrıştırır (sermaye, süre, risk)
MarketDataAgent         → Kripto / altın / döviz / BIST anlık fiyatları
GeopoliticalNewsAgent   → Haber sinyali toplama ve Gemini analizi
AssetImpactAgent        → Haberlerin varlıklara etkisini haritalandırır
ScenarioGeneratorAgent  → Koruyucu / Dengeli / Agresif portföy senaryoları
ComplianceGuardAgent    → Yasak ifadeleri filtreler ("kesin al", "garanti" vb.)
SimulationPortfolioAgent → Sanal portföy hesaplama ve yönetim
```

---

## Klasör Yapısı

```
piyasa-nabzi-ai/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI uygulaması + tüm endpointler
│   │   ├── config.py                # Ortam değişkenleri (Settings)
│   │   ├── database.py              # SQLite init, CRUD fonksiyonları
│   │   ├── agents/                  # 7 AI agent modülü
│   │   │   ├── market_data_agent.py
│   │   │   ├── geopolitical_news_agent.py
│   │   │   ├── user_goal_agent.py
│   │   │   ├── asset_impact_agent.py
│   │   │   ├── simulation_portfolio_agent.py
│   │   │   ├── compliance_guard_agent.py
│   │   │   └── __init__.py
│   │   ├── services/
│   │   │   ├── gemini_service.py    # Gemini 2.5 Flash entegrasyonu
│   │   │   ├── market_service.py    # Binance, TCMB, Yahoo Finance
│   │   │   ├── news_service.py      # Haber toplama ve cache
│   │   │   ├── collect_api_service.py # CollectAPI (Türkçe haberler)
│   │   │   ├── rss_service.py       # RSS feed fallback
│   │   │   ├── history_service.py   # OHLCV tarihsel veri (grafik)
│   │   │   ├── simulation_service.py # Paper trading ve snapshot sistemi
│   │   │   └── scenario_service.py  # Senaryo simülasyonu
│   │   └── models/schemas.py        # Tüm Pydantic modelleri
│   ├── data/
│   │   └── piyasanabzi.db           # SQLite veritabanı (Railway volume)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── MarketPage.tsx       # Piyasa + profesyonel grafik
│   │   │   ├── AssistantPage.tsx    # AI Asistan + what-if senaryoları
│   │   │   ├── WalletPage.tsx       # Portföy / cüzdan
│   │   │   ├── SimulationPage.tsx   # Paper trading
│   │   │   ├── NewsPage.tsx         # Haberler
│   │   │   └── OverviewPage.tsx     # Genel bakış
│   │   ├── components/
│   │   │   ├── ProfessionalChart.tsx # TradingView lightweight-charts
│   │   │   ├── Sidebar.tsx
│   │   │   └── TopBar.tsx
│   │   ├── services/api.ts          # Tüm backend API çağrıları
│   │   ├── types/index.ts           # TypeScript tip tanımları
│   │   └── context/AuthContext.tsx  # JWT auth context
│   ├── package.json
│   └── vite.config.ts
└── nginx/
    └── default.conf                 # nginx reverse proxy yapılandırması
```

---

## Yerel Geliştirme Kurulumu

### Gereksinimler

- Python 3.11+
- Node.js 20+
- Git

### 1. Repoyu Klonla

```bash
git clone <repo-url>
cd piyasa-nabzi-ai
```

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

# Ortam değişkenlerini ayarla
cp .env.example .env
# .env dosyasını düzenle (aşağıya bak)
```

### 3. Backend'i Başlat

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

API dokümantasyonu: `http://localhost:8001/docs`

### 4. Frontend Kurulumu

```bash
cd frontend
npm install
```

### 5. Frontend'i Başlat

```bash
npm run dev
```

Uygulama: `http://localhost:5173`

> Geliştirme ortamında frontend `http://localhost:8001` adresindeki backend'e bağlanır. `VITE_API_URL` değişkenini `.env.local` içinde tanımlayabilirsiniz.

---

## Ortam Değişkenleri

`backend/.env` dosyasında aşağıdaki değişkenleri ayarlayın:

| Değişken | Açıklama | Gerekli? |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API anahtarı | Evet |
| `GEMINI_MODEL` | Kullanılacak Gemini modeli | Hayır (varsayılan: `gemini-2.5-flash-preview-05-20`) |
| `BINANCE_API_KEY` | Binance API key | Hayır (public endpoint'ler key gerektirmez) |
| `COLLECTAPI_KEY` | CollectAPI Türkçe haber servisi | Hayır (RSS fallback devreye girer) |
| `COLLECTAPI_URL` | CollectAPI endpoint | Hayır |
| `JWT_SECRET` | JWT imzalama anahtarı | Evet (production'da güçlü bir değer kullanın) |
| `DATABASE_URL` | SQLite dosya yolu | Hayır (varsayılan: `data/piyasanabzi.db`) |
| `CORS_ORIGINS` | İzin verilen frontend URL'leri | Hayır |

API anahtarı edinme:
- **Gemini:** https://aistudio.google.com/app/apikey (ücretsiz)
- **CollectAPI:** https://collectapi.com (ücretli, opsiyonel)

---

## VPS Sunucu Kurulumu

Backend Railway'de çalışır, frontend sanal sunucunuzda (VPS) nginx ile servis edilir.

### Frontend'i Sunucuya Deploy Etme

```bash
# Yerel makinede build al
cd frontend
npm run build

# dist/ klasörünü sunucuya kopyala
scp -r dist/ kullanici@sunucu-ip:/var/www/piyasanabzi/

# Ya da git ile sunucuda build:
ssh kullanici@sunucu-ip
cd /var/www/piyasanabzi
git pull origin main
npm install
npm run build
```

### nginx Yapılandırması

`/etc/nginx/sites-available/piyasanabzi`:

```nginx
server {
    listen 80;
    server_name alan-adiniz.com;   # veya sunucu IP adresi

    root /var/www/piyasanabzi/dist;
    index index.html;

    # React Router için — tüm yolları index.html'e yönlendir
    location / {
        try_files $uri $uri/ /index.html;
    }

    # /api/* isteklerini Railway backend'ine ilet
    location /api/ {
        proxy_pass https://backend-production-edd8.up.railway.app;
        proxy_ssl_server_name on;
        proxy_set_header Host backend-production-edd8.up.railway.app;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }

    # Gzip sıkıştırma
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
}
```

```bash
# Yapılandırmayı etkinleştir
ln -s /etc/nginx/sites-available/piyasanabzi /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### HTTPS (Let's Encrypt)

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d alan-adiniz.com
```

---

## API Endpointleri

### Genel

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/` | API sağlık durumu |
| GET | `/api/market-data` | Anlık piyasa verileri |
| GET | `/api/market/history?symbol=BTC&period=1M` | OHLCV tarihsel grafik verisi |
| GET | `/api/news-signals` | Haber sinyalleri |
| GET | `/api/market-calendar` | Ekonomik takvim |
| GET | `/api/interest-rates` | Kredi faiz oranları |

### AI Analiz

| Method | Endpoint | Açıklama |
|---|---|---|
| POST | `/api/assistant/ask` | AI Finansal Asistan (portföy + what-if destekli) |
| POST | `/api/full-analysis` | Tam senaryo analizi |
| GET | `/api/stream-analysis` | SSE ile aşamalı analiz akışı |

### Kimlik Doğrulama

| Method | Endpoint | Açıklama |
|---|---|---|
| POST | `/api/auth/register` | Kayıt ol |
| POST | `/api/auth/login` | Giriş yap (JWT döner) |

### Sanal Portföy (Auth gerekli)

| Method | Endpoint | Açıklama |
|---|---|---|
| POST | `/api/simulation/create` | Yeni simülasyon hesabı |
| GET | `/api/simulation/portfolio` | Portföy özeti |
| GET | `/api/simulation/portfolio/summary` | Detaylı özet (P&L, performans) |
| POST | `/api/simulation/manual/buy` | Sanal alım |
| POST | `/api/simulation/manual/sell` | Sanal satış |
| GET | `/api/simulation/transactions` | İşlem geçmişi |
| GET | `/api/simulation/performance?range=1m` | Dönemsel performans + grafik |
| GET | `/api/simulation/assets` | Alınabilecek varlık listesi |

---

## Tarihsel Grafik Veri Kaynakları

| Sembol | Kaynak | Periyot |
|---|---|---|
| BTC, ETH, SOL, BNB, XRP, PAXG | Binance klines API | 1G=15dk mum, 1H=1sa, 1A→1Y=günlük/haftalık |
| XAU (Altın) | Yahoo Finance `GC=F` | Tüm periyotlar |
| USDTRY | Yahoo Finance `USDTRY=X` | Tüm periyotlar |
| XU100, XU030 | Yahoo Finance `.IS` | Tüm periyotlar |
| BIST Hisseleri (THYAO, ASELS...) | Yahoo Finance `{SEM}.IS` | Günlük ve haftalık |

Kripto verileri USDT bazında Binance'den çekilir; USD/TRY kuru uygulanarak TL'ye çevrilir.

---

## Hukuki Uyarı

- Bu platform **yatırım danışmanlığı** sunmaz.
- Gerçek para ile **otomatik ya da manuel işlem yapmaz**.
- Tüm analizler ve senaryolar **eğitim, bilgilendirme ve simülasyon** amaçlıdır.
- Sanal portföy işlemleri gerçek piyasa emirlerine dönüştürülmez.
- Yatırım kararlarınızda **lisanslı bir mali danışmana** başvurun.
- Piyasalarda **sermayenin tamamı kaybedilebilir**.
