"""
Sanal Portföy Simülasyon Servisi — Paper Trading
Gerçek para / gerçek emir yoktur. Tüm veriler simülasyon amaçlıdır.
Kullanıcı başına izole hesap + SQLite kalıcılığı.
"""
import uuid
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from time import time
from typing import Optional

from app.models.schemas import (
    SimulationAccount, SimulationPortfolioSummary,
    VirtualPosition, VirtualTransaction,
    SimulationStrategy, SimulationPerformance, AllocationItem,
    SimulationAsset, AssetImpactAnalysis, AssetScenario,
)

logger = logging.getLogger(__name__)

# ── Per-user in-memory cache (DB'den yüklenir, DB'ye kaydedilir) ─────────────
_accounts: dict[str, Optional[SimulationAccount]] = {}
_txs:      dict[str, list[VirtualTransaction]]    = {}


def _load_from_db(user_id: str) -> None:
    """Kullanıcı verisini DB'den belleğe yükle."""
    from app.database import db_load_account, db_load_transactions
    data = db_load_account(user_id)
    if data:
        try:
            _accounts[user_id] = SimulationAccount(**data)
        except Exception as e:
            logger.warning("[sim] DB hesap yüklenemedi (%s): %s", user_id, e)
            _accounts[user_id] = None
    else:
        _accounts[user_id] = None

    tx_rows = db_load_transactions(user_id)
    loaded_txs: list[VirtualTransaction] = []
    for row in tx_rows:
        try:
            loaded_txs.append(VirtualTransaction(**{k: v for k, v in row.items() if k != "user_id"}))
        except Exception:
            pass
    _txs[user_id] = loaded_txs


def _save_to_db(user_id: str) -> None:
    """Bellekteki hesabı DB'ye kaydet."""
    from app.database import db_save_account
    acc = _accounts.get(user_id)
    if acc:
        db_save_account(user_id, acc.model_dump(), _now_iso())


def _save_tx_to_db(user_id: str, tx: VirtualTransaction) -> None:
    """Tek bir işlemi DB'ye kaydet."""
    from app.database import db_insert_transaction
    db_insert_transaction(user_id, tx.model_dump())


def _get_acc(user_id: str) -> Optional[SimulationAccount]:
    """Kullanıcı hesabını döndür — yoksa DB'den yükle."""
    if user_id not in _accounts:
        _load_from_db(user_id)
    return _accounts.get(user_id)


def _get_txs_list(user_id: str) -> list[VirtualTransaction]:
    """Kullanıcı işlem listesini döndür — yoksa DB'den yükle."""
    if user_id not in _txs:
        _load_from_db(user_id)
    return _txs.get(user_id, [])


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

# ── Canlı fiyat güncelleme — TTL cache ───────────────────────────────────────
_LIVE_PRICE_TTL   = 60   # saniye
_last_price_sync: float = 0.0


async def _sync_live_prices() -> None:
    """
    Binance/TCMB/Yahoo Finance'dan canlı fiyatları çek ve
    _SIMULATION_ASSETS / _ASSETS_BY_SYMBOL sözlüğünü güncelle.
    60 saniyelik TTL — çok sık API çağrısı yapmaz.
    """
    global _last_price_sync
    if time() - _last_price_sync < _LIVE_PRICE_TTL:
        return

    try:
        from app.services.market_data_service import get_market_data
        market = await get_market_data()

        # market.assets içindeki tüm varlıkları sembol → fiyat olarak topla
        live: dict[str, float] = {}
        for asset in market.assets:
            if asset.price and asset.price > 0 and not asset.is_mock:
                live[asset.symbol] = asset.price

        updated = 0
        for asset_def in _SIMULATION_ASSETS:
            sym = asset_def["symbol"]
            if sym in live:
                old_price = asset_def["price"]
                new_price = live[sym]
                asset_def["price"] = new_price
                if old_price and old_price > 0:
                    asset_def["change_pct"] = round((new_price - old_price) / old_price * 100, 4)
                updated += 1

        # Ons altın varsa → gram altına çevir (1 troy ons = 31.1035 gram)
        xauusd_live = next(
            (a.price for a in market.assets if a.symbol == "XAUUSD" and not a.is_mock), None
        )
        if xauusd_live and xauusd_live > 0:
            xauusd_def = _ASSETS_BY_SYMBOL.get("XAUUSD")
            if xauusd_def:
                xauusd_def["price"] = xauusd_live
                updated += 1

        _last_price_sync = time()
        logger.info(
            "[simulation:sync] Canlı fiyatlar guncellendi: %d/%d varlik",
            updated, len(_SIMULATION_ASSETS)
        )
    except Exception as exc:
        logger.warning("[simulation:sync] Fiyat senkronizasyonu basarisiz: %s", exc)


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
    if not positions or total_value <= 0:
        return 10
    weighted_vol = 0.0
    for pos in positions:
        meta = _get_asset_meta(pos.symbol)
        vol = meta["volatility_score"] if meta else 5
        weight = pos.market_value / total_value
        weighted_vol += vol * weight
    score = int(weighted_vol * 10)
    return max(1, min(100, score))


def _compute_volatility_score(positions: list[VirtualPosition], total_value: float) -> float:
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

async def get_assets() -> list[SimulationAsset]:
    """Tüm işlem yapılabilecek sanal varlıkları döndür (canlı fiyatlarla)."""
    await _sync_live_prices()
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
            data_status="live",
            updated_at=now,
        )
        for a in _SIMULATION_ASSETS
    ]


async def get_asset(symbol: str) -> Optional[SimulationAsset]:
    """Sembolden tek varlık getir (canlı fiyatla)."""
    await _sync_live_prices()
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
        data_status="live",
        updated_at=_now_iso(),
    )


async def get_asset_impact(user_id: str, symbol: str, amount: float, trade_type: str = "buy") -> Optional[AssetImpactAnalysis]:
    """
    Seçilen varlığın portföye, riske ve senaryolara etkisini hesapla.
    İşlem gerçekleşmeden önce kullanıcıya gösterilir (pre-trade analysis).
    """
    await _sync_live_prices()
    meta = _get_asset_meta(symbol)
    if not meta:
        return None

    acc = _get_acc(user_id)
    positions = acc.positions if acc else []
    cash      = acc.cash_balance if acc else amount

    positions_value = sum(
        (p.quantity * (_get_asset_meta(p.symbol) or {}).get("price", p.current_price))
        for p in positions
    )
    total_value = cash + positions_value if acc else amount

    current_pos_value = next(
        (p.quantity * meta["price"] for p in positions if p.symbol == symbol), 0.0
    )
    weight_before = (current_pos_value / total_value * 100) if total_value > 0 else 0.0

    if trade_type == "buy":
        new_pos_value = current_pos_value + amount
        new_total     = total_value
        cash_after    = cash - amount
    else:
        sell_value    = min(amount, current_pos_value)
        new_pos_value = current_pos_value - sell_value
        new_total     = total_value
        cash_after    = cash + sell_value

    weight_after = (new_pos_value / new_total * 100) if new_total > 0 else 0.0

    vol = meta["volatility_score"]
    risk_before = _compute_risk_score(
        _enrich_positions(positions, positions_value + cash), total_value
    ) if acc else 10

    delta_weight = (weight_after - weight_before) / 100.0
    risk_after = int(min(100, max(1, risk_before + delta_weight * vol * 10)))

    vol_before = _compute_volatility_score(
        _enrich_positions(positions, positions_value + cash), total_value
    ) if acc else 1.0
    vol_after  = round(vol_before + delta_weight * vol, 2)

    concentration_risk = weight_after > 30.0
    max_daily_swing    = round(vol * 1.2, 1)

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


async def get_portfolio_summary(user_id: str) -> Optional[SimulationPortfolioSummary]:
    """Kapsamlı portföy özeti döndür (tüm hesap + performans + risk)."""
    acc = _get_acc(user_id)
    if acc is None:
        return None

    await _sync_live_prices()

    cash = acc.cash_balance
    raw_positions = acc.positions

    positions_value = sum(
        p.quantity * (_get_asset_meta(p.symbol) or {}).get("price", p.current_price)
        for p in raw_positions
    )
    total_value = cash + positions_value
    positions   = _enrich_positions(raw_positions, total_value)

    risk_score  = _compute_risk_score(positions, total_value)
    vol_score   = _compute_volatility_score(positions, total_value)

    total_cost = sum(p.quantity * p.avg_cost for p in raw_positions)
    total_gain = positions_value - total_cost

    if positions and total_value > 0:
        daily_pnl = sum(
            (_get_asset_meta(p.symbol) or {}).get("change_pct", 0) / 100 * p.market_value
            for p in positions
        )
    else:
        daily_pnl = 0.0

    daily_pnl_pct  = (daily_pnl / total_value * 100) if total_value > 0 else 0.0
    weekly_pnl     = daily_pnl * 5
    weekly_pnl_pct = daily_pnl_pct * 5
    monthly_pnl    = daily_pnl * 22
    monthly_pnl_pct= daily_pnl_pct * 22

    total_return     = total_value - acc.initial_balance
    total_return_pct = (total_return / acc.initial_balance * 100) if acc.initial_balance > 0 else 0.0

    return SimulationPortfolioSummary(
        account_id=acc.id,
        initial_balance=acc.initial_balance,
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
        mode=acc.mode,
        active_strategy=acc.active_strategy,
        last_strategy_change=acc.last_strategy_change,
        created_at=acc.created_at,
    )


def get_account(user_id: str) -> Optional[SimulationAccount]:
    """Ham hesap verisini döndür."""
    return _get_acc(user_id)


def create_account(user_id: str, initial_balance: float, mode: str = "manual", currency: str = "TRY") -> SimulationAccount:
    """Yeni sanal hesap oluştur (varsa üzerine yaz)."""
    from app.database import db_delete_account
    acc = SimulationAccount(
        id=user_id,
        initial_balance=initial_balance,
        cash_balance=initial_balance,
        currency=currency,
        mode=mode,
        positions=[],
        created_at=_now_iso(),
    )
    _accounts[user_id] = acc
    _txs[user_id] = []
    db_delete_account(user_id)
    _save_to_db(user_id)
    logger.info("[simulation] Yeni hesap oluşturuldu: user=%s %.0f TL | mod: %s", user_id, initial_balance, mode)
    return acc


def buy(user_id: str, symbol: str, name: str, quantity: float, price: float) -> dict:
    """Sanal alım işlemi yap."""
    acc = _get_acc(user_id)
    if acc is None:
        raise ValueError("Önce bir simülasyon hesabı oluşturun.")

    total = quantity * price
    if total > acc.cash_balance:
        raise ValueError(f"Yetersiz sanal bakiye. Mevcut: {acc.cash_balance:.2f} TL, Gerekli: {total:.2f} TL")

    meta = _get_asset_meta(symbol)

    existing = next((p for p in acc.positions if p.symbol == symbol), None)
    if existing:
        new_qty       = existing.quantity + quantity
        new_avg_cost  = (existing.quantity * existing.avg_cost + total) / new_qty
        existing.quantity      = new_qty
        existing.avg_cost      = new_avg_cost
        existing.current_price = price
        existing.market_value  = new_qty * price
        if meta:
            existing.category         = meta["category"]
            existing.risk_level       = meta["risk_level"]
            existing.news_sensitivity = meta["news_sensitivity"]
    else:
        acc.positions.append(VirtualPosition(
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

    acc.cash_balance -= total

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
    _get_txs_list(user_id).insert(0, tx)  # en yeni başa
    _save_to_db(user_id)
    _save_tx_to_db(user_id, tx)

    logger.info("[simulation] ALIŞ: user=%s %s × %.4f @ %.2f = %.2f TL", user_id, symbol, quantity, price, total)
    return {"status": "ok", "transaction": tx.model_dump()}


def sell(user_id: str, symbol: str, quantity: float, price: float) -> dict:
    """Sanal satış işlemi yap."""
    acc = _get_acc(user_id)
    if acc is None:
        raise ValueError("Önce bir simülasyon hesabı oluşturun.")

    pos = next((p for p in acc.positions if p.symbol == symbol), None)
    if not pos:
        raise ValueError(f"Portföyde {symbol} bulunamadı.")
    if quantity > pos.quantity:
        raise ValueError(f"Yetersiz pozisyon: {pos.quantity:.4f} adet mevcut, {quantity:.4f} satılmak isteniyor.")

    total = quantity * price
    pnl   = (price - pos.avg_cost) * quantity

    pos.quantity      -= quantity
    pos.current_price  = price
    pos.market_value   = pos.quantity * price

    if pos.quantity <= 1e-9:
        acc.positions = [p for p in acc.positions if p.symbol != symbol]

    acc.cash_balance += total

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
    _get_txs_list(user_id).insert(0, tx)
    _save_to_db(user_id)
    _save_tx_to_db(user_id, tx)

    logger.info(
        "[simulation] SATIŞ: user=%s %s × %.4f @ %.2f = %.2f TL | K/Z: %.2f TL",
        user_id, symbol, quantity, price, total, pnl,
    )
    return {"status": "ok", "transaction": tx.model_dump(), "realized_pnl": round(pnl, 2)}


def get_transactions(user_id: str) -> list[VirtualTransaction]:
    """İşlem geçmişini yeniden olana göre sıralı döndür."""
    return list(_get_txs_list(user_id))


async def get_performance(user_id: str, range_key: str = "1d") -> SimulationPerformance:
    """Performans özeti döndür (simülasyon verisi)."""
    summary = await get_portfolio_summary(user_id)
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


def select_strategy(user_id: str, strategy_id: str, custom_allocation: Optional[list[AllocationItem]] = None) -> dict:
    """Kullanıcı AI stratejisi seçer — günde 1 kez değiştirebilir."""
    acc = _get_acc(user_id)
    if acc is None:
        raise ValueError("Önce bir simülasyon hesabı oluşturun.")

    # 24 saatte 1 kez değişim kontrolü
    if acc.last_strategy_change:
        last = datetime.fromisoformat(acc.last_strategy_change)
        if datetime.now(timezone.utc) - last < timedelta(hours=24):
            remaining = timedelta(hours=24) - (datetime.now(timezone.utc) - last)
            hours = int(remaining.total_seconds() // 3600)
            mins  = int((remaining.total_seconds() % 3600) // 60)
            raise ValueError(f"Strateji değişimi için {hours} saat {mins} dakika beklemeniz gerekiyor.")

    strategy = next((s for s in AI_STRATEGIES if s.strategy_id == strategy_id), None)
    if not strategy:
        raise ValueError(f"Strateji bulunamadı: {strategy_id}")

    import copy
    strategy_to_use = copy.deepcopy(strategy)
    if custom_allocation:
        total_percent = sum(item.percent for item in custom_allocation)
        if abs(total_percent - 100) > 1:
            raise ValueError(f"Tahsisat oranları toplamı %100 olmalıdır (şu an: %{total_percent})")
        strategy_to_use.allocation = custom_allocation

    acc.active_strategy      = strategy_to_use
    acc.last_strategy_change = _now_iso()
    logger.info("[simulation] Strateji seçildi: user=%s strateji=%s", user_id, strategy_to_use.name)

    _STRATEGY_SYMBOL_MAP: dict[str, list[str]] = {
        "TL Nakit / Para Piyasası Fonu": [],
        "Gram Altın":                    ["XAU"],
        "BIST 30":                       ["XU030"],
        "Borçlanma Araçları Fonu":       ["BORCLANMA_FONU"],
        "Altın":                         ["XAU"],
        "BIST Hisseleri":                ["GARAN", "THYAO"],
        "Döviz Bazlı Varlık":            ["XAUUSD"],
        "Kripto":                        ["BTC"],
        "Nakit":                         [],
        "BIST Tema Hisseleri":           ["ASELS", "THYAO", "FROTO"],
        "Fon":                           ["HISSE_FONU"],
    }

    executed_trades: list[dict] = []
    snapshot_cash = acc.cash_balance

    txs = _get_txs_list(user_id)

    for alloc in strategy_to_use.allocation:
        symbols = _STRATEGY_SYMBOL_MAP.get(alloc.asset, [])
        if not symbols:
            logger.info(
                "[simulation:strategy] '%s' → nakit olarak tutuldu (%%%d)",
                alloc.asset, alloc.percent
            )
            continue

        budget = snapshot_cash * (alloc.percent / 100.0)
        if budget <= 0:
            continue

        budget_per_symbol = budget / len(symbols)

        for sym in symbols:
            meta = _get_asset_meta(sym)
            if not meta:
                logger.warning("[simulation:strategy] Sembol bulunamadı: %s", sym)
                continue
            price = float(meta["price"])
            if price <= 0:
                continue
            quantity = round(budget_per_symbol / price, 6)
            if quantity <= 0:
                continue
            total = quantity * price
            if total > acc.cash_balance:
                logger.warning(
                    "[simulation:strategy] Yetersiz bakiye — %s için %.2f TL gerekli, %.2f TL mevcut",
                    sym, total, acc.cash_balance
                )
                continue

            existing = next((p for p in acc.positions if p.symbol == sym), None)
            if existing:
                new_qty      = existing.quantity + quantity
                new_avg_cost = (existing.quantity * existing.avg_cost + total) / new_qty
                existing.quantity      = new_qty
                existing.avg_cost      = new_avg_cost
                existing.current_price = price
                existing.market_value  = new_qty * price
            else:
                acc.positions.append(VirtualPosition(
                    symbol=sym,
                    name=meta["name"],
                    quantity=quantity,
                    avg_cost=price,
                    current_price=price,
                    pnl=0.0,
                    pnl_pct=0.0,
                    category=meta["category"],
                    market_value=total,
                    risk_level=meta["risk_level"],
                    news_sensitivity=meta["news_sensitivity"],
                ))

            acc.cash_balance -= total

            tx = VirtualTransaction(
                id=str(uuid.uuid4())[:8],
                timestamp=_now_iso(),
                tx_type="buy",
                symbol=sym,
                name=meta["name"],
                quantity=quantity,
                price=price,
                total=total,
            )
            txs.insert(0, tx)
            _save_tx_to_db(user_id, tx)
            executed_trades.append(tx.model_dump())
            logger.info(
                "[simulation:strategy] OTO-ALIŞ: user=%s %s x %.4f @ %.2f = %.2f TL  (strateji: %s)",
                user_id, sym, quantity, price, total, strategy_to_use.name
            )

    _save_to_db(user_id)
    logger.info(
        "[simulation:strategy] Strateji uygulandı: user=%s %s | %d işlem | kalan nakit: %.2f TL",
        user_id, strategy_to_use.name, len(executed_trades), acc.cash_balance
    )
    return {
        "status": "ok",
        "strategy": strategy_to_use.model_dump(),
        "executed_trades": executed_trades,
        "remaining_cash": round(acc.cash_balance, 2),
    }
