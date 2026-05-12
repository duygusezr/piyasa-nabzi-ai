import asyncio
import json
import logging
import logging.config
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from app.config import settings

# ── Logging yapılandırması ─────────────────────────────────────────────────────
logging.config.dictConfig({
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            "datefmt": "%H:%M:%S",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
            "stream": "ext://sys.stdout",
        }
    },
    "root": {
        "level": "INFO",
        "handlers": ["console"],
    },
    "loggers": {
        "app": {"level": "DEBUG", "propagate": True},
        "httpx":         {"level": "WARNING", "propagate": True},
        "httpcore":      {"level": "WARNING", "propagate": True},
        "google":        {"level": "WARNING", "propagate": True},
        "urllib3":       {"level": "WARNING", "propagate": True},
    },
})

logger = logging.getLogger(__name__)

from app.models.schemas import (
    GoalRequest,
    FullAnalysisRequest,
    FullAnalysisResponse,
    MarketData,
    AssistantAnalysis, AffectedAsset, ActionableOption,
    AllocationItem, AssistantScenario,
    CreditRates,
    MarketCalendarEvent,
    AssistantAskRequest,
    AssistantAskResponse,
    PortfolioContext,
    PortfolioPositionSummary,
    WhatIfResult,
    WhatIfPositionImpact,
    SimulationAccount,
    SimulationCreateRequest,
    SimulationBuyRequest,
    SimulationSellRequest,
    SimulationStrategySelectRequest,
    SimulationPerformance,
    SimulationStrategy,
    VirtualTransaction,
    SimulationAsset,
    AssetImpactAnalysis,
    SimulationPortfolioSummary,
)
from app.agents import (
    user_goal_agent,
    market_data_agent,
    geopolitical_news_agent,
    simulation_portfolio_agent,
)
from app.agents.asset_impact_agent import _rule_based_impact
from app.services.scenario_service import build_simulation_portfolio
from app.services.gemini_service import generate_assistant_analysis
from app.services.history_service import get_market_history, set_usd_try_rate
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

app = FastAPI(
    title="Piyasa Nabzı AI",
    description="Gerçek zamanlı piyasa verileri ve dünya siyasetiyle finansal senaryo analizi",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth helpers (inline — router bağımlılığını kaldır) ───────────────────────
_bearer = HTTPBearer(auto_error=False)

class _RegisterReq(BaseModel):
    email: str
    password: str

class _LoginReq(BaseModel):
    email: str
    password: str

def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    if not creds:
        raise HTTPException(401, "Giriş yapmanız gerekiyor.")
    from app.services.auth_service import decode_token
    payload = decode_token(creds.credentials)
    if not payload:
        raise HTTPException(401, "Oturum süresi dolmuş veya geçersiz token.")
    return payload

@app.post("/api/auth/register", tags=["auth"])
async def auth_register(req: _RegisterReq):
    from app.services.auth_service import register_user
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "Geçerli bir e-posta adresi girin.")
    if len(req.password) < 6:
        raise HTTPException(400, "Şifre en az 6 karakter olmalıdır.")
    result = register_user(email, req.password)
    if result is None:
        raise HTTPException(409, "Bu e-posta adresi zaten kayıtlı.")
    return {"token": result["token"], "user": {"id": result["id"], "email": result["email"]}}

@app.post("/api/auth/login", tags=["auth"])
async def auth_login(req: _LoginReq):
    from app.services.auth_service import login_user
    result = login_user(req.email, req.password)
    if result is None:
        raise HTTPException(401, "E-posta veya şifre hatalı.")
    return {"token": result["token"], "user": {"id": result["id"], "email": result["email"]}}

@app.get("/api/auth/me", tags=["auth"])
async def auth_me(current_user: dict = Depends(get_current_user)):
    from app.services.auth_service import get_user_by_id
    user = get_user_by_id(current_user["sub"])
    if not user:
        raise HTTPException(404, "Kullanıcı bulunamadı.")
    return {"id": user["id"], "email": user["email"], "created_at": user["created_at"]}


# ── Veritabanı başlatma ────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    from app.database import init_db
    init_db()
    logger.info("[startup] Veritabanı hazır.")


AGENT_FLOW = [
    "Kullanıcı Hedefi Ayrıştırıldı",
    "Gerçek Zamanlı Piyasa Verisi Çekildi",
    "Haber Sinyalleri Analiz Edildi",
    "AI Finansal Analiz Üretildi",
    "Simülasyon Portföyü Hazırlandı",
]


def _build_assistant_analysis(raw: dict) -> AssistantAnalysis:
    logger.info("[main:assistant] AssistantAnalysis olusturuluyor — anahtarlar: %s", list(raw.keys()))

    def _to_allocation(a: dict) -> AllocationItem:
        pct = a.get("percent") or a.get("percentage") or 0
        return AllocationItem(asset=str(a.get("asset", "")), percent=int(pct))

    def _to_affected_asset(a: dict) -> AffectedAsset:
        return AffectedAsset(
            asset=str(a.get("asset", "")),
            possibleEffect=str(a.get("possibleEffect") or a.get("possible_effect") or ""),
            reason=str(a.get("reason", "")),
            riskLevel=str(a.get("riskLevel") or a.get("risk_level") or "orta"),
        )

    def _to_action_option(o: dict) -> ActionableOption:
        return ActionableOption(
            title=str(o.get("title", "")),
            description=str(o.get("description", "")),
            whenUseful=str(o.get("whenUseful") or o.get("when_useful") or ""),
            risk=str(o.get("risk", "orta")),
        )

    def _to_scenario(s: dict) -> "AssistantScenario | None":
        try:
            alloc = []
            for a in s.get("allocation", []):
                try:
                    alloc.append(_to_allocation(a))
                except Exception as ae:
                    logger.warning("[main:assistant] Allocation item atildi: %s | item: %s", ae, a)
            return AssistantScenario(
                name=str(s.get("name", "Senaryo")),
                allocation=alloc,
                logic=str(s.get("logic", "")),
                riskScore=int(s.get("riskScore") or s.get("risk_score") or 5),
                opportunityScore=int(s.get("opportunityScore") or s.get("opportunity_score") or 5),
                volatilityScore=int(s.get("volatilityScore") or s.get("volatility_score") or 5),
            )
        except Exception as se:
            logger.error("[main:assistant] Senaryo olusturma hatasi ('%s'): %s", s.get("name", "?"), se)
            return None

    try:
        affected_assets = []
        for a in raw.get("affectedAssets", []):
            try:
                affected_assets.append(_to_affected_asset(a))
            except Exception as ae:
                logger.warning("[main:assistant] AffectedAsset atildi: %s | item: %s", ae, a)

        action_options = []
        for o in raw.get("actionableOptions", []):
            try:
                action_options.append(_to_action_option(o))
            except Exception as oe:
                logger.warning("[main:assistant] ActionableOption atildi: %s | item: %s", oe, o)

        scenarios = [sc for s in raw.get("scenarios", []) if (sc := _to_scenario(s)) is not None]

        result = AssistantAnalysis(
            directAnswer=raw.get("directAnswer", ""),
            marketContext=raw.get("marketContext", ""),
            affectedAssets=affected_assets,
            actionableOptions=action_options,
            scenarios=scenarios,
            whatToWatch=raw.get("whatToWatch", []),
            scenarioInvalidation=raw.get("scenarioInvalidation", []),
            risks=raw.get("risks", []),
            conclusion=raw.get("conclusion", ""),
            disclaimer=raw.get("disclaimer", "Bu icerik yatirim tavsiyesi degildir; egitim ve simulasyon amaclidir."),
        )
        logger.info(
            "[main:assistant] [OK] Hazir — %d senaryo, %d varlik, %d eylem | directAnswer: %d karakter",
            len(result.scenarios), len(result.affectedAssets), len(result.actionableOptions),
            len(result.directAnswer)
        )
        return result

    except Exception as exc:
        logger.error("[main:assistant] [FAIL] AssistantAnalysis olusturma HATASI: %s", exc, exc_info=True)
        logger.error("[main:assistant] Hatali raw dict: %s", json.dumps(raw, ensure_ascii=False, default=str)[:800])
        return AssistantAnalysis()


def _sse(event_type: str, data: dict) -> str:
    return f"data: {json.dumps({'type': event_type, 'data': data}, ensure_ascii=False)}\n\n"


@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "Piyasa Nabzı AI",
        "version": "1.0.0",
        "gemini_configured": bool(settings.GEMINI_API_KEY),
        "mock_mode": settings.USE_MOCK_DATA,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/analyze-goal")
async def analyze_goal(request: GoalRequest):
    try:
        goal = await user_goal_agent.run(request.message)
        return {
            "parsed_goal": goal.parsed_goal.model_dump(),
            "risk_warning": goal.warning,
            "summary": goal.summary,
            "realism": goal.realism,
            "risk_level": goal.risk_level.value,
            "disclaimer": "Bu içerik yatırım tavsiyesi değildir.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/market-data")
async def get_market_data():
    try:
        data: MarketData = await market_data_agent.run()
        # Kripto→TRY çevrimi için USD/TRY kurunu history service'e kaydet
        if data and data.usd_try and data.usd_try.price > 0:
            set_usd_try_rate(data.usd_try.price)
        return data.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/market/history")
async def get_history(
    symbol: str = Query(..., min_length=1, max_length=20),
    period: str = Query("1M", pattern="^(1D|1W|1M|3M|1Y)$"),
):
    """
    Sembol ve periyot için gerçek OHLCV mum grafik verisi döner.
    Kripto → Binance klines API (USDT → TRY çevrimi)
    Hisse/Endeks/Emtia/Döviz → Yahoo Finance chart API
    """
    try:
        candles = await get_market_history(symbol.upper(), period)
        return {
            "symbol": symbol.upper(),
            "period": period,
            "candles": candles,
            "count": len(candles),
            "currency": "TRY",
        }
    except Exception as e:
        logger.error("[history] %s/%s hata: %s", symbol, period, e)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/news-signals")
async def get_news_signals():
    try:
        signals = await geopolitical_news_agent.run()
        return {
            "signals": [s.model_dump() for s in signals],
            "count": len(signals),
            "disclaimer": "Bu içerik yatırım tavsiyesi değildir.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/market-calendar")
async def get_market_calendar():
    """Statik piyasa takvimi ve hatırlatıcılar."""
    events = [
        {"id": "evt-001", "title": "TCMB Para Politikası Kurulu Toplantısı", "date": "2026-06-19", "time": "14:00", "event_type": "merkez_bankasi", "importance": "yüksek", "affected_assets": ["USD/TRY", "BIST 100", "Altın"], "description": "Türkiye Cumhuriyet Merkez Bankası politika faizi kararı açıklanacak."},
        {"id": "evt-002", "title": "TÜFE Enflasyon Verisi", "date": "2026-06-03", "time": "10:00", "event_type": "ekonomik", "importance": "yüksek", "affected_assets": ["USD/TRY", "BIST 100"], "description": "Mayıs ayı tüketici fiyat endeksi açıklanacak."},
        {"id": "evt-003", "title": "Fed Faiz Kararı", "date": "2026-06-18", "time": "21:00", "event_type": "merkez_bankasi", "importance": "yüksek", "affected_assets": ["Bitcoin", "Altın", "USD/TRY"], "description": "ABD Merkez Bankası (Fed) faiz kararı ve Powell açıklaması."},
        {"id": "evt-004", "title": "Çeyrek Sonu Bilanço Dönemi", "date": "2026-06-30", "time": "", "event_type": "kap", "importance": "orta", "affected_assets": ["BIST 100", "BIST 30"], "description": "Q2 bilanço döneminde şirket haberleri yoğunlaşacak."},
        {"id": "evt-005", "title": "OPEC+ Toplantısı", "date": "2026-06-05", "time": "12:00", "event_type": "ekonomik", "importance": "orta", "affected_assets": ["Brent Petrol", "BIST 100"], "description": "OPEC+ üretim kararları petrol fiyatlarını etkileyebilir."},
        {"id": "evt-006", "title": "Türkiye Büyüme Verisi (GSYİH)", "date": "2026-06-10", "time": "10:00", "event_type": "ekonomik", "importance": "orta", "affected_assets": ["USD/TRY", "BIST 100"], "description": "Q1 2026 GSYİH büyüme verisi açıklanacak."},
        {"id": "evt-007", "title": "KAP Açıklama Yoğunluğu", "date": "2026-06-01", "time": "", "event_type": "kap", "importance": "düşük", "affected_assets": ["BIST 100"], "description": "Haziran başında KAP açıklamaları yoğunlaşabilir."},
        {"id": "evt-008", "title": "ABD Tarım Dışı İstihdam (NFP)", "date": "2026-06-07", "time": "15:30", "event_type": "ekonomik", "importance": "yüksek", "affected_assets": ["Altın", "Bitcoin", "USD/TRY"], "description": "ABD istihdam verisi küresel piyasaları doğrudan etkiler."},
        {"id": "evt-009", "title": "Jeopolitik Risk Takibi", "date": "2026-06-01", "time": "", "event_type": "diger", "importance": "orta", "affected_assets": ["Altın", "Brent Petrol"], "description": "Bölgesel gerilimler piyasa volatilitesini artırabilir."},
        {"id": "evt-010", "title": "Halka Arz Takvimi", "date": "2026-06-15", "time": "", "event_type": "kap", "importance": "düşük", "affected_assets": ["BIST 100"], "description": "Haziran ayında birden fazla halka arz bekleniyor."},
    ]
    return {"events": events, "count": len(events)}


# ── Simulation endpoints (auth gerekli) ───────────────────────────────────────

@app.post("/api/simulation/create")
async def simulation_create(
    req: SimulationCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        from app.services.simulation_service import create_account
        user_id = current_user["sub"]
        account = create_account(user_id, req.initial_balance, req.mode, req.currency)
        return account.model_dump()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/simulation/portfolio")
async def simulation_portfolio(
    current_user: dict = Depends(get_current_user),
):
    try:
        from app.services.simulation_service import get_account
        user_id = current_user["sub"]
        account = get_account(user_id)
        if account is None:
            return {"account": None}
        return account.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/simulation/manual/buy")
async def simulation_buy(
    req: SimulationBuyRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        from app.services.simulation_service import buy
        user_id = current_user["sub"]
        result = buy(user_id, req.symbol, req.name, req.quantity, req.price)
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/simulation/manual/sell")
async def simulation_sell(
    req: SimulationSellRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        from app.services.simulation_service import sell
        user_id = current_user["sub"]
        result = sell(user_id, req.symbol, req.quantity, req.price)
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/simulation/transactions")
async def simulation_transactions(
    current_user: dict = Depends(get_current_user),
):
    try:
        from app.services.simulation_service import get_transactions
        user_id = current_user["sub"]
        txs = get_transactions(user_id)
        return {"transactions": [t.model_dump() for t in txs], "count": len(txs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/simulation/performance")
async def simulation_performance(
    range: str = Query("1d", regex="^(1d|1w|1m)$"),
    current_user: dict = Depends(get_current_user),
):
    try:
        from app.services.simulation_service import get_performance
        user_id = current_user["sub"]
        perf = await get_performance(user_id, range)
        return perf.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/simulation/ai/strategies")
async def simulation_ai_strategies():
    try:
        from app.services.simulation_service import get_ai_strategies
        strategies = get_ai_strategies()
        return {"strategies": [s.model_dump() for s in strategies]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/simulation/ai/select-strategy")
async def simulation_select_strategy(
    req: SimulationStrategySelectRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        from app.services.simulation_service import select_strategy
        user_id = current_user["sub"]
        result = select_strategy(user_id, req.strategy_id, req.custom_allocation)
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/simulation/assets")
async def simulation_assets():
    """Simülasyonda işlem yapılabilecek tüm sanal varlıkları listele."""
    try:
        from app.services.simulation_service import get_assets
        assets = await get_assets()
        return {"assets": [a.model_dump() for a in assets], "count": len(assets)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/simulation/assets/{symbol}/impact")
async def simulation_asset_impact(
    symbol: str,
    amount: float = Query(10000.0, gt=0, description="İşlem tutarı (TL)"),
    trade_type: str = Query("buy", regex="^(buy|sell)$", description="İşlem tipi"),
    current_user: dict = Depends(get_current_user),
):
    """Seçilen varlığın portföye etkisini analiz et (pre-trade)."""
    try:
        from app.services.simulation_service import get_asset_impact
        user_id = current_user["sub"]
        impact = await get_asset_impact(user_id, symbol.upper(), amount, trade_type)
        if impact is None:
            raise HTTPException(status_code=404, detail=f"Varlık bulunamadı: {symbol}")
        return impact.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/simulation/portfolio/summary")
async def simulation_portfolio_summary(
    current_user: dict = Depends(get_current_user),
):
    """Mevcut simülasyon portföyünün detaylı özetini ve performansını getirir."""
    try:
        from app.services.simulation_service import get_portfolio_summary
        user_id = current_user["sub"]
        summary = await get_portfolio_summary(user_id)
        if not summary:
            raise HTTPException(status_code=404, detail="Aktif simülasyon hesabı bulunamadı.")
        return summary.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── AI Asistan endpoint ───────────────────────────────────────────────────────

def _build_portfolio_context(account) -> PortfolioContext | None:
    """Kullanıcı hesabını PortfolioContext'e dönüştür."""
    if not account:
        return None
    from app.services.simulation_service import _get_asset_meta
    positions_data = []
    positions_value = 0.0
    for pos in account.positions:
        meta = _get_asset_meta(pos.symbol)
        current_price = meta["price"] if meta else pos.current_price
        market_value = pos.quantity * current_price
        cost_basis = pos.quantity * pos.avg_cost
        pnl = market_value - cost_basis
        pnl_pct = (pnl / cost_basis * 100) if cost_basis > 0 else 0.0
        positions_value += market_value
        positions_data.append(PortfolioPositionSummary(
            symbol=pos.symbol, name=pos.name,
            quantity=pos.quantity, avg_cost=pos.avg_cost,
            current_price=current_price, market_value=round(market_value, 2),
            pnl=round(pnl, 2), pnl_pct=round(pnl_pct, 2),
            portfolio_weight=0.0,  # sonra hesapla
        ))
    total_value = account.cash_balance + positions_value
    total_return_pct = ((total_value - account.initial_balance) / account.initial_balance * 100) if account.initial_balance > 0 else 0.0
    # portfolio_weight hesapla
    for p in positions_data:
        p.portfolio_weight = round(p.market_value / total_value * 100, 1) if total_value > 0 else 0.0
    return PortfolioContext(
        total_value=round(total_value, 2),
        cash_balance=round(account.cash_balance, 2),
        positions_value=round(positions_value, 2),
        initial_balance=account.initial_balance,
        total_return_pct=round(total_return_pct, 2),
        positions=positions_data,
    )


_WHATIF_SYMBOL_MAP = {
    "BTC": ["BTC"], "BITCOIN": ["BTC"],
    "ETH": ["ETH"], "ETHEREUM": ["ETH"],
    "XAU": ["XAU"], "ALTIN": ["XAU"], "GOLD": ["XAU"],
    "XU100": ["XU100"], "BIST": ["XU100"], "BIST100": ["XU100"],
    "USDTRY": ["USDTRY"], "DOLAR": ["USDTRY", "XAUUSD"],
    "SOL": ["SOL"], "BNB": ["BNB"],
}


def _compute_whatif(account, asset: str, change_pct: float) -> WhatIfResult | None:
    """Verilen senaryo için portföye matematiksel etki hesapla."""
    if not account or not account.positions:
        return None
    from app.services.simulation_service import _get_asset_meta
    symbols = _WHATIF_SYMBOL_MAP.get(asset.upper(), [asset.upper()])
    positions_value = sum(
        pos.quantity * (_get_asset_meta(pos.symbol) or {}).get("price", pos.current_price)
        for pos in account.positions
    )
    total_value = account.cash_balance + positions_value
    impacts: list[WhatIfPositionImpact] = []
    total_impact_tl = 0.0
    for pos in account.positions:
        if pos.symbol.upper() in symbols:
            meta = _get_asset_meta(pos.symbol)
            mv = pos.quantity * (meta["price"] if meta else pos.current_price)
            impact_tl = mv * (change_pct / 100)
            total_impact_tl += impact_tl
            impacts.append(WhatIfPositionImpact(
                symbol=pos.symbol, name=pos.name,
                market_value=round(mv, 2),
                impact_tl=round(impact_tl, 2),
                impact_pct=round(change_pct, 2),
                new_value=round(mv + impact_tl, 2),
            ))
    if not impacts:
        return None
    total_impact_pct = (total_impact_tl / total_value * 100) if total_value > 0 else 0.0
    return WhatIfResult(
        asset=asset, change_pct=change_pct,
        total_impact_tl=round(total_impact_tl, 2),
        total_impact_pct=round(total_impact_pct, 2),
        portfolio_before=round(total_value, 2),
        portfolio_after=round(total_value + total_impact_tl, 2),
        position_impacts=impacts,
    )


@app.post("/api/assistant/ask")
async def assistant_ask(
    req: AssistantAskRequest,
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
):
    try:
        # Kullanıcı portföyünü oku (token varsa)
        account = None
        if creds:
            from app.services.auth_service import decode_token
            from app.services.simulation_service import get_account
            payload = decode_token(creds.credentials)
            if payload:
                account = get_account(payload["sub"])

        portfolio_ctx = _build_portfolio_context(account)
        whatif_result = None
        if req.whatif_asset and req.whatif_change_pct is not None and account:
            whatif_result = _compute_whatif(account, req.whatif_asset, req.whatif_change_pct)

        market_data, news_signals = await asyncio.gather(
            market_data_agent.run(),
            geopolitical_news_agent.run(quick=True),
        )

        market_snapshot = {
            "btc_try":  market_data.bitcoin.price,
            "gold_try": market_data.gold.price,
            "usd_try":  market_data.usd_try.price,
            "bist100":  market_data.bist100.price,
        }
        news_headlines = [s.tr_title or s.title for s in news_signals if s.tr_title or s.title]

        question_lower = req.question.lower()
        related_news = [
            s for s in news_signals
            if any(word in (s.tr_title + s.tr_summary + s.title).lower()
                   for word in question_lower.split() if len(word) > 3)
        ][:5]

        assistant_raw = await generate_assistant_analysis(
            user_message=req.question,
            capital=portfolio_ctx.total_value if portfolio_ctx else 100000,
            capital_currency="TRY",
            duration_days=30,
            assets=[p.symbol for p in portfolio_ctx.positions] if portfolio_ctx else [],
            market_snapshot=market_snapshot,
            news_headlines=news_headlines,
            portfolio_context=portfolio_ctx,
            whatif_result=whatif_result,
        )
        assistant_analysis = _build_assistant_analysis(assistant_raw)

        return AssistantAskResponse(
            answer=assistant_analysis,
            related_news=related_news,
            portfolio_context=portfolio_ctx,
            whatif_result=whatif_result,
            generated_at=datetime.now(timezone.utc).isoformat(),
        ).model_dump()

    except Exception as e:
        logger.error("[assistant/ask] Hata: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/interest-rates", response_model=CreditRates)
async def get_interest_rates(
    price: int = 100000,
    month: int = 12,
):
    try:
        from app.services.collect_credit_service import get_credit_rates
        raw = await get_credit_rates(price=price, month=month)
        return CreditRates(
            ihtiyac=[c for c in raw.get("ihtiyac", [])],
            konut  =[c for c in raw.get("konut",   [])],
            tasit  =[c for c in raw.get("tasit",   [])],
            params =raw.get("params", {}),
            fetched_at=raw.get("fetched_at", ""),
            is_mock=raw.get("is_mock", False),
        )
    except Exception as e:
        logger.error("[interest-rates] Hata: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── Streaming endpoint ─────────────────────────────────────────────────────────

@app.post("/api/full-analysis-stream")
async def full_analysis_stream(request: FullAnalysisRequest):
    async def generate():
        import time as _time
        t_start = _time.time()
        logger.info("[stream] --- Yeni analiz istegi ---")
        logger.info("[stream] Mesaj: '%s'", request.message[:80])

        try:
            goal_task    = asyncio.ensure_future(user_goal_agent.run(request.message))
            market_task  = asyncio.ensure_future(market_data_agent.run())
            news_task    = asyncio.ensure_future(geopolitical_news_agent.run(quick=True))

            yield _sse("step", {"step": "Piyasa verileri cekiliyor..."})

            market_data = await market_task
            logger.info("[stream] [OK] market_data (%.2fs) — BTC: %.0f TL", _time.time() - t_start, market_data.bitcoin.price)
            yield _sse("market_data", market_data.model_dump())

            goal = await goal_task
            logger.info(
                "[stream] [OK] goal_analysis (%.2fs) — sermaye: %.0f %s | varliklar: %s",
                _time.time() - t_start, goal.parsed_goal.capital,
                goal.parsed_goal.capital_currency, goal.parsed_goal.assets
            )
            yield _sse("goal_analysis", goal.model_dump())

            yield _sse("step", {"step": "Haberler ve sinyaller analiz ediliyor..."})

            news_signals = await news_task
            logger.info("[stream] [OK] news_signals (%.2fs) — %d haber", _time.time() - t_start, len(news_signals))
            yield _sse("news_signals", [s.model_dump() for s in news_signals])

            yield _sse("step", {"step": "AI finansal analiz uretiliyor..."})

            market_snapshot = {
                "btc_try":  market_data.bitcoin.price,
                "gold_try": market_data.gold.price,
                "usd_try":  market_data.usd_try.price,
                "bist100":  market_data.bist100.price,
            }
            news_headlines = [s.tr_title or s.title for s in news_signals if s.tr_title or s.title]
            logger.info("[stream] Gemini analizi başlatılıyor — %d haber başlığı aktarılıyor", len(news_headlines))

            t_gemini = _time.time()
            assistant_raw = await generate_assistant_analysis(
                user_message=request.message,
                capital=goal.parsed_goal.capital,
                capital_currency=goal.parsed_goal.capital_currency,
                duration_days=goal.parsed_goal.duration_days,
                assets=goal.parsed_goal.assets,
                market_snapshot=market_snapshot,
                news_headlines=news_headlines,
            )
            logger.info("[stream] [OK] generate_assistant_analysis (%.2fs)", _time.time() - t_gemini)

            assistant_analysis = _build_assistant_analysis(assistant_raw)
            logger.info(
                "[stream] [OK] assistant_analysis hazir — directAnswer uzunluğu: %d karakter",
                len(assistant_analysis.directAnswer)
            )
            yield _sse("assistant_analysis", assistant_analysis.model_dump())

            impacts  = _rule_based_impact(news_signals, goal.parsed_goal.assets)
            portfolio = build_simulation_portfolio(
                capital=goal.parsed_goal.capital,
                currency=goal.parsed_goal.capital_currency,
                assets=goal.parsed_goal.assets,
                gemini_scenarios=None,
            )
            portfolio = simulation_portfolio_agent.run(portfolio)

            full = FullAnalysisResponse(
                goal_analysis=goal,
                market_data=market_data,
                news_signals=news_signals,
                asset_impact_map=impacts,
                simulation=portfolio,
                agent_flow=AGENT_FLOW,
                natural_response="",
                assistant_analysis=assistant_analysis,
                generated_at=datetime.now(timezone.utc).isoformat(),
            )
            logger.info("[stream] [OK] Tamamlandi — toplam süre: %.2fs", _time.time() - t_start)
            yield _sse("complete", full.model_dump())

        except Exception as e:
            logger.error("[stream] [FAIL] KRITIK HATA: %s", e, exc_info=True)
            yield _sse("error", {"message": f"Analiz sırasında hata oluştu: {str(e)}"})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Eski endpoint (geriye dönük uyumluluk) ────────────────────────────────────

@app.post("/api/full-analysis", response_model=FullAnalysisResponse)
async def full_analysis(request: FullAnalysisRequest):
    try:
        goal, market_data, news_signals = await asyncio.gather(
            user_goal_agent.run(request.message),
            market_data_agent.run(),
            geopolitical_news_agent.run(quick=True),
        )

        market_snapshot = {
            "btc_try":  market_data.bitcoin.price,
            "gold_try": market_data.gold.price,
            "usd_try":  market_data.usd_try.price,
            "bist100":  market_data.bist100.price,
        }
        news_headlines = [s.tr_title or s.title for s in news_signals if s.tr_title or s.title]

        assistant_raw = await generate_assistant_analysis(
            user_message=request.message,
            capital=goal.parsed_goal.capital,
            capital_currency=goal.parsed_goal.capital_currency,
            duration_days=goal.parsed_goal.duration_days,
            assets=goal.parsed_goal.assets,
            market_snapshot=market_snapshot,
            news_headlines=news_headlines,
        )

        impacts  = _rule_based_impact(news_signals, goal.parsed_goal.assets)
        portfolio = build_simulation_portfolio(
            capital=goal.parsed_goal.capital,
            currency=goal.parsed_goal.capital_currency,
            assets=goal.parsed_goal.assets,
            gemini_scenarios=None,
        )
        portfolio = simulation_portfolio_agent.run(portfolio)
        assistant_analysis = _build_assistant_analysis(assistant_raw)

        return FullAnalysisResponse(
            goal_analysis=goal,
            market_data=market_data,
            news_signals=news_signals,
            asset_impact_map=impacts,
            simulation=portfolio,
            agent_flow=AGENT_FLOW,
            natural_response="",
            assistant_analysis=assistant_analysis,
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analiz sırasında hata oluştu: {str(e)}")
