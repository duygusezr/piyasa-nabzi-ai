import type { MarketData } from '../types'

interface TickerItem {
  symbol: string
  price: number
  pct: number
  currency: string
}

function buildTickerItems(data?: MarketData | null): TickerItem[] {
  if (!data) {
    return [
      { symbol: 'BTC/TRY',  price: 2_850_000, pct:  1.6,  currency: '₺' },
      { symbol: 'XAU/TRY',  price: 3_180,     pct:  0.7,  currency: '₺' },
      { symbol: 'USD/TRY',  price: 32.85,     pct:  0.37, currency: '₺' },
      { symbol: 'BIST 100', price: 9_850,     pct: -0.46, currency: '₺' },
      { symbol: 'ETH/TRY',  price: 108_500,   pct: -1.1,  currency: '₺' },
      { symbol: 'ASELS',    price: 54.80,     pct:  2.24, currency: '₺' },
    ]
  }
  return data.assets.map((a) => ({
    symbol:   a.symbol === 'BTC' ? 'BTC/TRY'
            : a.symbol === 'ETH' ? 'ETH/TRY'
            : a.symbol === 'XAU' ? 'XAU/TRY'
            : a.name,
    price:    a.price,
    pct:      a.change_pct_24h,
    currency: '₺',
  }))
}

function TickerChip({ item }: { item: TickerItem }) {
  const pos = item.pct >= 0
  return (
    <span className="flex items-center gap-2 px-4 shrink-0 select-none">
      <span className="text-2xs font-semibold text-slate-400">{item.symbol}</span>
      <span className="text-xs font-mono font-semibold text-white">
        {item.price.toLocaleString('tr-TR', { maximumFractionDigits: item.price < 100 ? 2 : 0 })}
      </span>
      <span className={`text-2xs font-mono font-bold ${pos ? 'text-bull' : 'text-bear'}`}>
        {pos ? '+' : ''}{item.pct.toFixed(2)}%
      </span>
      <span className="text-slate-700">│</span>
    </span>
  )
}

interface TopBarProps {
  marketData?: MarketData | null
  lastUpdated?: string
  isLive?: boolean
  onOpenAnalysis: () => void
}

export default function TopBar({ marketData, lastUpdated, isLive, onOpenAnalysis }: TopBarProps) {
  const items = buildTickerItems(marketData)
  const doubled = [...items, ...items]

  const timeStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('tr-TR')
    : new Date().toLocaleTimeString('tr-TR')

  return (
    <header style={{ background: '#080e1c', borderBottom: '1px solid #1a2535' }}>
      {/* Top row */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-bold text-white leading-none">Piyasa Nabzı AI</p>
            <p className="text-2xs text-slate-500 leading-none mt-0.5">
              AI Destekli Finansal Analiz
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Analysis button */}
          <button
            onClick={onOpenAnalysis}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150"
            style={{ background: 'rgba(6,214,240,0.12)', color: '#06d6f0', border: '1px solid rgba(6,214,240,0.25)' }}
          >
            <span>✦</span> AI Analiz
          </button>

          {/* Sim badge */}
          <span className="badge-warn text-2xs px-2 py-1">SİMÜLASYON</span>

          {/* Live / time */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded" style={{ background: '#0c1320', border: '1px solid #1a2535' }}>
            {isLive ? <div className="live-dot" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />}
            <span className="text-2xs font-mono text-slate-400">{timeStr}</span>
          </div>
        </div>
      </div>

      {/* Ticker row */}
      <div
        className="ticker-wrap overflow-hidden"
        style={{ height: 28, borderTop: '1px solid #1a2535', background: '#060b12' }}
      >
        <div className="ticker-inner flex items-center h-full animate-ticker">
          {doubled.map((item, i) => (
            <TickerChip key={i} item={item} />
          ))}
        </div>
      </div>
    </header>
  )
}
