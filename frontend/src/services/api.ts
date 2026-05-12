import type {
  MarketData, NewsSignal,
} from '../types'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

// ── Auth yardımcısı — localStorage'dan token okur ────────────────────────────

function getToken(): string | null {
  try {
    const stored = localStorage.getItem('pn_auth');
    if (!stored) return null;
    return JSON.parse(stored)?.token ?? null;
  } catch {
    return null;
  }
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}


// ── Genel ─────────────────────────────────────────────────────────────────────

export async function fetchMarketData(): Promise<MarketData> {
  const res = await fetch(`${BASE_URL}/api/market-data`)
  if (!res.ok) throw new Error('Market data fetch failed')
  return res.json()
}

export async function fetchNewsSignals(): Promise<{ signals: NewsSignal[]; count: number }> {
  const res = await fetch(`${BASE_URL}/api/news-signals`)
  if (!res.ok) throw new Error('News signals fetch failed')
  return res.json()
}

export async function fetchMarketCalendar(): Promise<{ events: import('../types').MarketCalendarEvent[]; count: number }> {
  const res = await fetch(`${BASE_URL}/api/market-calendar`);
  if (!res.ok) throw new Error('Market calendar fetch failed');
  return res.json();
}

// ── AI Asistan ────────────────────────────────────────────────────────────────

export async function askAssistant(question: string): Promise<import('../types').AssistantAskResponse> {
  const res = await fetch(`${BASE_URL}/api/assistant/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error('Assistant ask failed');
  return res.json();
}

// ── Simülasyon (auth gerekli) ─────────────────────────────────────────────────

export async function createSimulation(initial_balance: number, mode: string): Promise<import('../types').SimulationAccount> {
  const res = await fetch(`${BASE_URL}/api/simulation/create`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ initial_balance, mode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Create simulation failed');
  }
  return res.json();
}

export async function fetchSimulationPortfolio(): Promise<{ account: import('../types').SimulationAccount | null }> {
  const res = await fetch(`${BASE_URL}/api/simulation/portfolio`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Fetch portfolio failed');
  return res.json();
}

export async function simulationBuy(symbol: string, name: string, quantity: number, price: number) {
  const res = await fetch(`${BASE_URL}/api/simulation/manual/buy`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ symbol, name, quantity, price }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Buy failed');
  }
  return res.json();
}

export async function simulationSell(symbol: string, quantity: number, price: number) {
  const res = await fetch(`${BASE_URL}/api/simulation/manual/sell`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ symbol, quantity, price }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Sell failed');
  }
  return res.json();
}

export async function fetchSimulationTransactions(): Promise<{ transactions: import('../types').VirtualTransaction[]; count: number }> {
  const res = await fetch(`${BASE_URL}/api/simulation/transactions`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Fetch transactions failed');
  return res.json();
}

export async function fetchSimulationPerformance(range: '1d' | '1w' | '1m'): Promise<import('../types').SimulationPerformance> {
  const res = await fetch(`${BASE_URL}/api/simulation/performance?range=${range}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Fetch performance failed');
  return res.json();
}

export async function fetchSimulationStrategies(): Promise<{ strategies: import('../types').SimulationStrategy[] }> {
  const res = await fetch(`${BASE_URL}/api/simulation/ai/strategies`);
  if (!res.ok) throw new Error('Fetch strategies failed');
  return res.json();
}

export async function selectSimulationStrategy(strategy_id: string) {
  const res = await fetch(`${BASE_URL}/api/simulation/ai/select-strategy`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ strategy_id }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Select strategy failed');
  }
  return res.json();
}

export async function fetchInterestRates(price = 100000, month = 12): Promise<import('../types').CreditRates> {
  const res = await fetch(`${BASE_URL}/api/interest-rates?price=${price}&month=${month}`);
  if (!res.ok) throw new Error('Fetch interest rates failed');
  return res.json();
}

// ── Paper Trading API ─────────────────────────────────────────────────────────

export async function fetchSimulationAssets(): Promise<{ assets: import('../types').SimulationAsset[]; count: number }> {
  const res = await fetch(`${BASE_URL}/api/simulation/assets`);
  if (!res.ok) throw new Error('Fetch simulation assets failed');
  return res.json();
}

export async function fetchAssetImpact(
  symbol: string,
  amount: number,
  trade_type: 'buy' | 'sell'
): Promise<import('../types').AssetImpactAnalysis> {
  const res = await fetch(
    `${BASE_URL}/api/simulation/assets/${symbol}/impact?amount=${amount}&trade_type=${trade_type}`,
    { headers: authHeaders() }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Impact fetch failed');
  }
  return res.json();
}

export async function fetchPortfolioSummary(): Promise<import('../types').SimulationPortfolioSummary> {
  const res = await fetch(`${BASE_URL}/api/simulation/portfolio/summary`, {
    headers: authHeaders(),
  });
  if (res.status === 404) throw new Error('NO_ACCOUNT');
  if (!res.ok) throw new Error('Portfolio summary fetch failed');
  return res.json();
}
