"""
Sanal Portföy Simülasyon Servisi — Paper Trading
Gerçek para / gerçek emir yoktur. Tüm veriler simülasyon amaçlıdır.
Process restart'ta sıfırlanır (tasarım gereği — in-memory).
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.models.schemas import (
    SimulationAccount, SimulationPortfolioSummary,
    VirtualPosition, VirtualTransaction,
    SimulationStrategy, SimulationPerformance, AllocationItem,
    SimulationAsset, AssetImpactAnalysis, AssetScenario,
)

logger = logging.getLogger(__name__)

# ── In-memory state ────────────────────────────────────────────────────────────
_account: Optional[SimulationAccount] = None
_transactions: list[VirtualTransaction] = []


# ══════════════════════════════════════════════════════════════════════════════
# VARLIK TANIMI — Tüm işlem yapılabilecek sanal varlıklar
# ══════════════════════════════════════════════════════════════════════════════

_SIMULATION_ASSETS: list[dict] = [
    # ── Kripto ────────────────────────────────────────────────────────────────
    {"symbol": "BTC",   "name": "Bitcoin",              "category": "Kripto",           "price": 2_850_000, "change_pct": -0.8, "risk_level": "high",   "volatility_score": 9, "news_sensitivity": "high"},
    {"symbol": "ETH",   "name": "Ethereum",             "category": "Kripto",           "price":   108_500, "change_pct":  1.2, "risk_level": "high",   "volatility_score": 8, "news_sensitivity": "high"},
    {"symbol": "SOL",   "name": "Solana",               "category": "Kripto",           "price":     8_200, "change_pct": -1.5, "risk_level": "high",   "volatility_score": 9, "news_sensitivity": "medium"},
    {"symbol": "BNB",   "name": "BNB",                  "category": "Kripto",           "price":    25_600, "change_pct":  0.4, "risk_level": "high",   "volatility_score": 7, "news_sensitivity": "medium"},
    # ── Borsa İstanbul ────────────────────────────────────────────────────────
    {"symbol": "ASELS", "name": "ASELSAN",              "category": "Borsa İstanbul",   "price":      54.8, "change_pct":  1.2, "risk_level": "medium", "volatility_score": 6, "news_sensitivity": "high"},
    {"symbol": "THYAO", "name": "Türk Hava Yolları",    "category": "Borsa İstanbul",   "price":     301.5, "change_pct": -0.6, "risk_level": "medium", "volatility_score": 5, "news_sensitivity": "high"},
    {"symbol": "GARAN", "name": "Garanti BBVA",         "category": "Borsa İstanbul",   "price":     122.3, "change_pct":  0.4, "risk_level": "medium", "volatility_score": 5, "news_sensitivity": "medium"},
    {"symbol": "AKBNK", "name": "Akbank",               "category": "Borsa İstanbul",   "price":      78.5, "change_pct":  0.7, "risk_level": "medium", "volatility_score": 5, "news_sensitivity": "medium"},
    {"symbol": "KCHOL", "name": "Koç Holding",          "category": "Borsa İstanbul",   "price":     215.0, "change_pct": -0.3, "risk_level": "medium", "volatility_score": 4, "news_sensitivity": "medium"},
    {"symbol": "TUPRS", "name": "Tüpraş",               "category": "Borsa İstanbul",   "price":     185.6, "change_pct":  1.0, "risk_level": "medium", "volatility_score": 5, "news_sensitivity": "high"},
    {"symbol": "SISE",  "name": "Şişe Cam",             "category": "Borsa İstanbul",   "price":      42.3, "change_pct": -0.2, "risk_level": "medium", "volatility_score": 4, "news_sensitivity": "low"},
    {"symbol": "BIMAS", "name": "BİM Mağazaları",       "category": "Borsa İstanbul",   "price":     560.0, "change_pct":  0.8, "risk_level": "low",    "volatility_score": 3, "news_sensitivity": "low"},
    {"symbol": "FROTO", "name": "Ford Otosan",          "category": "Borsa İstanbul",   "price":   1_250.0, "change_pct":  0.5, "risk_level": "medium", "volatility_score": 5, "news_sensitivity": "medium"},
    # ── Değerli Madenler ──────────────────────────────────────────────────────
    {"symbol": "XAU",   "name": "Gram Altın",           "category": "Değerli Madenler", "price":     3_180, "change_pct":  0.6, "risk_level": "low",    "volatility_score": 3, "news_sensitivity": "medium"},
    {"symbol": "XAUUSD","name": "Ons Altın (USD)",      "category": "Değerli Madenler", "price":     3_280, "change_pct":  0.5, "risk_level": "low",    "volatility_score": 3, "news_sensitivity": "medium"},
    {"symbol": "XAG",   "name": "Gümüş",                "category": "Değerli Madenler", "price":     1_100, "change_pct":  1.1, "risk_level": "medium", "volatility_score": 5, "news_sensitivity": "medium"},
    # ── BIST Endeksleri ───────────────────────────────────────────────────────
    {"symbol": "XU100", "name": "BIST 100",             "category": "BIST Endeksleri",  "price":     9_850, "change_pct":  0.5, "risk_level": "medium", "volatility_score": 4, "news_sensitivity": "high"},
    {"symbol": "XU030", "name": "BIST 30",              "category": "BIST Endeksleri",  "price":    10_200, "change_pct":  0.4, "risk_level": "medium", "volatility_score": 4, "news_sensitivity": "high"},
    {"symbol": "XBANK", "name": "BIST Banka",           "category": "BIST Endeksleri",  "price":     5_600, "change_pct":  0.3, "risk_level": "medium", "volatility_score": 5, "news_sensitivity": "high"},
    {"symbol": "XUSIN", "name": "BIST Sınai",           "category": "BIST Endeksleri",  "price":     4_200, "change_pct":  0.7, "risk_level": "medium", "volatility_score": 4, "news_sensitivity": "medium"},
    # ── Fonlar ────────────────────────────────────────────────────────────────
    {"symbol": "PARA_FONU",      "name": "Para Piyasası Fonu",        "category": "Fonlar", "price": 1_000, "change_pct": 0.05, "risk_level": "low",    "volatility_score": 1, "news_sensitivity": "low"},
    {"symbol": "HISSE_FONU",     "name": "Hisse Senedi Fonu",         "category": "Fonlar", "price": 1_000, "change_pct":  0.4, "risk_level": "medium", "volatility_score": 5, "news_sensitivity": "medium"},
    {"symbol": "ALTIN_FONU",     "name": "Altın Fonu",                "category": "Fonlar", "price": 1_000, "change_pct":  0.3, "risk_level": "low",    "volatility_score": 2, "news_sensitivity": "low"},
    {"symbol": "BORCLANMA_FONU", "name": "Borçlanma Araçları Fonu",   "category": "Fonlar", "price": 1_000, "change_pct": 0.15, "risk_level": "low",    "volatility_score": 1, "news_sensitivity": "low"},
]

# Hızlı erişim dict'i
_ASSETS_BY_SYMBOL: dict[str, dict] = {a["symbol"]: a for a in _SIMULATION_ASSETS}


# ══════════════════════════════════════════════════════════════════════════════
# SENARYO TANIMLARI — Her kategori/varlık için
# ══════════════════════════════════════════════════════════════════════════════

def _build_scenarios(asset: dict) -> tuple[AssetScenario, AssetScenario, AssetScenario]:
    """Varlık kategorisine göre senaryo üret."""
    cat = asset["category"]
    sym = asset["symbol"]
    name = asset["name"]

    if cat == "Kripto":
        pos = AssetScenario(
            title="Pozitif Senaryo",
            description=f"Kurumsal talep artışı, ETF onay süreci veya makro pozitifleşme durumunda {name} tarafında yukarı yönlü hareket ihtimali güçlenebilir.",
            conditions=["Kurumsal fon girişi artıyor", "Fed faiz indirim beklentisi", "Regülasyon netleşiyor", "Risk iştahı yüksek"],
        )
        ntr = AssetScenario(
            title="Nötr Senaryo",
            description="Piyasa belirsizliği sürdüğünde fiyat geniş bantta yatay seyredebilir. Net bir yön beklentisi oluşmayabilir.",
            conditions=["Makro veri karışık", "Haber akışı dengeli", "Hacim düşük seyrediyor"],
        )
        neg = AssetScenario(
            title="Negatif Senaryo",
            description="Düzenleyici baskı, likidite sıkışması veya küresel risk iştahı azalması durumunda sert baskı oluşabilir.",
            conditions=["Regülasyon sıkılaşması", "Fed faiz artırım sinyali", "Risk iştahı düşüyor", "Kurumsal çıkış haberleri"],
        )
    elif cat == "Borsa İstanbul":
        if sym in ("ASELS",):
            pos = AssetScenario(
                title="Pozitif Senaryo",
                description="Savunma haber akışı güçlü, NATO harcamaları artıyor ve BIST 100 pozitif seyrediyorsa ASELSAN tarafında yukarı yönlü hareket ihtimali güçlenebilir.",
                conditions=["NATO savunma bütçeleri artıyor", "Yeni ihracat sözleşmeleri", "BIST 100 pozitif ayrışıyor", "Jeopolitik risk yüksek"],
            )
            ntr = AssetScenario(
                title="Nötr Senaryo",
                description="Haber akışı pozitif olsa da BIST genelinde zayıflık veya sektöre yönelik belirsizlik fiyatı yatay tutabilir.",
                conditions=["BIST genelinde yatay seyir", "Savunma haberleri fiyatlanmış", "Döviz dengeli"],
            )
            neg = AssetScenario(
                title="Negatif Senaryo",
                description="BIST genelinde satış baskısı, TL değer kaybı veya jeopolitik riskin azalması durumunda hisse üzerinde baskı oluşabilir.",
                conditions=["BIST genelinde satış", "Jeopolitik gerilim azalıyor", "Dövizde TL değer kaybı", "Kötü bilanço"],
            )
        elif sym in ("GARAN", "AKBNK"):
            pos = AssetScenario(
                title="Pozitif Senaryo",
                description="Faiz oranlarında düşüş beklentisi, kredi büyümesi ve enflasyonun gerilemesi banka hisselerini destekleyebilir.",
                conditions=["Faiz indirimi beklentisi güçleniyor", "Kredi büyümesi artıyor", "Enflasyon düşüyor", "TL istikrarlı"],
            )
            ntr = AssetScenario(
                title="Nötr Senaryo",
                description="Para politikasına yönelik belirsizlik veya BIST genelinde yönsel kayıp durumunda banka hisseleri yatay seyredebilir.",
                conditions=["TCMB kararı belirsiz", "Enflasyon sabit", "BIST nötr"],
            )
            neg = AssetScenario(
                title="Negatif Senaryo",
                description="Faiz artırım sürprizi, kredi takip oranlarında artış veya bankacılık sektörüne yönelik düzenleyici değişiklik baskı oluşturabilir.",
                conditions=["Faiz artırım sinyali", "Kredi takip oranı artıyor", "Regülasyon değişikliği", "Döviz volatilitesi yüksek"],
            )
        elif sym in ("THYAO",):
            pos = AssetScenario(
                title="Pozitif Senaryo",
                description="Yakıt fiyatlarında düşüş, yolcu trafiği artışı ve güçlü yaz sezonu THY hisselerini destekleyebilir.",
                conditions=["Petrol fiyatı düşüyor", "Yolcu trafiği rekor", "Güçlü sezon beklentisi", "Dolar/TL istikrarlı"],
            )
            ntr = AssetScenario(
                title="Nötr Senaryo",
                description="Yakıt maliyetleri dengeliyken döviz kuru baskısı karışık bir tablo yaratabilir.",
                conditions=["Petrol yatay", "Dolar/TL dengeli", "Sezon normal seyrediyor"],
            )
            neg = AssetScenario(
                title="Negatif Senaryo",
                description="Jeopolitik risk artışı, yakıt fiyatlarında yükseliş veya seyahat talebinin azalması hisseyi olumsuz etkileyebilir.",
                conditions=["Petrol fiyatı yükseliyor", "Jeopolitik gerilim artıyor", "Talep düşüyor", "TL değer kaybı"],
            )
        else:
            pos = AssetScenario(
                title="Pozitif Senaryo",
                description=f"BIST genelinde alıcılı seyir, güçlü bilanço beklentisi ve TL'de istikrar {name} tarafında yukarı yönlü hareket ihtimali yaratabilir.",
                conditions=["BIST pozitif momentum", "Güçlü bilanço beklentisi", "TL istikrarlı", "Yabancı yatırımcı ilgisi"],
            )
            ntr = AssetScenario(
                title="Nötr Senaryo",
                description="Haber akışı karışık ya da global piyasalar yönünü belirleyemezse fiyat yatay bantta seyredebilir.",
                conditions=["BIST yatay", "Haber akışı dengeli", "Döviz volatilitesi düşük"],
            )
            neg = AssetScenario(
                title="Negatif Senaryo",
                description="BIST genelinde satış baskısı, TL değer kaybı veya sektörel olumsuz haber durumunda baskı oluşabilir.",
                conditions=["BIST genelinde satış", "TL değer kaybı", "Olumsuz sektör haberi", "Yabancı çıkışı"],
            )
    elif cat == "Değerli Madenler":
        pos = AssetScenario(
            title="Pozitif Senaryo",
            description=f"Jeopolitik risk artışı, merkez bankası alımları ve enflasyon kaygılarının derinleşmesi {name} talebini destekleyebilir.",
            conditions=["Jeopolitik gerilim artıyor", "Merkez bankası alımları güçlü", "Fed gevşeme sinyali", "Enflasyon beklentisi yüksek"],
        )
        ntr = AssetScenario(
            title="Nötr Senaryo",
            description="Risk iştahı dengeli ve dolar görece istikrarlıysa fiyat yatay bantta seyredebilir.",
            conditions=["Dolar endeksi sabit", "Risk iştahı dengeli", "Merkez bankası sinyali nötr"],
        )
        neg = AssetScenario(
            title="Negatif Senaryo",
            description="Dolar güçlenmesi, Fed faiz artırım sinyali veya jeopolitik riskin azalması değerli maden fiyatlarında baskı oluşturabilir.",
            conditions=["Dolar güçleniyor", "Fed sıkılaşma sinyali", "Risk iştahı yüksek — güvenli liman talebi azalıyor"],
        )
    elif cat == "BIST Endeksleri":
        pos = AssetScenario(
            title="Pozitif Senaryo",
            description=f"Enflasyonun gerilemesi, faiz indirimi beklentisi ve yabancı yatırımcı ilgisi {name} endeksini destekleyebilir.",
            conditions=["Enflasyon gerilemesi", "TCMB faiz indirim sinyali", "Yabancı girişi artıyor", "Kurumsal güçlü bilanço dönemi"],
        )
        ntr = AssetScenario(
            title="Nötr Senaryo",
            description="Global belirsizlik ve karışık veri akışı endeksin net yön bulmasını engelleyebilir.",
            conditions=["Global piyasalar yatay", "Yerel ekonomi verileri karışık", "Döviz dengeli"],
        )
        neg = AssetScenario(
            title="Negatif Senaryo",
            description="Döviz volatilitesi, yüksek enflasyon sürprizi veya küresel risk iştahı azalması endeks üzerinde baskı oluşturabilir.",
            conditions=["TL değer kaybı hızlanıyor", "Enflasyon sürprizi yukarı yönlü", "Global satış baskısı", "Yabancı çıkışı"],
        )
    else:  # Fonlar
        pos = AssetScenario(
            title="Pozitif Senaryo",
            description="Fon getirisi altta yatan varlık sınıfına bağlıdır. Düşük riskli fonlar enflasyona karşı korunma sağlayabilir.",
            conditions=["Faiz oranları istikrarlı", "Fon yönetimi aktif strateji uyguluyor"],
        )
        ntr = AssetScenario(
            title="Nötr Senaryo",
            description="Piyasa koşulları değişmediğinde fon getirisi faiz/enflasyon düzeyinde seyreder.",
            conditions=["Piyasa koşulları dengeli", "Faiz sabit"],
        )
        neg = AssetScenario(
            title="Negatif Senaryo",
            description="Yüksek enflasyon dönemlerinde para piyasası fonunun reel getirisi negatif kalabilir.",
            conditions=["Enflasyon faizin üzerinde", "Piyasa likiditesi azalıyor"],
        )

    return pos, ntr, neg


# ══════════════════════════════════════════════════════════════════════════════
# AI STRATEJİLERİ
# ══════════════════════════════════════════════════════════════════════════════

AI_STRATEGIES: list[SimulationStrategy] = [
    SimulationStrategy(
        strategy_id="low_risk",
        name="Düşük Risk",
        description="Sermayeyi korumayı öncelik alan, düşük volatiliteli, ağırlıklı olarak nakit ve altın bazlı strateji.",
        allocation=[
            AllocationItem(asset="TL Nakit / Para Piyasası Fonu", percent=35),
            AllocationItem(asset="Gram Altın",                     percent=30),
            AllocationItem(asset="BIST 30",                        percent=20),
            AllocationItem(asset="Borçlanma Araçları Fonu",        percent=15),
        ],
        risk_score=3,
        opportunity_score=4,
        volatility_score=2,
        logic="Yüksek belirsizlik dönemlerinde sermayeyi korumak için nakit ve altın ağırlıklı dağılım tercih edilir. BIST 30 düşük volatiliteli mavi çiplerden oluşur.",
        invalidation=["Altın fiyatlarında sert düşüş", "TL değer kaybı hızlanması", "BIST genelinde uzun süreli satış"],
        risks=["Enflasyon nakit değerini eritebilir", "Altın volatilite dönemlerinde negatif etkilenebilir"],
    ),
    SimulationStrategy(
        strategy_id="balanced",
        name="Dengeli",
        description="Risk ve getiri dengesini gözeten, çeşitlendirilmiş varlık dağılımlı strateji.",
        allocation=[
            AllocationItem(asset="Altın",               percent=25),
            AllocationItem(asset="BIST Hisseleri",      percent=30),
            AllocationItem(asset="Döviz Bazlı Varlık",  percent=20),
            AllocationItem(asset="Kripto",              percent=15),
            AllocationItem(asset="Nakit",               percent=10),
        ],
        risk_score=5,
        opportunity_score=6,
        volatility_score=5,
        logic="Farklı varlık sınıflarına dağılım ile tek bir piyasanın etkisini sınırlar. Orta vadeli büyüme hedefi güder.",
        invalidation=["Küresel risk iştahının sert düşmesi", "Dolar/TL'de ani yükseliş", "Kripto piyasasında çöküş"],
        risks=["Kripto volatilitesi portföyü etkileyebilir", "Döviz riski her iki yönde çalışır"],
    ),
    SimulationStrategy(
        strategy_id="aggressive",
        name="Agresif",
        description="Yüksek getiri potansiyeli için yüksek risk alan, büyüme odaklı strateji.",
        allocation=[
            AllocationItem(asset="BIST Tema Hisseleri", percent=35),
            AllocationItem(asset="Kripto",              percent=25),
            AllocationItem(asset="Altın",               percent=20),
            AllocationItem(asset="Fon",                 percent=10),
            AllocationItem(asset="Nakit",               percent=10),
        ],
        risk_score=8,
        opportunity_score=9,
        volatility_score=9,
        logic="Yüksek büyüme potansiyeli olan varlıklara odaklanır. Kısa vadeli kayıp riski yüksek, ancak olumlu senaryolarda getiri potansiyeli güçlüdür.",
        invalidation=["BIST'te sert düşüş", "Kripto piyasasında uzun süreli düşüş", "Küresel resesyon sinyalleri"],
        risks=["Yüksek volatilite", "Kısa vadede ciddi kayıp ihtimali", "Likidite riski"],
    ),
]


# ══════════════════════════════════════════════════════════════════════════════
# YARDIMCI FONKSİYONLAR
# ══════════════════════════════════════════════════════════════════════════════

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_asset_meta(symbol: str) -> Optional[dict]:
    """Sembolden varlık meta verisi getir."""
    return _ASSETS_BY_SYMBOL.get(symbol.upper())


def _compute_risk_score(positions: list[VirtualPosition], total_value: float) -> int:
    """
    Portföy risk skoru hesapla (1-100).
    Her pozisyonun volatilite skoru × portföy ağırlığı ağırlıklı ortalaması.
    """
    if not positions or total_value <= 0:
        return 10

    weighted_vol = 0.0
    for pos in positions:
        meta = _get_asset_meta(pos.symbol)
        vol = meta["volatility_score"] if meta else 5
        weight = pos.market_value / total_value
        weighted_vol += vol * weight

    # 1-10 aralığındaki vol_score'u 1-100 aralığına dönüştür
    score = int(weighted_vol * 10)
    return max(1, min(100, score))


def _compute_volatility_score(positions: list[VirtualPosition], total_value: float) -> float:
    """Portföy ağırlıklı ortalama volatilite skoru (1-10)."""
    if not positions or total_value <= 0:
        return 1.0
    weighted = sum(
        (_get_asset_meta(p.symbol) or {}).get("volatility_score", 5) * (p.market_value / total_value)
        for p in positions
    )
    return round(weighted, 2)


def _enrich_positions(positions: list[VirtualPosition], total_value: float) -> list[VirtualPosition]:
    """Pozisyonlara güncel fiyat, market_value, pnl ve portfolio_weight ekle."""
    enriched = []
    for pos in positions:
        meta = _get_asset_meta(pos.symbol)
        current_price = meta["price"] if meta else pos.current_price
        market_value  = pos.quantity * current_price
        pnl           = market_value - (pos.quantity * pos.avg_cost)
        pnl_pct       = (pnl / (pos.quantity * pos.avg_cost) * 100) if pos.avg_cost > 0 else 0.0
        weight        = (market_value / total_value * 100) if total_value > 0 else 0.0

        enriched.append(VirtualPosition(
            symbol=pos.symbol,
            name=pos.name,
            quantity=pos.quantity,
            avg_cost=pos.avg_cost,
            current_price=current_price,
            pnl=round(pnl, 2),
            pnl_pct=round(pnl_pct, 2),
            category=meta["category"] if meta else pos.category,
            market_value=round(market_value, 2),
            portfolio_weight=round(weight, 2),
            risk_level=meta["risk_level"] if meta else pos.risk_level,
            news_sensitivity=meta["news_sensitivity"] if meta else pos.news_sensitivity,
        ))
    return enriched


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC API
# ══════════════════════════════════════════════════════════════════════════════

def get_assets() -> list[SimulationAsset]:
    """Tüm işlem yapılabilecek sanal varlıkları döndür."""
    now = _now_iso()
    return [
        SimulationAsset(
            symbol=a["symbol"],
            name=a["name"],
            category=a["category"],
            price=float(a["price"]),
            change_pct=float(a["change_pct"]),
            risk_level=a["risk_level"],
            volatility_score=a["volatility_score"],
            news_sensitivity=a["news_sensitivity"],
            data_status="mock",
            updated_at=now,
        )
        for a in _SIMULATION_ASSETS
    ]


def get_asset(symbol: str) -> Optional[SimulationAsset]:
    """Sembolden tek varlık getir."""
    meta = _get_asset_meta(symbol)
    if not meta:
        return None
    return SimulationAsset(
        symbol=meta["symbol"],
        name=meta["name"],
        category=meta["category"],
        price=float(meta["price"]),
        change_pct=float(meta["change_pct"]),
        risk_level=meta["risk_level"],
        volatility_score=meta["volatility_score"],
        news_sensitivity=meta["news_sensitivity"],
        data_status="mock",
        updated_at=_now_iso(),
    )


def get_asset_impact(symbol: str, amount: float, trade_type: str = "buy") -> Optional[AssetImpactAnalysis]:
    """
    Seçilen varlığın portföye, riske ve senaryolara etkisini hesapla.
    İşlem gerçekleşmeden önce kullanıcıya gösterilir (pre-trade analysis).
    """
    meta = _get_asset_meta(symbol)
    if not meta:
        return None

    # Mevcut portföy durumu
    acc = _account
    positions = acc.positions if acc else []
    cash      = acc.cash_balance if acc else amount

    # Mevcut pozisyon değerlerini hesapla
    positions_value = sum(
        (p.quantity * (_get_asset_meta(p.symbol) or {}).get("price", p.current_price))
        for p in positions
    )
    total_value = cash + positions_value if acc else amount

    # Mevcut sembol ağırlığı
    current_pos_value = next(
        (p.quantity * meta["price"] for p in positions if p.symbol == symbol), 0.0
    )
    weight_before = (current_pos_value / total_value * 100) if total_value > 0 else 0.0

    # İşlem sonrası ağırlık
    if trade_type == "buy":
        new_pos_value = current_pos_value + amount
        new_total     = total_value  # nakit azalır, varlık artar — net aynı
        cash_after    = cash - amount
    else:
        sell_value    = min(amount, current_pos_value)
        new_pos_value = current_pos_value - sell_value
        new_total     = total_value
        cash_after    = cash + sell_value

    weight_after = (new_pos_value / new_total * 100) if new_total > 0 else 0.0

    # Risk skor hesabı (basit model)
    vol = meta["volatility_score"]
    risk_before = _compute_risk_score(
        _enrich_positions(positions, positions_value + cash), total_value
    ) if acc else 10

    # İşlem sonrası tahmini risk (yeni ağırlık × vol ekler/azaltır)
    delta_weight = (weight_after - weight_before) / 100.0
    risk_after = int(min(100, max(1, risk_before + delta_weight * vol * 10)))

    vol_before = _compute_volatility_score(
        _enrich_positions(positions, positions_value + cash), total_value
    ) if acc else 1.0
    vol_after  = round(vol_before + delta_weight * vol, 2)

    concentration_risk = weight_after > 30.0
    max_daily_swing    = round(vol * 1.2, 1)

    # Uyarılar
    warnings: list[str] = []
    if vol >= 8:
        warnings.append(f"{meta['name']} yüksek volatilite taşıyor — kısa vadeli sert dalgalanmalar görülebilir.")
    if meta["news_sensitivity"] == "high":
        warnings.append("Haber duyarlılığı yüksek — önemli gelişmeler fiyatı hızlı etkileyebilir.")
    if concentration_risk:
        warnings.append("Bu işlem sonrası tek varlık yoğunlaşması oluşabilir (portföy ağırlığı >%30).")
    if trade_type == "buy" and cash_after < 0:
        warnings.append("Yetersiz sanal bakiye — bu işlem için yeterli nakit bulunmuyor.")

    pos_scenario, ntr_scenario, neg_scenario = _build_scenarios(meta)

    logger.info(
        "[simulation:impact] %s | %s | %.0f TL | ağırlık: %.1f%% → %.1f%% | risk: %d → %d",
        symbol, trade_type, amount, weight_before, weight_after, risk_before, risk_after,
    )

    return AssetImpactAnalysis(
        symbol=symbol,
        name=meta["name"],
        trade_type=trade_type,
        estimated_amount=round(amount, 2),
        portfolio_weight_before=round(weight_before, 2),
        portfolio_weight_after=round(weight_after, 2),
        risk_score_before=risk_before,
        risk_score_after=risk_after,
        volatility_before=vol_before,
        volatility_after=vol_after,
        concentration_risk=concentration_risk,
        news_risk=meta["news_sensitivity"],
        cash_after=round(cash_after, 2),
        positive_scenario=pos_scenario,
        neutral_scenario=ntr_scenario,
        negative_scenario=neg_scenario,
        related_news=[],
        warnings=warnings,
        max_daily_swing_pct=max_daily_swing,
    )


def get_portfolio_summary() -> Optional[SimulationPortfolioSummary]:
    """Kapsamlı portföy özeti döndür (tüm hesap + performans + risk)."""
    if _account is None:
        return None

    cash = _account.cash_balance
    raw_positions = _account.positions

    # Güncel fiyatlarla piyasa değerlerini hesapla
    positions_value = sum(
        p.quantity * (_get_asset_meta(p.symbol) or {}).get("price", p.current_price)
        for p in raw_positions
    )
    total_value = cash + positions_value
    positions   = _enrich_positions(raw_positions, total_value)

    risk_score  = _compute_risk_score(positions, total_value)
    vol_score   = _compute_volatility_score(positions, total_value)

    # P/L hesapları (basit simülasyon modeli — gerçek tarihsel veri yoktur)
    total_cost = sum(p.quantity * p.avg_cost for p in raw_positions)
    total_gain = positions_value - total_cost

    # Günlük: pozisyon change_pct ortalaması (ağırlıklı)
    if positions and total_value > 0:
        daily_pnl = sum(
            (_get_asset_meta(p.symbol) or {}).get("change_pct", 0) / 100 * p.market_value
            for p in positions
        )
    else:
        daily_pnl = 0.0

    daily_pnl_pct  = (daily_pnl / total_value * 100) if total_value > 0 else 0.0
    weekly_pnl     = daily_pnl * 5        # simülasyon tahmini
    weekly_pnl_pct = daily_pnl_pct * 5
    monthly_pnl    = daily_pnl * 22
    monthly_pnl_pct= daily_pnl_pct * 22

    total_return     = total_value - _account.initial_balance
    total_return_pct = (total_return / _account.initial_balance * 100) if _account.initial_balance > 0 else 0.0

    return SimulationPortfolioSummary(
        account_id=_account.id,
        initial_balance=_account.initial_balance,
        cash_balance=round(cash, 2),
        total_portfolio_value=round(total_value, 2),
        positions_value=round(positions_value, 2),
        positions=positions,
        daily_pnl=round(daily_pnl, 2),
        daily_pnl_pct=round(daily_pnl_pct, 4),
        weekly_pnl=round(weekly_pnl, 2),
        weekly_pnl_pct=round(weekly_pnl_pct, 4),
        monthly_pnl=round(monthly_pnl, 2),
        monthly_pnl_pct=round(monthly_pnl_pct, 4),
        total_return=round(total_return, 2),
        total_return_pct=round(total_return_pct, 4),
        risk_score=risk_score,
        volatility_score=vol_score,
        mode=_account.mode,
        active_strategy=_account.active_strategy,
        last_strategy_change=_account.last_strategy_change,
        created_at=_account.created_at,
    )


def get_account() -> Optional[SimulationAccount]:
    """Ham hesap verisini döndür (geriye dönük uyumluluk için)."""
    return _account


def create_account(initial_balance: float, mode: str = "manual", currency: str = "TRY") -> SimulationAccount:
    """Yeni sanal hesap oluştur."""
    global _account, _transactions
    _account = SimulationAccount(
        id="default",
        initial_balance=initial_balance,
        cash_balance=initial_balance,
        currency=currency,
        mode=mode,
        positions=[],
        created_at=_now_iso(),
    )
    _transactions = []
    logger.info("[simulation] Yeni hesap oluşturuldu: %.0f TL | mod: %s", initial_balance, mode)
    return _account


def buy(symbol: str, name: str, quantity: float, price: float) -> dict:
    """Sanal alım işlemi yap."""
    global _account, _transactions

    if _account is None:
        raise ValueError("Önce bir simülasyon hesabı oluşturun.")

    total = quantity * price
    if total > _account.cash_balance:
        raise ValueError(f"Yetersiz sanal bakiye. Mevcut: {_account.cash_balance:.2f} TL, Gerekli: {total:.2f} TL")

    meta = _get_asset_meta(symbol)

    # Pozisyonu güncelle veya oluştur
    existing = next((p for p in _account.positions if p.symbol == symbol), None)
    if existing:
        new_qty       = existing.quantity + quantity
        new_avg_cost  = (existing.quantity * existing.avg_cost + total) / new_qty
        existing.quantity  = new_qty
        existing.avg_cost  = new_avg_cost
        existing.current_price = price
        existing.market_value  = new_qty * price
        if meta:
            existing.category        = meta["category"]
            existing.risk_level      = meta["risk_level"]
            existing.news_sensitivity= meta["news_sensitivity"]
    else:
        _account.positions.append(VirtualPosition(
            symbol=symbol,
            name=name,
            quantity=quantity,
            avg_cost=price,
            current_price=price,
            pnl=0.0,
            pnl_pct=0.0,
            category=meta["category"] if meta else "",
            market_value=total,
            risk_level=meta["risk_level"] if meta else "medium",
            news_sensitivity=meta["news_sensitivity"] if meta else "medium",
        ))

    _account.cash_balance -= total

    tx = VirtualTransaction(
        id=str(uuid.uuid4())[:8],
        timestamp=_now_iso(),
        tx_type="buy",
        symbol=symbol,
        name=name,
        quantity=quantity,
        price=price,
        total=total,
    )
    _transactions.append(tx)
    logger.info("[simulation] ALIŞ: %s × %.4f @ %.2f = %.2f TL", symbol, quantity, price, total)
    return {"status": "ok", "transaction": tx.model_dump()}


def sell(symbol: str, quantity: float, price: float) -> dict:
    """Sanal satış işlemi yap."""
    global _account, _transactions

    if _account is None:
        raise ValueError("Önce bir simülasyon hesabı oluşturun.")

    pos = next((p for p in _account.positions if p.symbol == symbol), None)
    if not pos:
        raise ValueError(f"Portföyde {symbol} bulunamadı.")
    if quantity > pos.quantity:
        raise ValueError(f"Yetersiz pozisyon: {pos.quantity:.4f} adet mevcut, {quantity:.4f} satılmak isteniyor.")

    total    = quantity * price
    pnl      = (price - pos.avg_cost) * quantity

    pos.quantity      -= quantity
    pos.current_price  = price
    pos.market_value   = pos.quantity * price

    if pos.quantity <= 1e-9:
        _account.positions = [p for p in _account.positions if p.symbol != symbol]

    _account.cash_balance += total

    tx = VirtualTransaction(
        id=str(uuid.uuid4())[:8],
        timestamp=_now_iso(),
        tx_type="sell",
        symbol=symbol,
        name=pos.name if pos else symbol,
        quantity=quantity,
        price=price,
        total=total,
    )
    _transactions.append(tx)
    logger.info(
        "[simulation] SATIŞ: %s × %.4f @ %.2f = %.2f TL | K/Z: %.2f TL",
        symbol, quantity, price, total, pnl,
    )
    return {"status": "ok", "transaction": tx.model_dump(), "realized_pnl": round(pnl, 2)}


def get_transactions() -> list[VirtualTransaction]:
    """İşlem geçmişini yeniden olana göre sıralı döndür."""
    return list(reversed(_transactions))


def get_performance(range_key: str = "1d") -> SimulationPerformance:
    """Performans özeti döndür (simülasyon verisi)."""
    summary = get_portfolio_summary()
    if summary is None:
        return SimulationPerformance(
            range=range_key, initial_value=0, current_value=0, pnl=0, pnl_pct=0
        )

    if range_key == "1w":
        pnl     = summary.weekly_pnl
        pnl_pct = summary.weekly_pnl_pct
    elif range_key == "1m":
        pnl     = summary.monthly_pnl
        pnl_pct = summary.monthly_pnl_pct
    else:
        pnl     = summary.daily_pnl
        pnl_pct = summary.daily_pnl_pct

    return SimulationPerformance(
        range=range_key,
        initial_value=summary.initial_balance,
        current_value=summary.total_portfolio_value,
        pnl=round(pnl, 2),
        pnl_pct=round(pnl_pct, 4),
    )


def get_ai_strategies() -> list[SimulationStrategy]:
    """AI stratejilerini döndür."""
    return AI_STRATEGIES


def select_strategy(strategy_id: str) -> dict:
    """Kullanıcı AI stratejisi seçer — günde 1 kez değiştirebilir."""
    global _account

    if _account is None:
        raise ValueError("Önce bir simülasyon hesabı oluşturun.")

    # 24 saatte 1 kez değişim kontrolü
    if _account.last_strategy_change:
        last = datetime.fromisoformat(_account.last_strategy_change)
        if datetime.now(timezone.utc) - last < timedelta(hours=24):
            remaining = timedelta(hours=24) - (datetime.now(timezone.utc) - last)
            hours = int(remaining.total_seconds() // 3600)
            mins  = int((remaining.total_seconds() % 3600) // 60)
            raise ValueError(f"Strateji değişimi için {hours} saat {mins} dakika beklemeniz gerekiyor.")

    strategy = next((s for s in AI_STRATEGIES if s.strategy_id == strategy_id), None)
    if not strategy:
        raise ValueError(f"Strateji bulunamadı: {strategy_id}")

    _account.active_strategy      = strategy
    _account.last_strategy_change = _now_iso()
    logger.info("[simulation] Strateji seçildi: %s", strategy.name)
    return {"status": "ok", "strategy": strategy.model_dump()}
