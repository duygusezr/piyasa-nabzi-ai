// ── Temel varlık tipleri ──────────────────────────────────────────────────────
export interface AssetPrice {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  change_24h: number;
  change_pct_24h: number;
  timestamp: string;
  source: string;
  is_mock: boolean;
}

export interface MarketData {
  bitcoin: AssetPrice;
  gold: AssetPrice;
  usd_try: AssetPrice;
  bist100: AssetPrice;
  assets: AssetPrice[];
  fetched_at: string;
}

// ── Haber tipleri ─────────────────────────────────────────────────────────────
export type NewsCategory =
  | 'Kripto' | 'Borsa İstanbul' | 'Fonlar' | 'Değerli Madenler'
  | 'Döviz' | 'Dünya Siyaseti' | 'Türkiye Ekonomisi' | 'Şirket Haberleri'
  | 'KAP / Finansal Duyurular' | 'Merkez Bankaları' | 'Genel';

export interface NewsSignal {
  id: string;
  title: string;
  summary: string;
  source: string;
  published_at: string;
  affected_assets: string[];
  risk_level: 'low' | 'medium' | 'high';
  market_impact: string;
  url?: string;
  tr_title: string;
  tr_summary: string;
  gemini_comment: string;
  impact_direction: string;
  confidence: string;
  category: string;
}

// ── Piyasa Takvimi ────────────────────────────────────────────────────────────
export interface MarketCalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  event_type: string;
  importance: 'yüksek' | 'orta' | 'düşük';
  affected_assets: string[];
  description: string;
}

// ── Simülasyon ────────────────────────────────────────────────────────────────
export type SimulationMode = 'manual' | 'ai';

export interface VirtualPosition {
  symbol: string;
  name: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  pnl: number;
  pnl_pct: number;
  // Genişletilmiş alanlar
  category: string;
  market_value: number;
  portfolio_weight: number;
  risk_level: string;
  news_sensitivity: string;
}

// ── Paper Trading ─────────────────────────────────────────────────────────────
export interface SimulationAsset {
  symbol: string;
  name: string;
  category: string;
  price: number;
  change_pct: number;
  risk_level: 'low' | 'medium' | 'high';
  volatility_score: number;   // 1-10
  news_sensitivity: 'low' | 'medium' | 'high';
  data_status: string;
  updated_at: string;
}

export interface AssetScenario {
  title: string;
  description: string;
  conditions: string[];
}

export interface AssetImpactAnalysis {
  symbol: string;
  name: string;
  trade_type: 'buy' | 'sell';
  estimated_amount: number;
  portfolio_weight_before: number;
  portfolio_weight_after: number;
  risk_score_before: number;
  risk_score_after: number;
  volatility_before: number;
  volatility_after: number;
  concentration_risk: boolean;
  news_risk: 'low' | 'medium' | 'high';
  cash_after: number;
  positive_scenario: AssetScenario;
  neutral_scenario: AssetScenario;
  negative_scenario: AssetScenario;
  related_news: string[];
  warnings: string[];
  max_daily_swing_pct: number;
  disclaimer: string;
}

export interface SimulationPortfolioSummary {
  account_id: string;
  initial_balance: number;
  cash_balance: number;
  total_portfolio_value: number;
  positions_value: number;
  positions: VirtualPosition[];
  daily_pnl: number;
  daily_pnl_pct: number;
  weekly_pnl: number;
  weekly_pnl_pct: number;
  monthly_pnl: number;
  monthly_pnl_pct: number;
  total_return: number;
  total_return_pct: number;
  risk_score: number;
  volatility_score: number;
  mode: SimulationMode;
  active_strategy: SimulationStrategy | null;
  last_strategy_change: string | null;
  created_at: string;
  data_status: string;
  disclaimer: string;
}

export interface VirtualTransaction {
  id: string;
  timestamp: string;
  tx_type: 'buy' | 'sell';
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  fee: number;
}

export interface AllocationItem {
  asset: string;
  percent: number;
}

export interface SimulationStrategy {
  strategy_id: string;
  name: string;
  description: string;
  allocation: AllocationItem[];
  risk_score: number;
  opportunity_score: number;
  volatility_score: number;
  logic: string;
  invalidation: string[];
  risks: string[];
}

export interface SimulationAccount {
  id: string;
  initial_balance: number;
  cash_balance: number;
  currency: string;
  mode: SimulationMode;
  positions: VirtualPosition[];
  active_strategy: SimulationStrategy | null;
  last_strategy_change: string | null;
  created_at: string;
}

export interface SimulationPerformance {
  range: '1d' | '1w' | '1m';
  initial_value: number;
  current_value: number;
  pnl: number;
  pnl_pct: number;
  chart_data: { index: number; value: number; label: string }[];
}

// ── AI Asistan ────────────────────────────────────────────────────────────────
export interface AffectedAsset {
  asset: string;
  possibleEffect: string;
  reason: string;
  riskLevel: string;
}

export interface ActionableOption {
  title: string;
  description: string;
  whenUseful: string;
  risk: string;
}

export interface AssistantScenario {
  name: string;
  allocation: AllocationItem[];
  logic: string;
  riskScore: number;
  opportunityScore: number;
  volatilityScore: number;
}

export interface AssistantAnalysis {
  directAnswer: string;
  marketContext: string;
  affectedAssets: AffectedAsset[];
  actionableOptions: ActionableOption[];
  scenarios: AssistantScenario[];
  whatToWatch: string[];
  scenarioInvalidation: string[];
  risks: string[];
  conclusion: string;
  disclaimer: string;
}

export interface AssistantAskResponse {
  answer: AssistantAnalysis;
  related_news: NewsSignal[];
  generated_at: string;
}

// ── Kredi Faiz ────────────────────────────────────────────────────────────────
export interface CreditOffer {
  bank: string;
  interest_rate: number;
  monthly_pay: number;
  total_pay: number;
  logo: string;
}

export interface CreditRates {
  ihtiyac: CreditOffer[];
  konut: CreditOffer[];
  tasit: CreditOffer[];
  params: { price: number; month: number };
  fetched_at: string;
  is_mock: boolean;
}
