import { useMemo } from 'react'
import type { MarketData, AssetPrice } from '../types'
import { generateSparkline } from '../utils/chartData'

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const W = 72, H = 28

  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`)
    .join(' ')

  const areaPoints = `0,${H} ${points} ${W},${H}`
  const color = positive ? '#00d97e' : '#ff3e5e'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${positive}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sg-${positive})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

const ICONS: Record<string, string> = {
  BTC: '₿', ETH: 'Ξ', XAU: '⬡', USDTRY: '$', XU100: '◈', ASELS: '◉',
}

function AssetCard({ asset }: { asset: AssetPrice }) {
  const pos = asset.change_pct_24h >= 0
  const spark = useMemo(() => generateSparkline(asset.price), [asset.symbol])
  const icon = ICONS[asset.symbol] ?? asset.symbol[0]

  return (
    <div
      className="t-card-md flex flex-col gap-2 cursor-default hover:border-slate-600 transition-all duration-150 animate-fade-in"
      style={{ minWidth: 160 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex items-center justify-center text-xs font-bold shrink-0"
            style={{
              width: 24, height: 24, borderRadius: 5,
              background: 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.3)',
              color: '#8b5cf6',
            }}
          >
            {icon}
          </span>
          <div>
            <p className="text-2xs font-semibold text-white leading-none">{asset.symbol}</p>
            <p className="text-2xs text-slate-600 leading-none mt-0.5 truncate max-w-[80px]">{asset.name}</p>
          </div>
        </div>
        {asset.is_mock && (
          <span className="badge-muted text-2xs">MOCK</span>
        )}
      </div>

      {/* Price + sparkline */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-sm font-bold font-mono text-white leading-none">
            {asset.price.toLocaleString('tr-TR', {
              maximumFractionDigits: asset.price < 100 ? 2 : 0,
            })}
          </p>
          <p className={`text-2xs font-mono font-bold mt-1 ${pos ? 'text-bull' : 'text-bear'}`}>
            {pos ? '▲' : '▼'} {Math.abs(asset.change_pct_24h).toFixed(2)}%
          </p>
        </div>
        <Sparkline data={spark} positive={pos} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1.5" style={{ borderTop: '1px solid #1a2535' }}>
        <span className="text-2xs text-slate-600">{asset.source}</span>
        <span className="text-2xs font-mono text-slate-600">
          {new Date(asset.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

interface MarketCardsProps {
  data: MarketData | null | undefined
  isLoading?: boolean
}

export default function MarketCards({ data, isLoading }: MarketCardsProps) {
  const assets = data?.assets ?? []

  return (
    <section>
      <div className="panel-header">
        <span className="panel-title">Market Overview</span>
        {data && (
          <span className="text-2xs font-mono text-slate-600">
            {new Date(data.fetched_at).toLocaleString('tr-TR')}
          </span>
        )}
      </div>

      <div className="p-3">
        {isLoading ? (
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="t-card-md animate-pulse space-y-3">
                <div className="h-3 bg-t-muted rounded w-3/4" />
                <div className="h-5 bg-t-muted rounded w-1/2" />
                <div className="h-7 bg-t-muted rounded" />
              </div>
            ))}
          </div>
        ) : assets.length > 0 ? (
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {assets.map((a) => <AssetCard key={a.symbol} asset={a} />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { symbol: 'BTC', name: 'Bitcoin',  price: 2_850_000, change_pct_24h: 1.6,   currency: 'TRY', change_24h: 0, timestamp: new Date().toISOString(), source: 'Mock', is_mock: true },
              { symbol: 'XAU', name: 'Altın',    price: 3_180,     change_pct_24h: 0.7,   currency: 'TRY', change_24h: 0, timestamp: new Date().toISOString(), source: 'Mock', is_mock: true },
              { symbol: 'USDTRY', name: 'USD/TRY', price: 32.85,   change_pct_24h: 0.37,  currency: 'TRY', change_24h: 0, timestamp: new Date().toISOString(), source: 'Mock', is_mock: true },
              { symbol: 'XU100', name: 'BIST 100', price: 9_850,   change_pct_24h: -0.46, currency: 'TRY', change_24h: 0, timestamp: new Date().toISOString(), source: 'Mock', is_mock: true },
              { symbol: 'ETH', name: 'Ethereum', price: 108_500,   change_pct_24h: -1.1,  currency: 'TRY', change_24h: 0, timestamp: new Date().toISOString(), source: 'Mock', is_mock: true },
              { symbol: 'ASELS', name: 'ASELSAN', price: 54.80,    change_pct_24h: 2.24,  currency: 'TRY', change_24h: 0, timestamp: new Date().toISOString(), source: 'Mock', is_mock: true },
            ].map((a) => <AssetCard key={a.symbol} asset={a as import('../types').AssetPrice} />)}
          </div>
        )}
      </div>
    </section>
  )
}
