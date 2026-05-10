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
    category: str = "Genel"


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


class CreditOffer(BaseModel):
    bank: str
    interest_rate: float       # aylık faiz oranı (%)
    monthly_pay: float         # aylık taksit (TL)
    total_pay: float           # toplam geri ödeme (TL)
    logo: str = ""


class CreditRates(BaseModel):
    ihtiyac: list[CreditOffer] = []
    konut:   list[CreditOffer] = []
    tasit:   list[CreditOffer] = []
    params:  dict = {}          # {"price": 100000, "month": 12}
    fetched_at: str = ""
    is_mock: bool = False


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


# ── Market Calendar ───────────────────────────────────────────────────────────

class MarketCalendarEvent(BaseModel):
    id: str
    title: str
    date: str
    time: str = ""
    event_type: str  # "ekonomik" | "temettu" | "kap" | "merkez_bankasi" | "diger"
    importance: str  # "yüksek" | "orta" | "düşük"
    affected_assets: list[str] = []
    description: str = ""


# ── Assistant Ask ─────────────────────────────────────────────────────────────

class AssistantAskRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=1000)


class AssistantAskResponse(BaseModel):
    answer: AssistantAnalysis
    related_news: list[NewsSignal] = []
    generated_at: str


# ── Simulation ────────────────────────────────────────────────────────────────

class VirtualPosition(BaseModel):
    symbol: str
    name: str
    quantity: float
    avg_cost: float
    current_price: float
    pnl: float = 0.0
    pnl_pct: float = 0.0
    # Genişletilmiş alanlar (paper trading için)
    category: str = ""
    market_value: float = 0.0
    portfolio_weight: float = 0.0   # % (toplam portföydeki ağırlık)
    risk_level: str = "medium"
    news_sensitivity: str = "medium"


class VirtualTransaction(BaseModel):
    id: str
    timestamp: str
    tx_type: str   # "buy" | "sell"
    symbol: str
    name: str
    quantity: float
    price: float
    total: float
    fee: float = 0.0


class SimulationStrategy(BaseModel):
    strategy_id: str   # "low_risk" | "balanced" | "aggressive"
    name: str
    description: str
    allocation: list[AllocationItem]
    risk_score: int
    opportunity_score: int
    volatility_score: int
    logic: str
    invalidation: list[str] = []
    risks: list[str] = []


class SimulationAccount(BaseModel):
    id: str = "default"
    initial_balance: float
    cash_balance: float
    currency: str = "TRY"
    mode: str = "manual"   # "manual" | "ai"
    positions: list[VirtualPosition] = []
    active_strategy: Optional[SimulationStrategy] = None
    last_strategy_change: Optional[str] = None
    created_at: str


class SimulationPerformance(BaseModel):
    range: str   # "1d" | "1w" | "1m"
    initial_value: float
    current_value: float
    pnl: float
    pnl_pct: float
    chart_data: list[dict] = []


class SimulationCreateRequest(BaseModel):
    initial_balance: float = Field(..., gt=0)
    mode: str = "manual"
    currency: str = "TRY"


class SimulationBuyRequest(BaseModel):
    symbol: str
    name: str
    quantity: float = Field(..., gt=0)
    price: float = Field(..., gt=0)


class SimulationSellRequest(BaseModel):
    symbol: str
    quantity: float = Field(..., gt=0)
    price: float = Field(..., gt=0)


class SimulationStrategySelectRequest(BaseModel):
    strategy_id: str
    custom_allocation: Optional[list[AllocationItem]] = None


# ── Paper Trading — Genişletilmiş Simülasyon Modelleri ────────────────────────

class SimulationAsset(BaseModel):
    symbol: str
    name: str
    category: str   # "Kripto" | "Borsa İstanbul" | "Değerli Madenler" | "BIST Endeksleri" | "Fonlar"
    price: float
    change_pct: float
    risk_level: str         # "low" | "medium" | "high"
    volatility_score: int   # 1-10
    news_sensitivity: str   # "low" | "medium" | "high"
    data_status: str = "mock"   # "delayed" | "mock"
    updated_at: str = ""


class AssetScenario(BaseModel):
    title: str
    description: str
    conditions: list[str] = []


class AssetImpactAnalysis(BaseModel):
    symbol: str
    name: str
    trade_type: str             # "buy" | "sell"
    estimated_amount: float
    portfolio_weight_before: float  # %
    portfolio_weight_after: float   # %
    risk_score_before: int
    risk_score_after: int
    volatility_before: float
    volatility_after: float
    concentration_risk: bool
    news_risk: str              # "low" | "medium" | "high"
    cash_after: float
    positive_scenario: AssetScenario
    neutral_scenario: AssetScenario
    negative_scenario: AssetScenario
    related_news: list[str] = []
    warnings: list[str] = []
    max_daily_swing_pct: float
    disclaimer: str = "Bu analiz yatırım tavsiyesi değildir. Simülasyon amaçlıdır."


class SimulationPortfolioSummary(BaseModel):
    account_id: str
    initial_balance: float
    cash_balance: float
    total_portfolio_value: float
    positions_value: float
    positions: list[VirtualPosition] = []
    daily_pnl: float = 0.0
    daily_pnl_pct: float = 0.0
    weekly_pnl: float = 0.0
    weekly_pnl_pct: float = 0.0
    monthly_pnl: float = 0.0
    monthly_pnl_pct: float = 0.0
    total_return: float = 0.0
    total_return_pct: float = 0.0
    risk_score: int = 10        # 1-100
    volatility_score: float = 1.0
    mode: str = "manual"
    active_strategy: Optional[SimulationStrategy] = None
    last_strategy_change: Optional[str] = None
    created_at: str = ""
    data_status: str = "delayed"
    disclaimer: str = "Veriler 1 saat gecikmeli simülasyon verisidir. Gerçek işlem yapılmaz."
