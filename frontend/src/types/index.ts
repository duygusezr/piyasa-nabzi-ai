export type RiskLevel = 'low' | 'medium' | 'high'

export interface ParsedGoal {
  capital: number
  capital_currency: string
  duration_days: number
  target: string
  assets: string[]
  risk_appetite: string
  raw_message: string
}

export interface GoalAnalysis {
  summary: string
  realism: string
  risk_level: RiskLevel
  warning: string
  parsed_goal: ParsedGoal
  action_items: string[]
}

export interface AssetPrice {
  symbol: string
  name: string
  price: number
  currency: string
  change_24h: number
  change_pct_24h: number
  timestamp: string
  source: string
  is_mock: boolean
}

export interface MarketData {
  bitcoin: AssetPrice
  gold: AssetPrice
  usd_try: AssetPrice
  bist100: AssetPrice
  assets: AssetPrice[]
  fetched_at: string
}

export interface NewsSignal {
  id: string
  title: string
  summary: string
  source: string
  published_at: string
  affected_assets: string[]
  risk_level: RiskLevel
  market_impact: string
  url?: string
  tr_title?: string
  tr_summary?: string
  gemini_comment?: string
  impact_direction?: string
  confidence?: string
}

export interface AssetImpact {
  asset: string
  direction: 'positive' | 'negative' | 'neutral'
  confidence: 'low' | 'medium' | 'high'
  reason: string
  signal_sources: string[]
}

export interface ScenarioAllocation {
  asset: string
  percentage: number
  rationale: string
}

export interface Scenario {
  name: string
  allocation: ScenarioAllocation[]
  risk_score: number
  opportunity_score: number
  volatility_score: number
  expected_behavior: string
  explanation: string
  warnings: string[]
  disclaimer: string
}

export interface SimulationPortfolio {
  initial_capital: number
  currency: string
  protective_portfolio: Scenario
  balanced_portfolio: Scenario
  aggressive_portfolio: Scenario
  simulation_disclaimer: string
}

export interface AffectedAsset {
  asset: string
  possibleEffect: string
  reason: string
  riskLevel: string
}

export interface ActionableOption {
  title: string
  description: string
  whenUseful: string
  risk: string
}

export interface AllocationItem {
  asset: string
  percent: number
}

export interface AssistantScenario {
  name: string
  allocation: AllocationItem[]
  logic: string
  riskScore: number
  opportunityScore: number
  volatilityScore: number
}

export interface AssistantAnalysis {
  directAnswer: string
  marketContext: string
  affectedAssets: AffectedAsset[]
  actionableOptions: ActionableOption[]
  scenarios: AssistantScenario[]
  whatToWatch: string[]
  scenarioInvalidation: string[]
  risks: string[]
  conclusion: string
  disclaimer: string
}

export interface FullAnalysisResponse {
  goal_analysis: GoalAnalysis
  market_data: MarketData
  news_signals: NewsSignal[]
  asset_impact_map: AssetImpact[]
  simulation: SimulationPortfolio
  agent_flow: string[]
  natural_response: string
  assistant_analysis?: AssistantAnalysis
  disclaimer: string
  generated_at: string
}

export type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading'; step: string }
  | { status: 'success'; data: FullAnalysisResponse }
  | { status: 'error'; message: string }
