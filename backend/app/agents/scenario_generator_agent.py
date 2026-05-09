from app.models.schemas import SimulationPortfolio, GoalAnalysis, MarketData, NewsSignal
from app.services.gemini_service import generate_scenarios_with_gemini
from app.services.scenario_service import build_simulation_portfolio


async def run(
    goal: GoalAnalysis,
    market_data: MarketData,
    news_signals: list[NewsSignal],
) -> SimulationPortfolio:
    goal_dict = goal.model_dump()
    market_dict = {
        "bitcoin_price": market_data.bitcoin.price,
        "bitcoin_change_pct": market_data.bitcoin.change_pct_24h,
        "gold_price": market_data.gold.price,
        "usd_try": market_data.usd_try.price,
        "bist100": market_data.bist100.price,
    }
    news_list = [
        {"title": n.title, "risk_level": n.risk_level.value, "affected": n.affected_assets}
        for n in news_signals
    ]

    gemini_scenarios = await generate_scenarios_with_gemini(goal_dict, market_dict, news_list)

    return build_simulation_portfolio(
        capital=goal.parsed_goal.capital,
        currency=goal.parsed_goal.capital_currency,
        assets=goal.parsed_goal.assets,
        gemini_scenarios=gemini_scenarios,
    )
