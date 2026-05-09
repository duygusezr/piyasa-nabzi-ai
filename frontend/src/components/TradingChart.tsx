import { useState, useMemo } from 'react'
import {
  ComposedChart, Area, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import type { MarketData } from '../types'
import { generateOHLC, sliceByPeriod } from '../utils/chartData'

type Period = '1W' | '1M' | '3M' | '1Y'
type Asset  = 'BTC' | 'XAU' | 'USDTRY' | 'XU100' | 'ETH'

const ASSETS: { key: Asset; label: string; priceKey: keyof MarketData }[] = [
  { key: 'BTC',    label: 'BTC/TRY',  priceKey: 'bitcoin' },
  { key: 'XAU',    label: 'XAU/TRY',  priceKey: 'gold' },
  { key: 'USDTRY', label: 'USD/TRY',  priceKey: 'usd_try' },
  { key: 'XU100',  label: 'BIST 100', priceKey: 'bist100' },
]

const PERIODS: Period[] = ['1W', '1M', '3M', '1Y']

const DEFAULT_PRICES: Record<Asset, number> = {
  BTC: 2_850_000, XAU: 3_180, USDTRY: 32.85, XU100: 9_850, ETH: 108_500,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const pos = d.close >= d.open
  return (
    <div className="t-card-sm text-2xs font-mono space-y-1" style={{ minWidth: 140 }}>
      <p className="text-slate-400 font-sans text-2xs">{label}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span className="text-slate-500">O</span><span className="text-white">{d.open?.toLocaleString('tr-TR')}</span>
        <span className="text-slate-500">H</span><span className="text-bull">{d.high?.toLocaleString('tr-TR')}</span>
        <span className="text-slate-500">L</span><span className="text-bear">{d.low?.toLocaleString('tr-TR')}</span>
        <span className="text-slate-500">C</span>
        <span className={pos ? 'text-bull font-bold' : 'text-bear font-bold'}>
          {d.close?.toLocaleString('tr-TR')}
        </span>
      </div>
    </div>
  )
}

interface TradingChartProps {
  marketData?: MarketData | null
}

export default function TradingChart({ marketData }: TradingChartProps) {
  const [period, setPeriod] = useState<Period>('1M')
  const [asset, setAsset] = useState<Asset>('BTC')

  const basePrice = useMemo(() => {
    if (!marketData) return DEFAULT_PRICES[asset]
    const a = ASSETS.find((a) => a.key === asset)
    if (!a) return DEFAULT_PRICES[asset]
    return (marketData[a.priceKey] as import('../types').AssetPrice)?.price ?? DEFAULT_PRICES[asset]
  }, [marketData, asset])

  const allData = useMemo(() => generateOHLC(basePrice, 365), [basePrice])
  const data    = useMemo(() => sliceByPeriod(allData, period), [allData, period])

  const last  = data[data.length - 1]
  const first = data[0]
  const pct   = first ? ((last.close - first.close) / first.close) * 100 : 0
  const pos   = pct >= 0

  return (
    <div className="t-card flex flex-col" style={{ minHeight: 340 }}>
      {/* Header */}
      <div className="panel-header shrink-0">
        <div className="flex items-center gap-3">
          {/* Asset selector */}
          <div className="flex gap-1">
            {ASSETS.map((a) => (
              <button
                key={a.key}
                onClick={() => setAsset(a.key)}
                className={`t-btn-ghost text-2xs px-2 py-1 ${asset === a.key ? 'active' : ''}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        {/* Period selector */}
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`t-btn-ghost text-2xs px-2 py-1 ${period === p ? 'active' : ''}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Price summary */}
      <div className="flex items-baseline gap-3 px-4 py-2 shrink-0">
        <span className="text-xl font-bold font-mono text-white">
          {last?.close.toLocaleString('tr-TR', { maximumFractionDigits: last.close < 100 ? 2 : 0 })}
        </span>
        <span className={`text-sm font-mono font-semibold ${pos ? 'text-bull' : 'text-bear'}`}>
          {pos ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}% ({period})
        </span>
        <span className="text-2xs text-slate-600 ml-auto">Simülasyon verisi</span>
      </div>

      {/* Main chart */}
      <div className="flex-1 px-2 pb-1" style={{ minHeight: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={pos ? '#00d97e' : '#ff3e5e'} stopOpacity={0.2} />
                <stop offset="100%" stopColor={pos ? '#00d97e' : '#ff3e5e'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1a2535" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: '#475569' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 9, fill: '#475569', fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={false}
              width={60}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toFixed(2)}
              orientation="right"
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#2a3f5a', strokeWidth: 1 }} />
            <ReferenceLine
              y={first?.close}
              stroke="#2a3f5a"
              strokeDasharray="4 2"
              strokeWidth={1}
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke={pos ? '#00d97e' : '#ff3e5e'}
              strokeWidth={1.5}
              fill="url(#chartGrad)"
              dot={false}
              activeDot={{ r: 3, fill: pos ? '#00d97e' : '#ff3e5e' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Volume mini chart */}
      <div className="px-2 pb-2 shrink-0" style={{ height: 48 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
            <Bar
              dataKey="volume"
              fill={pos ? 'rgba(0,217,126,0.3)' : 'rgba(255,62,94,0.3)'}
              radius={[1, 1, 0, 0]}
            />
            <YAxis hide domain={['auto', 'auto']} />
            <XAxis hide dataKey="date" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
