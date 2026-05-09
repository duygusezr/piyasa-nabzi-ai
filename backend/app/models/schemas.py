from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class RiskLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class GoalRequest(BaseModel):
    message: str = Field(..., min_length=5, max_length=2000)


class ParsedGoal(BaseModel):
    capital: float
    capital_currency: str = "TRY"
    duration_days: int
    target: str
    assets: list[str]
    risk_appetite: str
    raw_message: str


class GoalAnalysis(BaseModel):
    summary: str
    realism: str
    risk_level: RiskLevel
    warning: str
    parsed_goal: ParsedGoal
    action_items: list[str] = []


class AssetPrice(BaseModel):
    symbol: str
    name: str
    price: float
    currency: str
    change_24h: float
    change_pct_24h: float
    timestamp: str
    source: str
    is_mock: bool = False


class MarketData(BaseModel):
    bitcoin: AssetPrice
    gold: AssetPrice
    usd_try: AssetPrice
    bist100: AssetPrice
    assets: list[AssetPrice]
    fetched_at: str


class NewsSignal(BaseModel):
    id: str
    title: str                    # orijinal başlık
    summary: str                  # orijinal özet
    source: str
    published_at: str
    affected_assets: list[str]
    risk_level: RiskLevel
    market_impact: str
    url: Optional[str] = None
    # Gemini zenginleştirme alanları
    tr_title: str = ""            # Türkçe başlık
    tr_summary: str = ""          # Türkçe özet
    gemini_comment: str = ""      # Finans yorumu
    impact_direction: str = ""    # pozitif / negatif / nötr / karışık
    confidence: str = ""          # low / medium / high


class AssetImpact(BaseModel):
    asset: str
    direction: str  # positive / negative / neutral
    confidence: str  # low / medium / high
    reason: str
    signal_sources: list[str]


class ScenarioAllocation(BaseModel):
    asset: str
    percentage: float
    rationale: str


class Scenario(BaseModel):
    name: str
    allocation: list[ScenarioAllocation]
    risk_score: float = Field(ge=0, le=10)
    opportunity_score: float = Field(ge=0, le=10)
    volatility_score: float = Field(ge=0, le=10)
    expected_behavior: str
    explanation: str
    warnings: list[str]
    disclaimer: str = "Bu içerik yatırım tavsiyesi değildir."


class SimulationPortfolio(BaseModel):
    initial_capital: float
    currency: str
    protective_portfolio: Scenario
    balanced_portfolio: Scenario
    aggressive_portfolio: Scenario
    simulation_disclaimer: str


class FullAnalysisRequest(BaseModel):
    message: str = Field(..., min_length=5, max_length=2000)


# ── AssistantAnalysis ─────────────────────────────────────────────────────────

class AffectedAsset(BaseModel):
    asset: str
    possibleEffect: str
    reason: str
    riskLevel: str


class ActionableOption(BaseModel):
    title: str
    description: str
    whenUseful: str
    risk: str


class AllocationItem(BaseModel):
    asset: str
    percent: int


class AssistantScenario(BaseModel):
    name: str
    allocation: list[AllocationItem]
    logic: str
    riskScore: int
    opportunityScore: int
    volatilityScore: int


class AssistantAnalysis(BaseModel):
    directAnswer: str = ""
    marketContext: str = ""
    affectedAssets: list[AffectedAsset] = []
    actionableOptions: list[ActionableOption] = []
    scenarios: list[AssistantScenario] = []
    whatToWatch: list[str] = []
    scenarioInvalidation: list[str] = []
    risks: list[str] = []
    conclusion: str = ""
    disclaimer: str = "Bu içerik yatırım tavsiyesi değildir; eğitim ve simülasyon amaçlıdır."


class FullAnalysisResponse(BaseModel):
    goal_analysis: GoalAnalysis
    market_data: MarketData
    news_signals: list[NewsSignal]
    asset_impact_map: list[AssetImpact]
    simulation: SimulationPortfolio
    agent_flow: list[str]
    natural_response: str = ""
    assistant_analysis: Optional[AssistantAnalysis] = None
    disclaimer: str = "Bu içerik yatırım tavsiyesi değildir. Gerçek para ile işlem yapılmaz."
    generated_at: str
