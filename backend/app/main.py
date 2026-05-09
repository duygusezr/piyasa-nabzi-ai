import asyncio
import json
import logging
import logging.config
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
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
        # Uygulama logları — DEBUG seviyesine indirildi (detaylı takip için)
        "app": {"level": "DEBUG", "propagate": True},
        # Harici kütüphanelerin gürültüsünü kıs
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

AGENT_FLOW = [
    "Kullanıcı Hedefi Ayrıştırıldı",
    "Gerçek Zamanlı Piyasa Verisi Çekildi",
    "Haber Sinyalleri Analiz Edildi",
    "AI Finansal Analiz Üretildi",
    "Simülasyon Portföyü Hazırlandı",
]


def _build_assistant_analysis(raw: dict) -> AssistantAnalysis:
    logger.info("[main:assistant] AssistantAnalysis olusturuluyor — anahtarlar: %s", list(raw.keys()))

    # ── Yardimci donusturuculer — Gemini alan adi tutarsizliklarini tolere eder ──

    def _to_allocation(a: dict) -> AllocationItem:
        """Gemini 'percent' veya 'percentage' dondürebilir."""
        pct = a.get("percent") or a.get("percentage") or 0
        return AllocationItem(asset=str(a.get("asset", "")), percent=int(pct))

    def _to_affected_asset(a: dict) -> AffectedAsset:
        """Gemini camelCase (possibleEffect) veya snake_case (possible_effect) dondürebilir."""
        return AffectedAsset(
            asset=str(a.get("asset", "")),
            possibleEffect=str(a.get("possibleEffect") or a.get("possible_effect") or ""),
            reason=str(a.get("reason", "")),
            riskLevel=str(a.get("riskLevel") or a.get("risk_level") or "orta"),
        )

    def _to_action_option(o: dict) -> ActionableOption:
        """Gemini camelCase veya snake_case dondürebilir."""
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
        return data.model_dump()
    except Exception as e:
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


# ── Streaming endpoint ─────────────────────────────────────────────────────────

@app.post("/api/full-analysis-stream")
async def full_analysis_stream(request: FullAnalysisRequest):
    async def generate():
        import time as _time
        t_start = _time.time()
        logger.info("[stream] --- Yeni analiz istegi ---")
        logger.info("[stream] Mesaj: '%s'", request.message[:80])

        try:
            # Round 1 — tüm bağımsız görevleri aynı anda başlat
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

            # Round 2 — AI analiz
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

            # Rule-based (senkron, anlık)
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
            geopolitical_news_agent.run(quick=True),  # DeepL/Gemini beklemez
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
