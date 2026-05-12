import { useEffect, useState, useMemo, useCallback, type ReactNode, type ElementType } from 'react'
import {
  TrendingUp, TrendingDown, RefreshCw, AlertCircle,
  Wallet, BarChart2, Clock, Loader2, Bot, ChevronRight,
  ArrowUpRight, ArrowDownRight, ShieldAlert, Info
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

// ── Ek Tipler (API kontratına göre) ──────────────────────────────────────────

interface SimulationPortfolioSummary {
  account_id: string
  initial_balance: number
  cash_balance: number
  total_portfolio_value: number
  positions_value: number
  positions: VirtualPositionExt[]
  daily_pnl: number
  daily_pnl_pct: number
  weekly_pnl: number
  weekly_pnl_pct: number
  monthly_pnl: number
  monthly_pnl_pct: number
  total_return: number
  total_return_pct: number
  risk_score: number
  volatility_score: number
  mode: string
  active_strategy: SimulationStrategyExt | null
  last_strategy_change: string | null
  created_at: string
  data_status: string
  disclaimer: string
}

interface VirtualPositionExt {
  symbol: string
  name: string
  category: string
  quantity: number
  avg_cost: number
  current_price: number
  market_value: number
  pnl: number
  pnl_pct: number
  portfolio_weight: number
  risk_level: string
  news_sensitivity: string
}

interface SimulationAsset {
  symbol: string
  name: string
  category: string
  price: number
  change_pct: number
  risk_level: string
  volatility_score: number
  news_sensitivity: string
  data_status: string
  updated_at: string
}

interface AssetImpactAnalysis {
  symbol: string
  name: string
  trade_type: string
  estimated_amount: number
  portfolio_weight_before: number
  portfolio_weight_after: number
  risk_score_before: number
  risk_score_after: number
  volatility_before: number
  volatility_after: number
  concentration_risk: boolean
  news_risk: string
  cash_after: number
  positive_scenario: { title: string; description: string; conditions: string[] }
  neutral_scenario: { title: string; description: string; conditions: string[] }
  negative_scenario: { title: string; description: string; conditions: string[] }
  related_news: string[]
  warnings: string[]
  max_daily_swing_pct: number
  disclaimer: string
}

interface SimulationStrategyExt {
  strategy_id: string
  name: string
  description: string
  allocation: { asset: string; percent: number }[]
  risk_score: number
  opportunity_score: number
  volatility_score: number
  logic: string
  invalidation: string[]
  risks: string[]
}

interface VirtualTransaction {
  id: string
  timestamp: string
  tx_type: 'buy' | 'sell'
  symbol: string
  name: string
  quantity: number
  price: number
  total: number
  fee: number
}

// ── Sabitler ──────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

function getToken(): string | null {
  try {
    const s = localStorage.getItem('pn_auth')
    return s ? (JSON.parse(s)?.token ?? null) : null
  } catch { return null }
}
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

const CATEGORY_TABS = [
  'Kripto',
  'Borsa İstanbul',
  'Değerli Madenler',
  'BIST Endeksleri',
  'Fonlar',
]

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6', '#f97316']

// ── Yardımcı Fonksiyonlar ─────────────────────────────────────────────────────

function fmt(n: number, dec = 2): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

/** Seed-bazlı kararlı mock grafik verisi üretir */
function generateMockChart(
  basePrice: number,
  seed: number,
  points: number,
): { t: string; v: number }[] {
  const result: { t: string; v: number }[] = []
  let price = basePrice
  for (let i = 0; i < points; i++) {
    const angle = (i * seed * 0.7) / points
    const noise = Math.sin(angle * 12.9898 + seed) * 0.5 + Math.cos(angle * 78.233) * 0.3
    price = price * (1 + noise * 0.008)
    result.push({ t: `${i}`, v: parseFloat(price.toFixed(2)) })
  }
  return result
}

function seedFromSymbol(symbol: string): number {
  return symbol.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
}

function pointsForRange(range: string): number {
  return range === '1G' ? 24 : range === '1H' ? 7 * 24 : range === '1A' ? 30 : range === '3A' ? 90 : 365
}

// ── Helper Bileşenler ─────────────────────────────────────────────────────────

function DelayedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-900/30 text-amber-400 border border-amber-500/20">
      <Clock size={10} />
      1 saat gecikmeli simülasyon verisi
    </span>
  )
}

function PnlDisplay({ pnl, pct, size = 'md' }: { pnl: number; pct: number; size?: 'sm' | 'md' | 'lg' }) {
  const pos = pnl >= 0
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-xl font-bold' : 'text-sm font-semibold'
  return (
    <div className={`flex items-center gap-1 ${pos ? 'text-green-400' : 'text-red-400'} ${textSize}`}>
      {pos ? <ArrowUpRight size={size === 'lg' ? 18 : 14} /> : <ArrowDownRight size={size === 'lg' ? 18 : 14} />}
      <span>{pos ? '+' : ''}₺{fmt(pnl)}</span>
      <span className="opacity-70 text-xs">({pos ? '+' : ''}{fmt(pct)}%)</span>
    </div>
  )
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    low: 'bg-green-900/40 text-green-400 border-green-500/20',
    medium: 'bg-amber-900/40 text-amber-400 border-amber-500/20',
    high: 'bg-red-900/40 text-red-400 border-red-500/20',
  }
  const label: Record<string, string> = { low: 'Düşük Risk', medium: 'Orta Risk', high: 'Yüksek Risk' }
  return (
    <span className={`px-2 py-0.5 rounded text-xs border ${map[level] ?? 'bg-gray-800 text-gray-400 border-gray-700'}`}>
      {label[level] ?? level}
    </span>
  )
}

function NewsSensitivityBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    low: 'text-green-400',
    medium: 'text-amber-400',
    high: 'text-red-400',
  }
  const label: Record<string, string> = { low: 'Düşük', medium: 'Orta', high: 'Yüksek' }
  return (
    <span className={`text-xs font-medium ${map[level] ?? 'text-gray-400'}`}>
      Haber Duyarlılığı: {label[level] ?? level}
    </span>
  )
}

function ScoreBar({ value, max = 10, color = 'bg-blue-500' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="flex-1 bg-gray-800 rounded-full h-1.5">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function CategoryBadge({ category }: { category: string }) {
  const map: Record<string, string> = {
    'Kripto': 'bg-purple-900/40 text-purple-400',
    'Borsa İstanbul': 'bg-blue-900/40 text-blue-400',
    'Değerli Madenler': 'bg-yellow-900/40 text-yellow-400',
    'BIST Endeksleri': 'bg-cyan-900/40 text-cyan-400',
    'Fonlar': 'bg-emerald-900/40 text-emerald-400',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs ${map[category] ?? 'bg-gray-800 text-gray-400'}`}>
      {category}
    </span>
  )
}

function SummaryCard({
  title,
  value,
  sub,
  icon: Icon,
  colorClass = 'text-white',
  bgClass = 'bg-gray-900',
}: {
  title: string
  value: ReactNode
  sub?: string
  icon: ElementType
  colorClass?: string
  bgClass?: string
}) {
  return (
    <div className={`${bgClass} rounded-xl border border-gray-800 p-4 flex flex-col gap-2`}>
      <div className="flex items-center gap-2 text-gray-400 text-xs">
        <Icon size={13} />
        {title}
      </div>
      <div className={`font-bold text-lg ${colorClass}`}>{value}</div>
      {sub && <div className="text-gray-500 text-xs">{sub}</div>}
    </div>
  )
}

function Spinner() {
  return <Loader2 size={20} className="animate-spin text-blue-400" />
}

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div
      className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2 border ${
        type === 'success'
          ? 'bg-green-900/80 text-green-300 border-green-500/30'
          : 'bg-red-900/80 text-red-300 border-red-500/30'
      }`}
    >
      {type === 'success' ? <TrendingUp size={15} /> : <AlertCircle size={15} />}
      {msg}
    </div>
  )
}

// ── AI Strateji Seçim Sihirbazı ────────────────────────────────────────────────
function AiStrategyWizard({
  strategies,
  onSelectStrategy,
  onCancel,
}: {
  strategies: SimulationStrategyExt[]
  onSelectStrategy: (strategyId: string, customAllocation?: any[]) => void
  onCancel?: () => void
}) {
  const [selectedBase, setSelectedBase] = useState<SimulationStrategyExt | null>(null)
  const [allocations, setAllocations] = useState<{ asset: string; percent: number }[]>([])

  const handleSelectBase = (s: SimulationStrategyExt) => {
    setSelectedBase(s)
    setAllocations([...s.allocation])
  }

  const handleSliderChange = (idx: number, val: number) => {
    const newAlloc = [...allocations]
    newAlloc[idx].percent = val
    setAllocations(newAlloc)
  }

  const totalPercent = allocations.reduce((acc, curr) => acc + curr.percent, 0)
  const isValid = totalPercent === 100

  if (!selectedBase) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-8">
            <Bot size={48} className="text-purple-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-2">AI Yönetim Modu</h2>
            <p className="text-gray-400">Risk iştahınıza uygun bir strateji belirleyin, sepeti AI yönetsin.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {strategies.map(s => (
              <button
                key={s.strategy_id}
                onClick={() => handleSelectBase(s)}
                className="bg-gray-900 border border-gray-800 hover:border-purple-500 hover:bg-gray-800 transition-all rounded-2xl p-6 text-left group"
              >
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">{s.name}</h3>
                <p className="text-sm text-gray-400 mb-6 min-h-[60px]">{s.description}</p>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Risk</span>
                      <span className="text-gray-400">{s.risk_score}/10</span>
                    </div>
                    <ScoreBar value={s.risk_score} color="bg-red-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Fırsat (Getiri)</span>
                      <span className="text-gray-400">{s.opportunity_score}/10</span>
                    </div>
                    <ScoreBar value={s.opportunity_score} color="bg-green-500" />
                  </div>
                </div>
              </button>
            ))}
          </div>
          {onCancel && (
            <div className="mt-8 text-center">
              <button onClick={onCancel} className="text-gray-500 hover:text-white text-sm">İptal Et</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-2xl">
        <button onClick={() => setSelectedBase(null)} className="text-purple-400 text-sm flex items-center gap-1 hover:text-purple-300 mb-6 transition-colors">
          <ChevronRight size={16} className="rotate-180" /> Geri Dön
        </button>
        
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">{selectedBase.name} Stratejisi</h2>
          <p className="text-sm text-gray-400">{selectedBase.logic}</p>
        </div>

        <div className="bg-gray-950 rounded-2xl border border-gray-800 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-semibold text-sm">Sepet Çeşitlendirmesi (Tahsisat)</h3>
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isValid ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
              Toplam: %{totalPercent}
            </span>
          </div>
          
          <div className="space-y-5">
            {allocations.map((alloc, idx) => (
              <div key={alloc.asset}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-300 font-medium">{alloc.asset}</span>
                  <span className="text-purple-400 font-bold">%{alloc.percent}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={alloc.percent}
                  onChange={(e) => handleSliderChange(idx, parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            ))}
          </div>
          
          {!isValid && (
            <p className="text-red-400 text-xs mt-4 text-center bg-red-900/20 py-2 rounded-lg border border-red-500/20">
              Oranların toplamı tam olarak %100 olmalıdır. (Şu an: %{totalPercent})
            </p>
          )}
        </div>

        <button
          disabled={!isValid}
          onClick={() => onSelectStrategy(selectedBase.strategy_id, allocations)}
          className="w-full py-4 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Stratejiyi Onayla ve Alımları Başlat
        </button>
      </div>
    </div>
  )
}

// ── Ana Bileşen ───────────────────────────────────────────────────────────────

export default function SimulationPage() {
  // ── Portföy verisi ──
  const [portfolio, setPortfolio] = useState<SimulationPortfolioSummary | null>(null)
  const [portfolioLoading, setPortfolioLoading] = useState(true)
  const [portfolioError, setPortfolioError] = useState<string | null>(null)

  // ── Varlıklar ──
  const [assets, setAssets] = useState<SimulationAsset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)

  // ── İşlem geçmişi ──
  const [transactions, setTransactions] = useState<VirtualTransaction[]>([])
  const [txLoading, setTxLoading] = useState(false)

  // ── Stratejiler ──
  const [strategies, setStrategies] = useState<SimulationStrategyExt[]>([])
  const [strategyLoading, setStrategyLoading] = useState(false)
  const [strategyError, setStrategyError] = useState<string | null>(null)

  // ── Impact analizi ──
  const [impact, setImpact] = useState<AssetImpactAnalysis | null>(null)
  const [impactLoading, setImpactLoading] = useState(false)

  // ── UI State ──
  const [selectedAsset, setSelectedAsset] = useState<SimulationAsset | null>(null)
  const [activeCategory, setActiveCategory] = useState('Kripto')
  const [chartRange, setChartRange] = useState('1G')
  const [rightTab, setRightTab] = useState<'analiz' | 'alsat'>('analiz')
  const [bottomTab, setBottomTab] = useState<'gecmis' | 'performans'>('gecmis')
  const [showAiWizard, setShowAiWizard] = useState(false)

  // ── Setup ──
  const [setupBalance, setSetupBalance] = useState<number | null>(null)
  const [setupCustom, setSetupCustom] = useState('')
  const [setupMode, setSetupMode] = useState<'manual' | 'ai'>('manual')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  // ── Al/Sat formu ──
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy')
  const [tradeQty, setTradeQty] = useState('')
  const [tradeLoading, setTradeLoading] = useState(false)
  const [tradeError, setTradeError] = useState<string | null>(null)
  const [showImpactPreview, setShowImpactPreview] = useState(false)
  const [pendingTrade, setPendingTrade] = useState(false)

  // ── Toast ──
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // ── API Çağrıları ─────────────────────────────────────────────────────────

  const fetchPortfolio = useCallback(async () => {
    try {
      setPortfolioError(null)
      const res = await fetch(`${BASE_URL}/api/simulation/portfolio/summary`, { headers: authHeaders() })
      if (res.status === 401) { setPortfolio(null); setPortfolioLoading(false); return }
      if (res.status === 404) { setPortfolio(null); setPortfolioLoading(false); return }
      if (!res.ok) throw new Error('Portföy yüklenemedi')
      const data: SimulationPortfolioSummary = await res.json()
      setPortfolio(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Bilinmeyen hata'
      setPortfolioError(msg)
    } finally {
      setPortfolioLoading(false)
    }
  }, [])

  const fetchAssets = useCallback(async () => {
    try {
      setAssetsLoading(true)
      const res = await fetch(`${BASE_URL}/api/simulation/assets`)
      if (!res.ok) throw new Error('Varlıklar yüklenemedi')
      const data: { assets: SimulationAsset[]; count: number } = await res.json()
      setAssets(data.assets)
    } catch {
      // sessiz hata — fallback yok
    } finally {
      setAssetsLoading(false)
    }
  }, [])

  const fetchTransactions = useCallback(async () => {
    try {
      setTxLoading(true)
      const res = await fetch(`${BASE_URL}/api/simulation/transactions`, { headers: authHeaders() })
      if (!res.ok) return
      const data: { transactions: VirtualTransaction[] } = await res.json()
      setTransactions(data.transactions)
    } finally {
      setTxLoading(false)
    }
  }, [])

  const fetchStrategies = useCallback(async () => {
    try {
      setStrategyLoading(true)
      const res = await fetch(`${BASE_URL}/api/simulation/ai/strategies`)
      if (!res.ok) return
      const data: { strategies: SimulationStrategyExt[] } = await res.json()
      setStrategies(data.strategies)
    } finally {
      setStrategyLoading(false)
    }
  }, [])

  const fetchImpact = useCallback(async (symbol: string, amount = 10000, tradeType = 'buy') => {
    try {
      setImpactLoading(true)
      setImpact(null)
      const res = await fetch(
        `${BASE_URL}/api/simulation/assets/${symbol}/impact?amount=${amount}&trade_type=${tradeType}`,
        { headers: authHeaders() }
      )
      if (!res.ok) return
      const data: AssetImpactAnalysis = await res.json()
      setImpact(data)
    } finally {
      setImpactLoading(false)
    }
  }, [])

  // ── Yükleme & Otomatik Yenileme ──────────────────────────────────────────

  useEffect(() => {
    fetchPortfolio()
    fetchAssets()
  }, [fetchPortfolio, fetchAssets])

  useEffect(() => {
    if (portfolio) {
      fetchTransactions()
      if (portfolio.mode === 'ai') fetchStrategies()
    }
  }, [portfolio, fetchTransactions, fetchStrategies])

  useEffect(() => {
    const id = setInterval(() => {
      fetchPortfolio()
    }, 60_000)
    return () => clearInterval(id)
  }, [fetchPortfolio])

  // ── Varlık seçimi → impact analizi ───────────────────────────────────────

  useEffect(() => {
    if (selectedAsset) {
      const qty = parseFloat(tradeQty) || 1
      fetchImpact(selectedAsset.symbol, qty * selectedAsset.price, tradeMode)
    }
  }, [selectedAsset, fetchImpact, tradeMode, tradeQty])

  // ── Hesaplanan değerler ──────────────────────────────────────────────────

  const filteredAssets = useMemo(
    () => assets.filter((a) => a.category === activeCategory),
    [assets, activeCategory]
  )

  const chartData = useMemo(() => {
    if (!selectedAsset) return []
    const seed = seedFromSymbol(selectedAsset.symbol)
    const points = pointsForRange(chartRange)
    return generateMockChart(selectedAsset.price, seed, points)
  }, [selectedAsset, chartRange])

  const positionPieData = useMemo(() => {
    if (!portfolio) return []
    const positions = portfolio.positions.map((p) => ({
      name: p.symbol,
      value: p.portfolio_weight,
    }))
    const cashPct = (portfolio.cash_balance / portfolio.total_portfolio_value) * 100
    return [{ name: 'Nakit', value: parseFloat(cashPct.toFixed(1)) }, ...positions]
  }, [portfolio])

  const estimatedTotal = useMemo(() => {
    if (!selectedAsset || !tradeQty) return 0
    return parseFloat(tradeQty) * selectedAsset.price
  }, [selectedAsset, tradeQty])

  const cashAfterTrade = useMemo(() => {
    if (!portfolio) return 0
    if (tradeMode === 'buy') return portfolio.cash_balance - estimatedTotal
    return portfolio.cash_balance + estimatedTotal
  }, [portfolio, tradeMode, estimatedTotal])

  // ── Portföy performans yorumu ─────────────────────────────────────────────

  const portfolioComment = useMemo(() => {
    if (!portfolio) return ''
    if (portfolio.risk_score > 70)
      return 'Portföy yüksek risk taşıyor. Düşük volatilite varlıkları eklemeyi değerlendirebilirsiniz.'
    if (portfolio.risk_score > 40)
      return 'Portföy orta risk seviyesinde. Çeşitlendirme dengeli görünüyor.'
    return 'Portföy düşük risk seviyesinde seyrediyor. Fırsat varlıkları için yer olabilir.'
  }, [portfolio])

  // ── Strateji 24 saat kilidi kontrolü ─────────────────────────────────────

  const strategyChangeLocked = useMemo(() => {
    if (!portfolio?.last_strategy_change) return false
    const last = new Date(portfolio.last_strategy_change).getTime()
    return Date.now() - last < 24 * 60 * 60 * 1000
  }, [portfolio])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSetupCreate = async (balance: number) => {
    setSetupLoading(true)
    setSetupError(null)
    try {
      const res = await fetch(`${BASE_URL}/api/simulation/create`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ initial_balance: balance, mode: setupMode }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Simülasyon oluşturulamadı')
      }
      await fetchPortfolio()
      fetchAssets()
    } catch (e: unknown) {
      setSetupError(e instanceof Error ? e.message : 'Hata')
    } finally {
      setSetupLoading(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('Sanal hesabı sıfırlamak istediğinize emin misiniz?')) return
    try {
      await fetch(`${BASE_URL}/api/simulation/reset`, { method: 'POST' })
    } catch {
      // bazı backend'lerde reset endpoint'i olmayabilir
    }
    setPortfolio(null)
    setTransactions([])
    setSelectedAsset(null)
    setImpact(null)
  }

  const handleSelectAsset = (asset: SimulationAsset) => {
    setSelectedAsset(asset)
    setRightTab('analiz')
    setTradeQty('')
    setTradeError(null)
    setShowImpactPreview(false)
    setPendingTrade(false)
  }

  const handleSelectPositionAsset = (pos: VirtualPositionExt) => {
    const match = assets.find((a) => a.symbol === pos.symbol)
    if (match) {
      setSelectedAsset(match)
      setActiveCategory(match.category)
      setRightTab('alsat')
      setTradeMode('sell')
    }
  }

  const handleTradeConfirm = async () => {
    if (!selectedAsset) return
    const qty = parseFloat(tradeQty)
    if (!qty || qty <= 0) { setTradeError('Geçerli bir miktar girin.'); return }
    if (tradeMode === 'buy' && cashAfterTrade < 0) {
      setTradeError('Yetersiz nakit bakiye.')
      return
    }
    if (tradeMode === 'sell') {
      const pos = portfolio?.positions.find((p) => p.symbol === selectedAsset.symbol)
      if (!pos) {
        setTradeError(`Portföyünüzde ${selectedAsset.symbol} pozisyonu bulunmuyor. Önce alım yapmalısınız.`)
        return
      }
      if (qty > pos.quantity) {
        setTradeError(
          `Yetersiz pozisyon: ${pos.quantity.toFixed(4)} adet mevcut, ${qty} satılmak isteniyor.`
        )
        return
      }
    }
    setShowImpactPreview(true)
    setPendingTrade(true)
  }

  const handleTradeExecute = async () => {
    if (!selectedAsset) return
    const qty = parseFloat(tradeQty)
    setTradeLoading(true)
    setTradeError(null)
    try {
      const endpoint = tradeMode === 'buy' ? '/api/simulation/manual/buy' : '/api/simulation/manual/sell'
      const body =
        tradeMode === 'buy'
          ? { symbol: selectedAsset.symbol, name: selectedAsset.name, quantity: qty, price: selectedAsset.price }
          : { symbol: selectedAsset.symbol, quantity: qty, price: selectedAsset.price }
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'İşlem başarısız')
      }
      setToast({ msg: `${tradeMode === 'buy' ? 'Alım' : 'Satım'} başarıyla tamamlandı (sanal).`, type: 'success' })
      setTradeQty('')
      setShowImpactPreview(false)
      setPendingTrade(false)
      await fetchPortfolio()
      fetchTransactions()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'İşlem başarısız'
      setTradeError(msg)
      setToast({ msg, type: 'error' })
    } finally {
      setTradeLoading(false)
    }
  }

  const handleSelectStrategy = async (strategyId: string, customAllocation?: any[]) => {
    if (strategyChangeLocked) return
    setStrategyError(null)
    try {
      const res = await fetch(`${BASE_URL}/api/simulation/ai/select-strategy`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          strategy_id: strategyId,
          custom_allocation: customAllocation || undefined
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Strateji seçilemedi')
      }
      const data = await res.json()
      const tradeCount = data.executed_trades?.length ?? 0
      setToast({
        msg: tradeCount > 0
          ? `Strateji seçildi — ${tradeCount} otomatik alım gerçekleştirildi.`
          : 'Strateji başarıyla seçildi.',
        type: 'success',
      })
      setShowAiWizard(false)
      await fetchPortfolio()
      fetchTransactions()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Hata'
      setStrategyError(msg)
      setToast({ msg, type: 'error' })
    }
  }


  // ── Yükleniyor Durumu ────────────────────────────────────────────────────

  if (portfolioLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 size={32} className="animate-spin text-blue-400" />
          <span className="text-sm">Simülasyon yükleniyor...</span>
        </div>
      </div>
    )
  }

  // ── HATA DURUMU ──────────────────────────────────────────────────────────

  if (portfolioError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-8 text-center max-w-md">
          <AlertCircle size={36} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-300 font-semibold mb-1">Bağlantı hatası</p>
          <p className="text-red-400/70 text-sm mb-4">{portfolioError}</p>
          <button
            onClick={() => { setPortfolioLoading(true); fetchPortfolio() }}
            className="px-5 py-2 bg-red-700/50 hover:bg-red-700 text-red-200 rounded-lg text-sm font-medium flex items-center gap-2 mx-auto"
          >
            <RefreshCw size={14} />
            Tekrar Dene
          </button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // SETUP EKRANI
  // ════════════════════════════════════════════════════════════════════════

  if (!portfolio) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        <div className="w-full max-w-lg">
          {/* Başlık */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-900/30 border border-blue-500/20 mb-4">
              <BarChart2 size={28} className="text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-white">Sanal Portföy Oluştur</h1>
            <p className="text-gray-400 mt-2">Gerçek para kullanmadan piyasayı deneyimle</p>
          </div>

          {/* Uyarı */}
          <div className="bg-amber-900/20 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-400/80 text-sm">
              Tüm işlemler sanaldır. Gerçek para yatırılmaz. 1 saat gecikmeli simülasyon verisi kullanılır.
            </p>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-6">
            {/* Mod Seçimi */}
            <div>
              <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Yönetim Modu</h3>
              <div className="grid grid-cols-2 gap-3">
                {(['manual', 'ai'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setSetupMode(m)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      setupMode === m
                        ? m === 'manual'
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {m === 'manual' ? (
                        <BarChart2 size={16} className="text-blue-400" />
                      ) : (
                        <Bot size={16} className="text-purple-400" />
                      )}
                      <span className="text-white font-semibold text-sm">
                        {m === 'manual' ? 'Manuel' : 'AI Yönetimli'}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs">
                      {m === 'manual'
                        ? 'Kendi al/sat kararlarını sen ver'
                        : 'AI strateji önersin, sen onayla'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Bütçe */}
            <div>
              <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Sanal Başlangıç Bütçesi</h3>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[1000, 10000, 100000].map((b) => (
                  <button
                    key={b}
                    onClick={() => setSetupBalance(b)}
                    className={`py-3 rounded-xl text-sm font-bold transition-all border ${
                      setupBalance === b
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-gray-600'
                    }`}
                  >
                    ₺{b.toLocaleString('tr-TR')}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Özel tutar (₺)"
                  value={setupCustom}
                  onChange={(e) => { setSetupCustom(e.target.value); setSetupBalance(null) }}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 placeholder-gray-600"
                />
              </div>
            </div>

            {setupError && (
              <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle size={14} />
                {setupError}
              </div>
            )}

            <button
              disabled={setupLoading || (!setupBalance && !setupCustom)}
              onClick={() => {
                const bal = setupBalance ?? parseFloat(setupCustom)
                if (bal > 0) handleSetupCreate(bal)
              }}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {setupLoading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
              Simülasyonu Başlat
            </button>

            <p className="text-gray-600 text-xs text-center">
              Tüm işlemler sanaldır. Gerçek para yatırılmaz. Yatırım tavsiyesi değildir.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // ANA PAPER TRADING EKRANI VEYA AI WIZARD
  // ════════════════════════════════════════════════════════════════════════

  // AI Modundayız ve strateji seçilmemişse VEYA "Stratejiyi Değiştir" e tıklanmışsa Wizard göster
  if (portfolio.mode === 'ai' && (!portfolio.active_strategy || showAiWizard)) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Üst Bar Basit */}
        <div className="border-b border-gray-800 bg-gray-900/80 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot size={20} className="text-purple-400" />
            <span className="font-bold text-white">Sanal Portföy <span className="text-gray-500 font-normal">| AI Kurulumu</span></span>
          </div>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-400 bg-gray-800 hover:bg-red-900/20 rounded-lg transition-colors border border-gray-700"
          >
            Sıfırla
          </button>
        </div>
        
        {strategyLoading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : (
          <AiStrategyWizard
            strategies={strategies}
            onSelectStrategy={handleSelectStrategy}
            onCancel={portfolio.active_strategy ? () => setShowAiWizard(false) : undefined}
          />
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Üst Bar ──────────────────────────────────────────────────── */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart2 size={20} className="text-blue-400" />
            <span className="font-bold text-white">Sanal Portföy</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              portfolio.mode === 'ai' ? 'bg-purple-900/40 text-purple-400' : 'bg-blue-900/40 text-blue-400'
            }`}>
              {portfolio.mode === 'ai' ? (
                <span className="flex items-center gap-1"><Bot size={10} />AI Mod</span>
              ) : (
                'Manuel Mod'
              )}
            </span>
            <DelayedBadge />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchPortfolio()}
              className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              title="Yenile"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-400 bg-gray-800 hover:bg-red-900/20 rounded-lg transition-colors border border-gray-700"
            >
              Sıfırla
            </button>
          </div>
        </div>

        {/* Uyarı Bandı */}
        <div className="px-4 pb-2">
          <div className="bg-red-950/40 border border-red-500/15 rounded-lg px-3 py-1.5 text-red-400/80 text-xs flex items-center gap-2">
            <ShieldAlert size={12} />
            Sanal simülasyon — gerçek emir gönderilmez, gerçek para kullanılmaz. Yatırım tavsiyesi değildir.
          </div>
        </div>
      </div>

      {/* ── Özet Kartlar (6 kart) ───────────────────────────────────── */}
      <div className="px-4 pt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <SummaryCard
          title="Sanal Bakiye"
          value={`₺${fmt(portfolio.cash_balance)}`}
          icon={Wallet}
          colorClass="text-amber-300"
          bgClass="bg-gray-900"
        />
        <SummaryCard
          title="Portföy Değeri"
          value={`₺${fmt(portfolio.total_portfolio_value)}`}
          sub={`Pozisyonlar: ₺${fmt(portfolio.positions_value)}`}
          icon={BarChart2}
          colorClass="text-blue-300"
        />
        <SummaryCard
          title="Günlük K/Z"
          value={
            <PnlDisplay pnl={portfolio.daily_pnl} pct={portfolio.daily_pnl_pct} size="sm" />
          }
          icon={portfolio.daily_pnl >= 0 ? TrendingUp : TrendingDown}
          colorClass=""
        />
        <SummaryCard
          title="Toplam Getiri"
          value={
            <PnlDisplay pnl={portfolio.total_return} pct={portfolio.total_return_pct} size="sm" />
          }
          sub={`Başlangıç: ₺${fmt(portfolio.initial_balance)}`}
          icon={portfolio.total_return >= 0 ? ArrowUpRight : ArrowDownRight}
          colorClass=""
        />
        <SummaryCard
          title="Risk Skoru"
          value={
            <span className={`text-lg font-bold ${
              portfolio.risk_score > 70 ? 'text-red-400' :
              portfolio.risk_score > 40 ? 'text-amber-400' : 'text-green-400'
            }`}>{portfolio.risk_score}/100</span>
          }
          icon={ShieldAlert}
          colorClass="text-amber-400"
        />
        <SummaryCard
          title="Veri Durumu"
          value={<span className="text-amber-300 text-sm font-medium">1s Gecikmeli</span>}
          sub={portfolio.data_status}
          icon={Clock}
          colorClass="text-amber-300"
        />
      </div>

      {/* ── Ana Layout: Sol | Orta | Sağ ───────────────────────────── */}
      <div className="flex gap-3 px-4 pt-4 pb-4" style={{ minHeight: 0 }}>

        {/* ──────── SOL PANEL (w-72) ──────── */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3">

          {/* Nakit Progress */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-xs font-medium">Nakit Oranı</span>
              <span className="text-amber-400 text-xs font-bold">
                {portfolio.total_portfolio_value > 0
                  ? fmt((portfolio.cash_balance / portfolio.total_portfolio_value) * 100, 1)
                  : '0.00'}%
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (portfolio.cash_balance / portfolio.total_portfolio_value) * 100)}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>₺{fmt(portfolio.cash_balance)}</span>
              <span>₺{fmt(portfolio.total_portfolio_value)}</span>
            </div>
          </div>

          {/* Pozisyonlar */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex-1 overflow-y-auto">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              <BarChart2 size={14} className="text-blue-400" />
              Pozisyonlar
            </h3>
            {portfolio.positions.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-600 text-xs">Henüz açık pozisyon yok</p>
                <p className="text-gray-700 text-xs mt-1">Varlık seç ve alım yap</p>
              </div>
            ) : (
              <div className="space-y-2">
                {portfolio.positions.map((pos) => (
                  <button
                    key={pos.symbol}
                    onClick={() => handleSelectPositionAsset(pos)}
                    className={`w-full text-left rounded-lg p-3 transition-all border ${
                      selectedAsset?.symbol === pos.symbol
                        ? 'bg-blue-900/20 border-blue-500/30'
                        : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="text-white text-xs font-bold">{pos.symbol}</span>
                        <span className="text-gray-500 text-xs ml-1">{pos.quantity.toFixed(4)}</span>
                      </div>
                      <CategoryBadge category={pos.category} />
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-gray-400 text-xs">₺{fmt(pos.market_value)}</span>
                      <PnlDisplay pnl={pos.pnl} pct={pos.pnl_pct} size="sm" />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                      <span>Maliyet: ₺{fmt(pos.avg_cost)}</span>
                      <span>Ağırlık: %{fmt(pos.portfolio_weight, 1)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mini Pasta Grafik */}
          {positionPieData.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <h3 className="text-white font-semibold text-sm mb-3">Dağılım</h3>
              <div className="flex items-center gap-3">
                <PieChart width={90} height={90}>
                  <Pie
                    data={positionPieData}
                    dataKey="value"
                    cx={40}
                    cy={40}
                    innerRadius={22}
                    outerRadius={40}
                  >
                    {positionPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  {positionPieData.slice(0, 5).map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-gray-400 text-xs truncate">{d.name}</span>
                      <span className="text-gray-500 text-xs ml-auto">{d.value.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ──────── ORTA PANEL (flex-1) ──────── */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">

          {/* Grafik Alanı */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            {selectedAsset ? (
              <>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-lg">{selectedAsset.name}</span>
                        <span className="text-gray-500 text-sm">({selectedAsset.symbol})</span>
                        <CategoryBadge category={selectedAsset.category} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-white font-bold text-2xl">₺{fmt(selectedAsset.price)}</span>
                        <span className={`text-sm font-semibold ${selectedAsset.change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {selectedAsset.change_pct >= 0 ? '+' : ''}{fmt(selectedAsset.change_pct)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DelayedBadge />
                    <div className="flex gap-1">
                      {['1G', '1H', '1A', '3A', '1Y'].map((r) => (
                        <button
                          key={r}
                          onClick={() => setChartRange(r)}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                            chartRange === r
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis dataKey="t" hide />
                      <YAxis domain={['auto', 'auto']} hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111827',
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(v: number) => [`₺${fmt(v)}`, 'Fiyat']}
                        labelFormatter={() => 'Gecikmeli Veri'}
                      />
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={selectedAsset.change_pct >= 0 ? '#22c55e' : '#ef4444'}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BarChart2 size={36} className="text-gray-700 mb-3" />
                <p className="text-gray-500 text-sm font-medium">Bir varlık seçin</p>
                <p className="text-gray-700 text-xs mt-1">Aşağıdaki listeden bir varlığa tıklayın</p>
              </div>
            )}
          </div>

          {/* Varlık Seçici */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {CATEGORY_TABS.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {assetsLoading ? (
              <div className="flex justify-center py-6"><Spinner /></div>
            ) : filteredAssets.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-4">Bu kategoride varlık bulunamadı</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                {filteredAssets.map((asset) => (
                  <button
                    key={asset.symbol}
                    onClick={() => handleSelectAsset(asset)}
                    className={`text-left rounded-xl p-3 border transition-all ${
                      selectedAsset?.symbol === asset.symbol
                        ? 'bg-blue-900/20 border-blue-500/50'
                        : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-white text-xs font-bold">{asset.symbol}</span>
                      <RiskBadge level={asset.risk_level} />
                    </div>
                    <p className="text-gray-400 text-xs truncate mb-2">{asset.name}</p>
                    <p className="text-white text-sm font-semibold">₺{fmt(asset.price)}</p>
                    <p className={`text-xs font-medium mt-0.5 ${asset.change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {asset.change_pct >= 0 ? '+' : ''}{fmt(asset.change_pct)}%
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-gray-600 text-xs">Vol</span>
                      <ScoreBar
                        value={asset.volatility_score}
                        max={10}
                        color={asset.volatility_score > 7 ? 'bg-red-500' : asset.volatility_score > 4 ? 'bg-amber-500' : 'bg-green-500'}
                      />
                      <span className="text-gray-500 text-xs">{asset.volatility_score}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ──────── SAĞ PANEL (w-80) ──────── */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3">

          {/* AI Mod — Aktif Strateji Özeti */}
          {portfolio.mode === 'ai' && portfolio.active_strategy && (
            <div className="bg-gray-900 rounded-xl border border-purple-500/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bot size={15} className="text-purple-400" />
                  <span className="text-purple-400 font-semibold text-sm">Aktif Strateji</span>
                </div>
                <button
                  onClick={() => setShowAiWizard(true)}
                  disabled={strategyChangeLocked}
                  className="text-xs text-purple-400 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Değiştir
                </button>
              </div>

              {strategyChangeLocked && (
                <div className="bg-amber-900/20 border border-amber-500/20 rounded-lg p-2.5 mb-3 flex items-start gap-2">
                  <Clock size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-amber-400/80 text-xs">Son değişimden bu yana 24 saat geçmedi.</p>
                </div>
              )}

              <div className="rounded-xl border border-purple-500 bg-purple-900/10 p-3">
                <div className="flex items-start justify-between mb-1">
                  <span className="text-white text-xs font-bold">{portfolio.active_strategy.name}</span>
                </div>
                <p className="text-gray-400 text-xs mb-2">{portfolio.active_strategy.description}</p>
                <div className="space-y-1.5 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs w-16">Risk</span>
                    <ScoreBar value={portfolio.active_strategy.risk_score} max={10} color="bg-red-500" />
                    <span className="text-gray-400 text-xs">{portfolio.active_strategy.risk_score}/10</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs w-16">Fırsat</span>
                    <ScoreBar value={portfolio.active_strategy.opportunity_score} max={10} color="bg-green-500" />
                    <span className="text-gray-400 text-xs">{portfolio.active_strategy.opportunity_score}/10</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Analiz / Al-Sat Sekmeleri */}
          {selectedAsset ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 flex flex-col" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
              {/* Sekme Başlıkları */}
              <div className="flex border-b border-gray-800 flex-shrink-0">
                <button
                  onClick={() => setRightTab('analiz')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    rightTab === 'analiz'
                      ? 'text-purple-400 border-b-2 border-purple-500'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Analiz
                </button>
                <button
                  onClick={() => setRightTab('alsat')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    rightTab === 'alsat'
                      ? 'text-blue-400 border-b-2 border-blue-500'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Al / Sat
                </button>
              </div>

              {/* ── ANALİZ SEKMESİ ── */}
              {rightTab === 'analiz' && (
                <div className="p-4 space-y-4">
                  {/* Varlık Özeti */}
                  <div>
                    <h4 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Varlık Özeti</h4>
                    <div className="bg-gray-800/50 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-xs">Fiyat</span>
                        <span className="text-white text-sm font-bold">₺{fmt(selectedAsset.price)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-xs">Değişim</span>
                        <span className={`text-sm font-medium ${selectedAsset.change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {selectedAsset.change_pct >= 0 ? '+' : ''}{fmt(selectedAsset.change_pct)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-xs">Risk Seviyesi</span>
                        <RiskBadge level={selectedAsset.risk_level} />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-xs">Volatilite</span>
                        <div className="flex items-center gap-2">
                          <ScoreBar
                            value={selectedAsset.volatility_score}
                            max={10}
                            color="bg-amber-500"
                          />
                          <span className="text-amber-400 text-xs">{selectedAsset.volatility_score}/10</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <NewsSensitivityBadge level={selectedAsset.news_sensitivity} />
                      </div>
                    </div>
                  </div>

                  {/* Impact Analizi */}
                  {impactLoading ? (
                    <div className="flex justify-center py-6"><Spinner /></div>
                  ) : impact ? (
                    <>
                      {/* Portföy Etki */}
                      <div>
                        <h4 className="text-gray-400 text-xs uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Info size={11} />
                          Portföy Etkisi (₺10.000 baz)
                        </h4>
                        <div className="bg-purple-900/10 border border-purple-500/15 rounded-xl p-3 space-y-2">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-400">Ağırlık</span>
                              <span className="text-purple-300">
                                %{fmt(impact.portfolio_weight_before, 1)} → %{fmt(impact.portfolio_weight_after, 1)}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                                <div className="bg-gray-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, impact.portfolio_weight_before)}%` }} />
                              </div>
                              <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                                <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, impact.portfolio_weight_after)}%` }} />
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Risk Skoru</span>
                            <span className={impact.risk_score_after > impact.risk_score_before ? 'text-red-400' : 'text-green-400'}>
                              {fmt(impact.risk_score_before, 0)} → {fmt(impact.risk_score_after, 0)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Volatilite</span>
                            <span className={impact.volatility_after > impact.volatility_before ? 'text-amber-400' : 'text-green-400'}>
                              {fmt(impact.volatility_before, 1)} → {fmt(impact.volatility_after, 1)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Yoğunlaşma Riski</span>
                            <span className={impact.concentration_risk ? 'text-red-400' : 'text-green-400'}>
                              {impact.concentration_risk ? 'Evet ⚠' : 'Hayır ✓'}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Maks. Günlük Salınım</span>
                            <span className="text-amber-400">±%{fmt(impact.max_daily_swing_pct, 1)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Uyarılar */}
                      {impact.warnings.length > 0 && (
                        <div>
                          <h4 className="text-amber-400 text-xs uppercase tracking-wide mb-2 flex items-center gap-1">
                            <AlertCircle size={11} />
                            Uyarılar
                          </h4>
                          <div className="space-y-1.5">
                            {impact.warnings.map((w, i) => (
                              <div key={i} className="bg-amber-900/20 border border-amber-500/20 rounded-lg p-2.5 text-amber-400/90 text-xs">
                                {w}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Senaryo Analizi */}
                      <div>
                        <h4 className="text-gray-400 text-xs uppercase tracking-wide mb-2">Senaryo Analizi</h4>
                        <div className="space-y-2">
                          {/* Pozitif */}
                          <div className="bg-green-900/10 border border-green-500/20 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              <span className="text-green-400 text-xs font-semibold">{impact.positive_scenario.title}</span>
                            </div>
                            <p className="text-green-400/70 text-xs mb-1.5">{impact.positive_scenario.description}</p>
                            <ul className="space-y-0.5">
                              {impact.positive_scenario.conditions.map((c, i) => (
                                <li key={i} className="text-green-500/60 text-xs flex items-start gap-1">
                                  <span className="mt-0.5">•</span> {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                          {/* Nötr */}
                          <div className="bg-amber-900/10 border border-amber-500/20 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-2 h-2 rounded-full bg-amber-500" />
                              <span className="text-amber-400 text-xs font-semibold">{impact.neutral_scenario.title}</span>
                            </div>
                            <p className="text-amber-400/70 text-xs mb-1.5">{impact.neutral_scenario.description}</p>
                            <ul className="space-y-0.5">
                              {impact.neutral_scenario.conditions.map((c, i) => (
                                <li key={i} className="text-amber-500/60 text-xs flex items-start gap-1">
                                  <span className="mt-0.5">•</span> {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                          {/* Negatif */}
                          <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="text-red-400 text-xs font-semibold">{impact.negative_scenario.title}</span>
                            </div>
                            <p className="text-red-400/70 text-xs mb-1.5">{impact.negative_scenario.description}</p>
                            <ul className="space-y-0.5">
                              {impact.negative_scenario.conditions.map((c, i) => (
                                <li key={i} className="text-red-500/60 text-xs flex items-start gap-1">
                                  <span className="mt-0.5">•</span> {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* İlgili Haberler */}
                      {impact.related_news.length > 0 && (
                        <div>
                          <h4 className="text-gray-400 text-xs uppercase tracking-wide mb-2">İlgili Haberler</h4>
                          <div className="space-y-1.5">
                            {impact.related_news.slice(0, 3).map((n, i) => (
                              <div key={i} className="bg-gray-800/50 rounded-lg p-2.5 text-gray-400 text-xs flex items-start gap-2">
                                <Info size={11} className="text-blue-400 mt-0.5 flex-shrink-0" />
                                {n}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Disclaimer */}
                      <p className="text-gray-700 text-xs text-center">{impact.disclaimer}</p>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-600 text-xs">Analiz yüklenemedi</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── AL/SAT SEKMESİ ── */}
              {rightTab === 'alsat' && (
                <div className="p-4 space-y-4">
                  <div className="bg-red-950/30 border border-red-500/15 rounded-lg p-2.5 text-red-400/80 text-xs flex items-center gap-2">
                    <ShieldAlert size={11} />
                    Sanal işlem — gerçek para değildir
                  </div>

                  {/* AL/SAT Toggle */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setTradeMode('buy'); setTradeError(null); setShowImpactPreview(false); setPendingTrade(false) }}
                      className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                        tradeMode === 'buy'
                          ? 'bg-green-600 text-white shadow-lg shadow-green-900/30'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      AL
                    </button>
                    <button
                      onClick={() => { setTradeMode('sell'); setTradeError(null); setShowImpactPreview(false); setPendingTrade(false) }}
                      className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                        tradeMode === 'sell'
                          ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      SAT
                    </button>
                  </div>

                  {/* Varlık Bilgisi */}
                  <div className="bg-gray-800/50 rounded-xl p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold text-sm">{selectedAsset.name}</span>
                      <DelayedBadge />
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-white font-bold">₺{fmt(selectedAsset.price)}</span>
                      <span className={`text-sm ${selectedAsset.change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {selectedAsset.change_pct >= 0 ? '+' : ''}{fmt(selectedAsset.change_pct)}%
                      </span>
                    </div>
                  </div>

                  {/* Miktar */}
                  <div>
                    <label className="text-gray-400 text-xs block mb-1.5">Miktar (Adet)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={tradeQty}
                      onChange={(e) => { setTradeQty(e.target.value); setTradeError(null); setShowImpactPreview(false); setPendingTrade(false) }}
                      placeholder="0.00"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 placeholder-gray-600"
                    />
                  </div>

                  {/* Özet */}
                  {tradeQty && parseFloat(tradeQty) > 0 && (
                    <div className="bg-gray-800/50 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Tahmini Tutar</span>
                        <span className="text-white font-semibold">₺{fmt(estimatedTotal)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">İşlem Sonrası Nakit</span>
                        <span className={cashAfterTrade < 0 ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold'}>
                          ₺{fmt(cashAfterTrade)}
                        </span>
                      </div>
                      {impact && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Portföy Ağırlığı</span>
                          <span className="text-purple-400">
                            %{fmt(impact.portfolio_weight_before, 1)} → %{fmt(impact.portfolio_weight_after, 1)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {tradeError && (
                    <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs flex items-center gap-2">
                      <AlertCircle size={13} />
                      {tradeError}
                    </div>
                  )}

                  {/* Onay Butonu */}
                  {!pendingTrade ? (
                    <button
                      onClick={handleTradeConfirm}
                      disabled={!tradeQty || parseFloat(tradeQty) <= 0}
                      className={`w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        tradeMode === 'buy'
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                      }`}
                    >
                      {tradeMode === 'buy' ? 'Al — İşlemi Onayla' : 'Sat — İşlemi Onayla'}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {/* İmpact Önizleme */}
                      {showImpactPreview && impact && (
                        <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-3 space-y-1.5">
                          <p className="text-gray-300 text-xs font-semibold mb-2">İşlem Özeti</p>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Risk Değişimi</span>
                            <span className={impact.risk_score_after > impact.risk_score_before ? 'text-red-400' : 'text-green-400'}>
                              {fmt(impact.risk_score_before, 0)} → {fmt(impact.risk_score_after, 0)}
                            </span>
                          </div>
                          {impact.concentration_risk && (
                            <div className="bg-amber-900/20 rounded-lg p-2 text-amber-400/80 text-xs flex items-center gap-1.5">
                              <AlertCircle size={11} />
                              Yoğunlaşma riski oluşabilir!
                            </div>
                          )}
                          {impact.warnings.slice(0, 1).map((w, i) => (
                            <div key={i} className="bg-amber-900/10 rounded p-1.5 text-amber-400/70 text-xs">{w}</div>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => { setPendingTrade(false); setShowImpactPreview(false) }}
                          className="py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors"
                        >
                          Vazgeç
                        </button>
                        <button
                          onClick={handleTradeExecute}
                          disabled={tradeLoading}
                          className={`py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${
                            tradeMode === 'buy'
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-red-600 hover:bg-red-700 text-white'
                          }`}
                        >
                          {tradeLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                          {tradeLoading ? 'Bekle...' : 'Kesin Onayla'}
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="text-gray-700 text-xs text-center">
                    Sanal emir — gerçek piyasaya iletilmez. Yatırım tavsiyesi değildir.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col items-center justify-center min-h-48 text-center">
              <ChevronRight size={28} className="text-gray-700 mb-3" />
              <p className="text-gray-500 text-sm">Analiz ve al/sat için</p>
              <p className="text-gray-600 text-xs mt-1">Aşağıdan bir varlık seçin</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Alt Panel ───────────────────────────────────────────────── */}
      <div className="px-4 pb-8">
        <div className="bg-gray-900 rounded-xl border border-gray-800">
          {/* Sekme Başlıkları */}
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setBottomTab('gecmis')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                bottomTab === 'gecmis'
                  ? 'text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              İşlem Geçmişi
            </button>
            <button
              onClick={() => setBottomTab('performans')}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                bottomTab === 'performans'
                  ? 'text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Performans
            </button>
          </div>

          {/* ── İşlem Geçmişi ── */}
          {bottomTab === 'gecmis' && (
            <div className="p-4">
              {txLoading ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-10">
                  <Clock size={28} className="text-gray-700 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Henüz işlem yapılmadı</p>
                  <p className="text-gray-700 text-xs mt-1">İlk sanal işleminizi yapın</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-800">
                        <th className="text-left pb-3 font-medium">Tarih</th>
                        <th className="text-left pb-3 font-medium">Varlık</th>
                        <th className="text-left pb-3 font-medium">İşlem</th>
                        <th className="text-right pb-3 font-medium">Miktar</th>
                        <th className="text-right pb-3 font-medium">Fiyat</th>
                        <th className="text-right pb-3 font-medium">Toplam</th>
                        <th className="text-right pb-3 font-medium">Tip</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="text-xs hover:bg-gray-800/30 transition-colors">
                          <td className="py-2.5 text-gray-500">{fmtDate(tx.timestamp)}</td>
                          <td className="py-2.5">
                            <div className="text-white font-medium">{tx.symbol}</div>
                            <div className="text-gray-500">{tx.name}</div>
                          </td>
                          <td className="py-2.5">
                            <span className={`px-2 py-1 rounded font-bold text-xs ${
                              tx.tx_type === 'buy'
                                ? 'bg-green-900/40 text-green-400'
                                : 'bg-red-900/40 text-red-400'
                            }`}>
                              {tx.tx_type === 'buy' ? 'ALIM' : 'SATIM'}
                            </span>
                          </td>
                          <td className="py-2.5 text-right text-gray-300">{tx.quantity.toFixed(4)}</td>
                          <td className="py-2.5 text-right text-gray-300">₺{fmt(tx.price)}</td>
                          <td className="py-2.5 text-right text-white font-semibold">₺{fmt(tx.total)}</td>
                          <td className="py-2.5 text-right">
                            <span className="text-gray-600 text-xs bg-gray-800 px-1.5 py-0.5 rounded">Sanal</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Performans ── */}
          {bottomTab === 'performans' && (
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* 1 Günlük */}
                <PerformanceCard
                  label="1 Günlük"
                  pnl={portfolio.daily_pnl}
                  pct={portfolio.daily_pnl_pct}
                  seed={1}
                  baseValue={portfolio.total_portfolio_value}
                />
                {/* 1 Haftalık */}
                <PerformanceCard
                  label="1 Haftalık"
                  pnl={portfolio.weekly_pnl}
                  pct={portfolio.weekly_pnl_pct}
                  seed={7}
                  baseValue={portfolio.total_portfolio_value}
                />
                {/* 1 Aylık */}
                <PerformanceCard
                  label="1 Aylık"
                  pnl={portfolio.monthly_pnl}
                  pct={portfolio.monthly_pnl_pct}
                  seed={30}
                  baseValue={portfolio.total_portfolio_value}
                />
              </div>

              {/* Portföy Yorumu */}
              <div className="bg-purple-900/10 border border-purple-500/15 rounded-xl p-4 flex items-start gap-3">
                <Bot size={18} className="text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-purple-400 text-xs font-semibold mb-1">Portföy Değerlendirmesi</p>
                  <p className="text-purple-300/80 text-sm">{portfolioComment}</p>
                  <p className="text-gray-600 text-xs mt-2">
                    Risk Skoru: {portfolio.risk_score}/100 · Volatilite: {portfolio.volatility_score}/100
                  </p>
                  <p className="text-gray-700 text-xs mt-1">Yatırım tavsiyesi değildir.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Performans Kartı ──────────────────────────────────────────────────────────

function PerformanceCard({
  label,
  pnl,
  pct,
  seed,
  baseValue,
}: {
  label: string
  pnl: number
  pct: number
  seed: number
  baseValue: number
}) {
  const chartData = useMemo(() => {
    return generateMockChart(baseValue - Math.abs(pnl), seed, 20)
  }, [baseValue, pnl, seed])

  return (
    <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 p-4">
      <div className="flex justify-between items-start mb-3">
        <span className="text-gray-400 text-sm font-medium">{label}</span>
        <PnlDisplay pnl={pnl} pct={pct} size="sm" />
      </div>
      <div style={{ height: 60 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="v"
              stroke={pnl >= 0 ? '#22c55e' : '#ef4444'}
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
