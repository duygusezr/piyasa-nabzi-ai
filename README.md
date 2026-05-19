# 🧠 Piyasa Nabzı AI

> **Çok Ajanlı Yapay Zekâ Destekli Finansal Analiz ve Karar Destek Sistemi**

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript)](https://typescriptlang.org)
[![Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash-4285F4?style=flat&logo=google)](https://deepmind.google/gemini)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Railway-blueviolet?style=flat&logo=railway)](https://frontend-production-6ea8.up.railway.app)

## 🚀 Canlı Demo & Video

**➡️ Uygulama:** [frontend-production-6ea8.up.railway.app](https://frontend-production-6ea8.up.railway.app)

**🎥 Demo Videosu (YouTube):** [youtube.com/watch?v=p8og5baPe-k](https://www.youtube.com/watch?v=p8og5baPe-k)

**📂 Demo Videosu (Drive):** [Google Drive'da İzle](https://drive.google.com/file/d/1Hu9IFnEQEq8gN4t5CR5hwtJOW_4kGCyj/view?usp=sharing)

> Kayıt olarak tüm özelliklere erişebilirsiniz.

---

## 📌 Proje Özeti

**Piyasa Nabzı AI**, birden fazla özelleşmiş yapay zekâ ajanının (multi-agent system) iş birliğiyle gerçek zamanlı finansal analiz üretmesini sağlayan kapsamlı bir karar destek platformudur.

Sistem; serbest Türkçe metin girdisini NLP pipeline'ından geçirip kullanıcının finansal hedefini anlar, Binance · Yahoo Finance · TCMB gibi beş farklı API'dan canlı piyasa verisi çeker, küresel haber akışını NLP ile sınıflandırır ve tüm bu verileri Google Gemini 2.5 Flash LLM'e sunarak kişiselleştirilmiş portföy senaryoları üretir.

**Temel fark:** Kullanıcı "10.000 lira birikimim var, 3 ayda ne yapayım?" gibi doğal dil içeren bir soru sorabilir. Sistem bu soruyu ayrıştırır, piyasayı okur, son haberleri analiz eder ve yapılandırılmış bir yatırım senaryosu sunar — tamamı Türkçe, tamamı gerçek zamanlı.

> ⚠️ **Önemli Not:** Bu platform **eğitim ve simülasyon amaçlıdır.** Üretilen içerik yatırım tavsiyesi değildir. Gerçek yatırım kararları için lisanslı uzmanlara başvurunuz.

---

## 🎯 Temel Özellikler

| Özellik | Teknoloji | Açıklama |
|---|---|---|
| **NLP Hedef Ayrıştırma** | Gemini 2.5 + Regex | Serbest metin → yapısal finansal hedef |
| **Çok Ajanlı Mimari** | 6 Özelleşmiş Agent | Her agent bağımsız, paralel çalışır |
| **Canlı Piyasa Verisi** | Binance · Yahoo · TCMB | Kripto · hisse · döviz · emtia |
| **NLP Haber Sinyalleri** | GDELT · RSS · DeepL | Sınıflandırma + yön tespiti + etkilenen varlıklar |
| **LLM Analizi** | Gemini 2.5 Flash | Kişiselleştirilmiş senaryo ve portföy önerisi |
| **Simülasyon** | Rule Engine + AI | Paper trading, gerçek fiyatlarla işlem |
| **Gerçek Portföy Takibi** | localStorage + Canlı Fiyat | Alınan varlıkların K/Z takibi |
| **TEFAS Fon Verisi** | TEFAS ws API | Türk yatırım fonları NAV |
| **OHLCV Grafikleri** | Binance + CoinGecko | Mum grafikleri, 5 zaman dilimi |
| **Server-Sent Events** | FastAPI SSE | Gerçek zamanlı streaming analiz |
| **JWT Kimlik Doğrulama** | Python-Jose + SQLite | Kayıt · giriş · oturum yönetimi |

---

## 🏗️ Sistem Mimarisi

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          KULLANICI ARAYÜZÜ (React + TypeScript)             │
│  Intelligence Hub  │  AI Asistan  │  NLP Haberler  │  Piyasa  │  Simülasyon │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ HTTP REST + SSE
┌──────────────────────────────────▼──────────────────────────────────────────┐
│                         FastAPI BACKEND (Python 3.11+)                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    AI AGENT SİSTEMİ (6 Agent)                       │   │
│  │                                                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐   │   │
│  │  │UserGoalAgent│  │MarketData   │  │GeopoliticalNewsAgent     │   │   │
│  │  │NLP Ayrıştırma│  │Agent        │  │NLP Haber Sınıflandırma  │   │   │
│  │  │Gemini + Regex│  │Binance+TCMB │  │GDELT + RSS + DeepL      │   │   │
│  │  └──────┬──────┘  └──────┬──────┘  └────────────┬─────────────┘   │   │
│  │         │                │                        │                 │   │
│  │  ┌──────▼──────┐  ┌──────▼──────┐  ┌────────────▼─────────────┐   │   │
│  │  │Simulation   │  │AssetImpact  │  │ComplianceGuard           │   │   │
│  │  │Portfolio    │  │Agent        │  │Agent                     │   │   │
│  │  │Agent        │  │Pre-Trade    │  │Policy Enforcement        │   │   │
│  │  │Rule Engine  │  │Risk Analizi │  │Disclaimer                │   │   │
│  │  └─────────────┘  └─────────────┘  └──────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│  ┌──────────────────────────── LLM KATMANI ───────────────────────────┐   │
│  │              Google Gemini 2.5 Flash                                │   │
│  │  • Hedef analizi  • Haber yorumu  • Senaryo üretimi  • Asistan    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│  ┌─────────────────── VERİ KAYNAKLARI ────────────────────────────────┐   │
│  │  Binance API │ Yahoo Finance │ TCMB │ GDELT │ CollectAPI │ TEFAS  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│  ┌─────────────────── VERİTABANI + ÖNBELLEK ──────────────────────────┐   │
│  │  SQLite (kullanıcı + simülasyon)  │  In-Memory LRU Cache (500 mak.)│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 AI Agent Sistemi — Detaylı Açıklama

### 1. `UserGoalAgent` — NLP Hedef Ayrıştırıcı

**Dosya:** `backend/app/agents/user_goal_agent.py`

Kullanıcının serbest metin olarak yazdığı finansal soruyu/hedefi yapılandırılmış bir nesneye dönüştürür.

**Girdi:**
```
"Elimde 50.000 lira var, Bitcoin ve altına yatırım yapmayı düşünüyorum, 
 3 aylık bir hedefim var."
```

**Çıktı:**
```json
{
  "capital": 50000,
  "capital_currency": "TRY",
  "duration_days": 90,
  "assets": ["Bitcoin", "Altın"],
  "risk_appetite": "orta",
  "target": "3 ayda getiri elde etmek",
  "risk_level": "medium",
  "action_items": ["BTC destek seviyelerini takip et", "Gram altın hareketlerini izle"]
}
```

**Teknik detaylar:**
- Google Gemini 2.5 Flash ile JSON schema enforced prompting
- Regex tabanlı yedek ayrıştırma (Gemini başarısız olursa)
- Türkçe doğal dil desteği — "beş on bin lira", "yarım yıl", "biraz kripto"
- Sermaye çıkarımı: sayısal, sözel, kısaltmalı ("50K", "50 bin", "50000")

---

### 2. `MarketDataAgent` — Çok Kaynaklı Veri Toplayıcı

**Dosya:** `backend/app/agents/market_data_agent.py`  
**Servis:** `backend/app/services/market_data_service.py`

Beş farklı API'dan eş zamanlı (asyncio) veri çeker ve normalize eder.

**Kaynak öncelik sırası:**

| Kategori | Birincil Kaynak | Fallback | Dönem |
|---|---|---|---|
| Kripto (TRY) | Binance API (USDT→TRY) | CoinGecko | Gerçek zamanlı |
| Altın (gram, TRY) | TCMB XML Feed | CollectAPI | Günlük |
| USD/TRY | TCMB XML Feed | Yahoo Finance | Gerçek zamanlı |
| BIST 100 | Yahoo Finance (^XU100.IS) | CollectAPI | 15 dk gecikmeli |
| BIST Hisseleri | Yahoo Finance (.IS suffix) | Sabit referans | 15 dk gecikmeli |
| TEFAS Fonları | TEFAS ws API | Gerçekçi Mock | Günlük NAV |

**Önbellekleme:** Her varlık kategorisi için ayrı TTL (60 saniye kripto, 300 saniye hisse).

**Grafik verisi:** `history_service.py` — Binance klines API (1D/1W/1M/3M/1Y), başarısız olunca CoinGecko OHLC fallback. BIST/döviz/emtia için Yahoo Finance chart API.

---

### 3. `GeopoliticalNewsAgent` — NLP Haber Sinyal İşleyici

**Dosya:** `backend/app/agents/geopolitical_news_agent.py`  
**Servis:** `backend/app/services/news_service.py`

Küresel haber akışını işleyerek her haber için finansal sinyal üretir.

**Pipeline adımları:**

```
Kaynak Çekimi          Filtre            DeepL Çevirisi       Gemini NLP
─────────────          ──────            ──────────────       ──────────
CollectAPI (TR) ─┐                       ┌─ tr_title          gemini_comment
GDELT Project  ──┼── Finans filtresi ────┼─ tr_summary    ──► impact_direction
RSS Feeds      ─┘    (kelime tabanlı)    └─ ...               affected_assets
                                                               risk_level
                                                               confidence
```

**NLP Sınıflandırma Çıktısı (her haber için):**
- `impact_direction`: `pozitif` | `negatif` | `karışık` | `nötr`
- `risk_level`: `low` | `medium` | `high`
- `confidence`: `low` | `medium` | `high`
- `affected_assets`: `["Bitcoin", "BIST 100", "Altın"]`
- `gemini_comment`: Net ve doğrudan finansal yorum — _"Bu haber Bitcoin fiyatını DÜŞÜRÜR."_

**Akıllı önbellek (LRU, 500 makale):**
- Cache key: `sha256(başlık)[:20]` — URL değişse de başlık sabittir
- Zenginleştirilmiş makaleler yeniden Gemini/DeepL çağrısı yapmaz
- `_last_known_signals`: Tüm kaynaklar başarısız olursa son gerçek veri döner (mock asla)

**Başlık tabanlı NLP (Gemini başarısız olunca):**
- `_extract_entity_from_title()`: "Chewy hissesi" → `Chewy`, ticker kalıpları `CHWY`, `AAPL`
- `_detect_impact_from_title()`: "dibe vurdu", "52-week low", "fell" → `negatif`

---

### 4. `SimulationPortfolioAgent` — AI Portföy Optimizasyon Ajanı

**Dosya:** `backend/app/agents/simulation_portfolio_agent.py`  
**Servis:** `backend/app/services/simulation_service.py`

Gerçek piyasa fiyatlarıyla çalışan tam işlevli simülasyon portföyü yöneticisi.

**Özellikler:**
- **Paper trading:** Gerçek fiyatlarla alış/satış işlemi kaydı
- **AI stratejileri:** Koruyucu · Dengeli · Agresif · Özel dağılım
- **Performans takibi:** Günlük · haftalık · aylık K/Z, grafik verisi
- **Pre-trade analiz:** `AssetImpactAgent` ile işlem öncesi risk hesabı
- **Portfolio özeti:** Ağırlıklar, getiri %, her pozisyon için K/Z

---

### 5. `AssetImpactAgent` — İşlem Öncesi Risk Analizörü

**Dosya:** `backend/app/agents/asset_impact_agent.py`

Bir işlem gerçekleştirilmeden önce portföye olan potansiyel etkiyi hesaplar.

**Hesaplanan metrikler:**
- Portföy ağırlık değişimi (%)
- Risk skoru değişimi
- Volatilite projeksiyonu
- Çeşitlendirme etkisi

---

### 6. `ComplianceGuardAgent` — Uyumluluk Denetçisi

**Dosya:** `backend/app/agents/compliance_guard_agent.py`

Tüm AI çıktılarını yasal uyumluluk açısından denetler.

**Kontroller:**
- "Kesin al/sat", "garanti kazanç" gibi yanıltıcı ifadelerin tespiti
- Zorunlu disclaimer eklenmesi
- Risk uyarısı standardizasyonu

---

## 🔄 NLP Pipeline — Tam Akış

```
Kullanıcı Girişi (Türkçe serbest metin)
         │
         ▼
┌────────────────────┐
│   UserGoalAgent    │  ← Gemini 2.5 Flash
│   NLP Parsing      │    Sermaye, varlık, süre, risk iştahı
└────────┬───────────┘
         │ Paralel başlatma
    ┌────┴──────────────────────────────┐
    │                                   │
    ▼                                   ▼
┌──────────────┐                ┌──────────────────┐
│ MarketData   │                │ GeopoliticalNews │
│ Agent        │                │ Agent            │
│ 5 API, async │                │ GDELT+RSS+DeepL  │
└──────┬───────┘                └────────┬─────────┘
       │                                 │
       ▼                                 ▼
┌──────────────────────────────────────────────────┐
│           Google Gemini 2.5 Flash                │
│                                                  │
│  Input:                                          │
│  • Ayrıştırılmış hedef (sermaye, varlık, süre)  │
│  • Canlı piyasa snapshot (BTC, XAU, USD, BIST)  │
│  • NLP işlenmiş haber başlıkları (6 adet)        │
│  • Kullanıcı portföyü (varsa, kişiselleştirme)  │
│                                                  │
│  Output (JSON schema enforced):                  │
│  • netGorus, kisaVadeBeklenti, guvenSkoru        │
│  • directAnswer, marketContext                   │
│  • 3 senaryo (Koruyucu/Dengeli/Agresif)          │
│  • affectedAssets, actionableOptions             │
│  • whatToWatch, risks, conclusion                │
└─────────────────────────┬────────────────────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │ Compliance    │
                  │ Guard Agent   │
                  └───────┬───────┘
                          │ SSE Stream
                          ▼
                    React Frontend
```

---

## 📁 Proje Yapısı

```
piyasa-nabzi-ai/
│
├── backend/                          # Python FastAPI Sunucusu
│   ├── app/
│   │   ├── main.py                   # FastAPI app, 20+ endpoint, SSE stream
│   │   ├── config.py                 # .env yönetimi, API anahtarları
│   │   ├── database.py               # SQLite init, bağlantı yönetimi
│   │   │
│   │   ├── agents/                   # AI Agent Sistemi
│   │   │   ├── user_goal_agent.py    # NLP hedef ayrıştırma
│   │   │   ├── market_data_agent.py  # Çok kaynaklı veri toplama
│   │   │   ├── geopolitical_news_agent.py  # NLP haber sinyalleri
│   │   │   ├── simulation_portfolio_agent.py  # Portföy optimizasyon
│   │   │   ├── asset_impact_agent.py # Pre-trade risk analizi
│   │   │   └── compliance_guard_agent.py  # Uyumluluk denetimi
│   │   │
│   │   ├── services/                 # İş Mantığı Katmanı
│   │   │   ├── gemini_service.py     # Gemini 2.5 Flash entegrasyonu
│   │   │   ├── market_data_service.py # Çok kaynaklı piyasa verisi
│   │   │   ├── news_service.py       # Haber pipeline (RSS+DeepL+Gemini)
│   │   │   ├── history_service.py    # OHLCV grafik (Binance+CoinGecko)
│   │   │   ├── simulation_service.py # Paper trading motoru
│   │   │   ├── tefas_service.py      # TEFAS fon NAV verileri
│   │   │   ├── auth_service.py       # JWT kimlik doğrulama
│   │   │   ├── binance_service.py    # Binance API istemcisi
│   │   │   ├── yahoo_finance_service.py  # Yahoo Finance istemcisi
│   │   │   ├── tcmb_service.py       # TCMB kur ve makro veri
│   │   │   ├── collect_api_service.py    # CollectAPI haber istemcisi
│   │   │   ├── deepl_service.py      # DeepL çeviri servisi
│   │   │   ├── rss_service.py        # RSS feed ayrıştırıcı
│   │   │   ├── scenario_service.py   # Portföy senaryo oluşturucu
│   │   │   └── compliance_service.py # İçerik uyumluluk kuralları
│   │   │
│   │   └── models/
│   │       └── schemas.py            # 30+ Pydantic model
│   │
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                         # React + TypeScript Arayüzü
│   ├── src/
│   │   ├── App.tsx                   # Router, layout
│   │   ├── main.tsx
│   │   │
│   │   ├── pages/
│   │   │   ├── OverviewPage.tsx      # Intelligence Hub — AI kontrol merkezi
│   │   │   ├── AssistantPage.tsx     # AI Asistan (Gemini Q&A)
│   │   │   ├── NewsPage.tsx          # NLP Haberler (yükleme slaytı + AI yorum)
│   │   │   ├── MarketPage.tsx        # Piyasa (canlı fiyat + OHLCV grafik)
│   │   │   ├── SimulationPage.tsx    # Simülasyon (paper trading)
│   │   │   ├── WalletPage.tsx        # Cüzdan (simülasyon + gerçek portföy)
│   │   │   ├── SettingsPage.tsx      # Ayarlar
│   │   │   ├── LoginPage.tsx         # Giriş
│   │   │   └── RegisterPage.tsx      # Kayıt
│   │   │
│   │   ├── components/
│   │   │   ├── Sidebar.tsx           # AI-first navigasyon, agent durum paneli
│   │   │   ├── TopBar.tsx            # AI Pipeline göstergesi (5 aşama)
│   │   │   └── ProfessionalChart.tsx # Lightweight-charts OHLCV grafik
│   │   │
│   │   ├── context/
│   │   │   └── AuthContext.tsx       # JWT auth state yönetimi
│   │   │
│   │   ├── services/
│   │   │   └── api.ts                # Tüm backend API çağrıları
│   │   │
│   │   └── types/
│   │       └── index.ts              # TypeScript tip tanımları
│   │
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── Dockerfile
│
├── docker-compose.yml                # Tek komutla ayağa kaldırma
├── start-all.ps1                     # Windows hızlı başlatma
├── start-backend.ps1
├── start-frontend.ps1
└── README.md
```

---

## 🌐 API Endpoint Referansı

### Kimlik Doğrulama

| Method | Endpoint | Açıklama |
|---|---|---|
| `POST` | `/api/auth/register` | Yeni kullanıcı kaydı |
| `POST` | `/api/auth/login` | JWT token alma |
| `GET` | `/api/auth/me` | Mevcut kullanıcı bilgisi |

### Piyasa Verileri

| Method | Endpoint | Açıklama |
|---|---|---|
| `GET` | `/api/market-data` | Tüm canlı piyasa verisi (BTC, XAU, USD, BIST, hisseler) |
| `GET` | `/api/market/history?symbol=BTC&period=1M` | OHLCV mum grafik verisi |
| `GET` | `/api/funds` | TEFAS yatırım fonları NAV (7 fon) |
| `GET` | `/api/market-calendar` | Piyasa takvimi (TCMB, Fed, KAP tarihleri) |
| `GET` | `/api/interest-rates` | Kredi faiz oranları |

### AI ve Haber

| Method | Endpoint | Açıklama |
|---|---|---|
| `POST` | `/api/assistant/ask` | Gemini AI asistan — kişiselleştirilmiş analiz |
| `GET` | `/api/news-signals` | NLP işlenmiş haber sinyalleri |
| `POST` | `/api/analyze-goal` | Kullanıcı hedef ayrıştırma (NLP) |
| `POST` | `/api/full-analysis` | Tam analiz (senkron) |
| `POST` | `/api/full-analysis-stream` | **SSE** — Gerçek zamanlı streaming analiz |

### Simülasyon (JWT Zorunlu)

| Method | Endpoint | Açıklama |
|---|---|---|
| `POST` | `/api/simulation/create` | Simülasyon hesabı oluştur |
| `GET` | `/api/simulation/portfolio` | Mevcut portföy durumu |
| `GET` | `/api/simulation/portfolio/summary` | Detaylı özet + K/Z |
| `POST` | `/api/simulation/manual/buy` | Varlık satın al |
| `POST` | `/api/simulation/manual/sell` | Varlık sat |
| `GET` | `/api/simulation/transactions` | İşlem geçmişi |
| `GET` | `/api/simulation/performance?range=1d` | Dönemsel performans |
| `GET` | `/api/simulation/assets` | İşlem yapılabilir varlıklar |
| `GET` | `/api/simulation/assets/{symbol}/impact` | Pre-trade etki analizi |
| `GET` | `/api/simulation/ai/strategies` | AI portföy stratejileri |
| `POST` | `/api/simulation/ai/select-strategy` | AI strateji uygula |

---

## 📊 Veri Akışı — Gerçek Zamanlı Analiz

```
Kullanıcı Sorusu
      │
      ▼ POST /api/full-analysis-stream
      │
      ├──► [SSE Event: "step"]           "Piyasa verileri çekiliyor..."
      │
      ├──► [SSE Event: "market_data"]    Canlı fiyatlar (BTC, XAU, USD, BIST)
      │
      ├──► [SSE Event: "goal_analysis"]  NLP ayrıştırma sonucu
      │
      ├──► [SSE Event: "step"]           "Haberler analiz ediliyor..."
      │
      ├──► [SSE Event: "news_signals"]   NLP haberleri (yön, risk, etkilenen varlık)
      │
      ├──► [SSE Event: "step"]           "AI analiz üretiliyor..."
      │
      ├──► [SSE Event: "assistant_analysis"]  Gemini senaryolar + öneriler
      │
      └──► [SSE Event: "complete"]       Tüm veri birleştirildi
```

---

## 🛠️ Teknoloji Yığını

### Backend
| Teknoloji | Versiyon | Kullanım |
|---|---|---|
| Python | 3.11+ | Ana dil |
| FastAPI | 0.115+ | REST API + SSE streaming |
| Pydantic v2 | 2.0+ | Veri doğrulama + serializasyon |
| SQLite | 3.x | Kullanıcı + simülasyon verisi |
| httpx | 0.27+ | Async HTTP istemcisi |
| google-generativeai | 0.8+ | Gemini 2.5 Flash entegrasyonu |
| python-jose | 3.3+ | JWT token yönetimi |
| bcrypt | 4.0+ | Şifre hash'leme |
| feedparser | 6.x | RSS feed ayrıştırma |
| asyncio | stdlib | Paralel agent yürütme |

### Frontend
| Teknoloji | Versiyon | Kullanım |
|---|---|---|
| React | 18+ | UI framework |
| TypeScript | 5.0+ | Tip güvenliği |
| Vite | 5.0+ | Build aracı |
| TailwindCSS | 3.x | Stil sistemi |
| React Router | 6.x | SPA yönlendirme |
| lightweight-charts | 4.x | OHLCV mum grafikleri |
| Recharts | 2.x | Performans grafikleri |
| Lucide React | 0.383 | İkon sistemi |

### Harici API'lar
| Servis | Kullanım | Ücret |
|---|---|---|
| Google Gemini 2.5 Flash | LLM analizi + NLP | Ücretsiz tier |
| Binance API | Kripto fiyat + OHLCV | Ücretsiz (public) |
| Yahoo Finance | Hisse + döviz + emtia | Ücretsiz |
| TCMB (EVDS) | Türk lirası kuru + makro | Ücretsiz |
| GDELT Project | Küresel haber akışı | Ücretsiz |
| CollectAPI | Türkçe haber | API key |
| DeepL API | İngilizce → Türkçe çeviri | Ücretsiz tier |
| CoinGecko | Kripto OHLCV (fallback) | Ücretsiz tier |
| TEFAS ws API | Fon NAV verileri | Ücretsiz (public) |

---

## 🔑 Öne Çıkan Teknik Kararlar

### 1. Multi-Agent Paralel Yürütme
Tüm agent'lar `asyncio.gather()` ile paralel çalışır. Seri yürütmede ~8 saniye olan analiz süresi paralel mimaride ~2-3 saniyeye düşer.

```python
goal_task   = asyncio.ensure_future(user_goal_agent.run(message))
market_task = asyncio.ensure_future(market_data_agent.run())
news_task   = asyncio.ensure_future(geopolitical_news_agent.run(quick=True))
# Tüm agent'lar aynı anda başladı
market_data = await market_task
goal        = await goal_task
news        = await news_task
```

### 2. Çok Katmanlı Fallback Sistemi
Hiçbir veri kaynağı tek noktada başarısız olamaz:

```
Birincil API → Yedek API → LRU Cache → Gerçekçi Rule-Based → Son Bilinen Veri
```

### 3. SHA-256 Tabanlı Haber Önbellekleme
```python
# URL değişse de başlık sabittir → cache key olarak kullan
cache_key = sha256(başlık.lower().encode())[:20]
# Aynı haberi ikinci kez Gemini/DeepL'e gönderme
```

### 4. SSE (Server-Sent Events) ile Aşamalı Render
Kullanıcı, analiz tamamlanmadan önce canlı piyasa verisini ve haber sinyallerini görür. Her agent tamamlandığında frontend anında güncellenir.

### 5. AI Yorum Güvence Ağı (3 Katman)
```
Gemini AI yorumu (LLM ✓ etiketi) 
    ↓ başarısız
Kural tabanlı (başlık + varlık + yön)
    ↓ başarısız  
Frontend fallback (entity extraction + keyword NLP)
```

### 6. Schema-Enforced Gemini Prompting
Gemini'ye JSON şeması zorlanır. `netGorus`, `kisaVadeBeklenti`, `guvenSkoru` gibi alanlar eksikse sistem fallback analiz üretir, asla boş dönemez.

---

## 🚀 Kurulum ve Çalıştırma

### Gereksinimler
- Python 3.11+
- Node.js 18+
- Git

### 1. Projeyi Klonla
```bash
git clone https://github.com/kullanici/piyasa-nabzi-ai.git
cd piyasa-nabzi-ai
```

### 2. Backend Kurulumu
```bash
cd backend

# Sanal ortam oluştur
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

# Bağımlılıkları yükle
pip install -r requirements.txt

# Ortam değişkenlerini yapılandır
cp .env.example .env
# .env dosyasını düzenle (en az GEMINI_API_KEY zorunlu)
```

### 3. Frontend Kurulumu
```bash
cd frontend
npm install
```

### 4. Başlatma

**Windows (tek komut):**
```powershell
.\start-all.ps1
```

**Manuel başlatma:**
```bash
# Terminal 1 — Backend
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

### 5. Docker ile Başlatma
```bash
docker-compose up --build
```

**Uygulama adresleri:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Dokümantasyon: http://localhost:8000/docs

---

## ⚙️ Ortam Değişkenleri

```env
# Zorunlu
GEMINI_API_KEY=your_gemini_api_key

# Önerilir
DEEPL_API_KEY=your_deepl_key         # Haber çevirisi için
COLLECTAPI_KEY=your_collect_key      # Türkçe haber için

# Opsiyonel
COINGECKO_API_KEY=your_cg_key        # CoinGecko Pro (daha yüksek limit)
FINNHUB_API_KEY=your_finnhub_key     # ABD hisseleri
TCMB_API_KEY=your_tcmb_key          # TCMB EVDS makro veri

# Sistem
SECRET_KEY=guclu-bir-rastgele-anahtar
USE_MOCK_DATA=false
CACHE_TTL_SECONDS=60
CORS_ORIGINS=http://localhost:5173
```

---

## 🖥️ Arayüz Sayfaları

### Intelligence Hub (`/`)
Sistemin AI mimarisini görselleştiren ana kontrol merkezi. 6 agent'ın canlı durumu, pipeline görseli, piyasa snapshot ve NLP haber sinyalleri tek ekranda.

### AI Asistan (`/asistan`)
Serbest Türkçe soru ile Gemini 2.5 Flash destekli finansal analiz. Üç senaryo (Koruyucu/Dengeli/Agresif), etkilenen varlıklar, risk göstergeleri ve what-if simülasyonu.

### NLP Haberler (`/haberler`)
Gerçek zamanlı haber akışı. Her haber için etki yönü (↑/↓/↔), risk seviyesi, etkilenen varlıklar ve doğrudan AI yorumu ("Bu haber Bitcoin fiyatını DÜŞÜRÜR."). Yükleme sırasında 7 aşamalı pipeline animasyonu.

### Piyasa (`/piyasa`)
Binance, Yahoo Finance ve TEFAS'tan canlı fiyatlar. Lightweight-charts ile mum grafikleri (1G/1H/1A/3A/1Y). CoinGecko fallback desteği.

### Simülasyon (`/simulasyon`)
Gerçek fiyatlarla paper trading. AI strateji önerileri, pre-trade etki analizi, performans grafikleri.

### Cüzdan (`/cuzdan`)
İki sekme: **Simülasyon Portföyü** (platform içi işlemler) + **Gerçek Portföy** (localStorage kalıcı, canlı fiyatlarla K/Z takibi). Her oturum açıldığında güncel K/Z gösterilir.

---

## 🧩 Mimari Özellikler

### Önbellek Stratejisi

| Katman | Mekanizma | TTL |
|---|---|---|
| API yanıtları | In-memory dict | 60s (kripto) / 300s (hisse) |
| Haber zenginleştirme | OrderedDict LRU (500) | Kalıcı (session) |
| OHLCV grafik | Dict, symbol+period | 5 dakika |
| Simülasyon verisi | SQLite | Kalıcı |
| Gerçek portföy | localStorage | Kalıcı (tarayıcı) |

### Hata Yönetimi

Her agent ve servis kendi hata sınırını yönetir:
- Timeout'lar (`httpx` ile per-request timeout)
- Circuit breaker pattern (başarısız API → fallback → son bilinen veri)
- Structured logging (timestamp, seviye, modül, mesaj)
- SSE stream hatası kullanıcıya iletilir, sistem çökmez

---

## 📈 Proje Geliştirme Süreci

Bu proje şu teknoloji alanlarını pratikte bir araya getirir:

- **NLP + LLM Entegrasyonu**: Yapılandırılmamış Türkçe metni finansal hedeflere dönüştürme
- **Multi-Agent Koordinasyon**: Bağımsız agent'ların asyncio ile paralel yürütülmesi
- **Çok Kaynaklı Veri Füzyonu**: Farklı format ve frekanstaki verilerin normalize edilmesi
- **Gerçek Zamanlı Streaming**: SSE ile aşamalı UI güncelleme
- **Ürün Kalitesi**: Fallback sistemleri, hata yönetimi, önbellekleme, kullanıcı deneyimi

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.

---

## 👥 Geliştirici Ekip

**Takım Adı:** TesseractTech

### Duygu Sezer
**Bilgisayar Mühendisliği Öğrencisi · Yapay Zekâ & NLP Geliştiricisi**  
Bursa Uludağ Üniversitesi — Bilgisayar Mühendisliği *(Eyl 2022 – Haziran 2026 mezunu)*  
sezerduygu465@gmail.com · [linkedin.com/in/duygusezrr](https://linkedin.com/in/duygusezrr) · [github.com/duygusezr](https://github.com/duygusezr)

**Deneyim:**
- 🏢 **Bursa Büyükşehir Belediyesi – CBS Şube Müdürlüğü** — Yazılım Mühendisliği Stajyeri *(Tem 2025 – Ağu 2025)*  
  .NET ve React ile İHA uçuş izin süreçlerini dijitalleştiren “Uçuş Seyir Defteri” geliştirildi; PostGIS ile coğrafi rota ve bölge analizi yapıldı.
- 🎮 **Uludağ Üniversitesi Dijital Oyun Tasarım Topluluğu** — Yönetim Kurulu Üyesi & Sayman *(Oca 2024 – Günümüz)*  
  Topluluk bütçesi yönetimi, sponsorluk görüşmeleri, Game Jam ve teknik etkinlik organizasyonları.
- 📊 **Spell Factory A.Ş. – The Infected Soul** — Gönüllü Pazarlama Yöneticisi *(Eyl 2025 – Günümüz)*  
  Sosyal medya stratejisi, yayıncı (streamer) iş birlikleri ve topluluk yönetimi.

**Öne Çıkan Projeler:**
- 🤖 **ELA — Gerçek Zamanlı 3D Avatar AI Asistan** *(Mar 2026 – Günümüz)*  
  WebSocket üzerinden sesli konuşma, duygu analizi ve 3D avatar animasyonu birleştiren AI asistan. Web Audio API ile lip-sync, Semantic Cache ile milisaniye yanıt süresi.
- 📜 **Doğal Dil Tabanlı Doküman Analiz Sistemi** *(Eki 2025 – Oca 2026)*  
  Türkçe PDF analizi için Tesseract OCR + yerel LLaMA modeliyle çevrimdışı RAG asistanı. ChromaDB + Docker ile veri gizliliği odaklı mimari.
- 👁️ **Görme Engelliler İçin Rehber Uygulaması** *(Oca 2024 – Haz 2024)*  
  Gerçek zamanlı nesne algılama (ROI) ve sesli uyarı sistemi; IoT tabanlı erişilebilirlik asistanı.

**Başarılar & Sertifikalar:**
- 🏆 **TEKNOFEST 2025 Türkçe NLP Yarışması — Finalist** *(Ağu 2025)*  
  Telekom sektörü için LLM + Agentic Framework tabanlı sesli/metin etkileşimli özerk asistan; dinamik araç kullanımı ve gelişmiş durum yönetimi.
- 🎓 **YÖK Veri Analizi Okulu** *(Eki 2025 – May 2026)*  
  135.000 başvuru arasından seçilen 50.000 katılımcıdan biri. Marmara Üniversitesi, Boğaziçi ve ODTÜ iş birliği. İleri istatistik, NLP, LLM entegrasyonu.

**Teknik Yetenekler:** Python · C# · C++ · JavaScript · .NET · React.js · FastAPI · TensorFlow · LangChain · ChromaDB · RAG · LLM · NLP · MCP · PostgreSQL · PostGIS · Docker · Unity · WebSocket · Three.js

---

### Eren Güngörmez
**Game & AI Developer · Girişimci**  
Bursa Uludağ Üniversitesi — Bilgisayar Programcılığı *(2022–2025 Mezun)*  
eren@spellfactory.games

**Deneyim:**
- 🏛️ **Umay Müze Tasarım ve Teknolojileri** — Yazılım Geliştiricisi *(Oca 2025 – Tem 2025)* · AR Book mobil uygulaması
- 🃏 **Clashub** — Unity Geliştiricisi *(Tem 2024 – Ağu 2024)* · Web3/NFT altyapılı kart oyunu
- 🎮 **Lodom Creations** — Kurucu Ortak & Oyun Geliştiricisi *(Nis 2023 – Eyl 2025)* · Bilişim Vadisi Erasmus+ Hackathon **1.si**
- 🔬 **Anticverse** — Temsilci Lider *(Eyl 2022 – Haz 2024)* · Üniversiteler arası teknoloji topluluğu
- 💼 **Dijital Gen Yazılım** — Stajyer Yazılım Geliştiricisi · Vakıflar Genel Müdürlüğü & Kültür Bakanlığı sesli rehber uygulaması

**Öne Çıkan Projeler:**
- 🎮 **The Infected Soul** — Psikolojik korku FPS · Steam'de yayınlandı · Unity + C#
- 🏛️ **Vakıf Eserleri Sesli Rehber** — 200 vakıf eserine yapay zekâ destekli görsel tanıma · Flutter + Python + TensorFlow
- 🗺️ **AR Navigasyon Sistemi** — Bezmiâlem Vakıf Üniversitesi AR kampüs navigasyonu · Unity
- 📚 **AR Book** — Çocuk hikayelerini AR ile deneyimleten mobil uygulama · Unity + Flutter

**Yarışma ve Etkinlikler:**
- 🥇 Bilişim Vadisi Erasmus+ Hackathon — **1.lik (Avrupa Birinciliği)**
- 🥉 Kütahya Game Jam 2023 — **3.lük**
- 🥈 IEEE Proje Yarışması — **2.lik** (Bursa Uludağ Üniversitesi)
- 🎪 GG Convention 2026 — Seçilen 50 indie stüdyodan biri olarak proje sergisi
- 🎤 DevFest Bursa 2023 & 2024 — Oyun geliştirme ve XR konuşmacısı
- 🎓 Anticverse İnegöl Teknoloji Kongresi — Organizatör & Konuşmacı (500+ öğrenci)

**Yetenekler:** Unity (C#) · Unreal Engine · AR/VR · Flutter · Python · TensorFlow · Computer Vision · CNN · AI Agent Sistemleri · n8n · Blender · Figma · Web3/NFT

---

> *"Finansal veri, yapay zekâ ve doğal dil işlemenin kesişiminde çok ajanlı bir karar destek sistemi."*
