import { useMemo } from 'react'
import type { MarketData, AssetImpact } from '../types'
import { generateSparkline } from '../utils/chartData'

const MOCK_WATCHLIST = [
  { symbol: 'BTC',    name: 'Bitcoin',    price: 2_850_000, pct:  1.60, signal: 'BUY',   risk: 'HIGH' },
  { symbol: 'XAU',    name: 'Altın',      price: 3_180,     pct:  0.70, signal: 'HOLD',  risk: 'LOW'  },
  { symbol: 'USDTRY', name: 'USD/TRY',    price: 32.85,     pct:  0.37, signal: 'WATCH', risk: 'MED'  },
  { symbol: 'XU100',  name: 'BIST 100',   price: 9_850,     pct: -0.46, signal: 'HOLD',  risk: 'MED'  },
  { symbol: 'ETH',    name: 'Ethereum',   price: 108_500,   pct: -1.10, signal: 'WATCH', risk: 'HIGH' },
  { symbol: 'ASELS',  name: 'ASELSAN',    price: 54.80,     pct:  2.24, signal: 'BUY',   risk: 'LOW'  },
  { symbol: 'THYAO',  name: 'Türk Hava Yolları', price: 312.5, pct: 0.80, signal: 'HOLD', risk: 'MED' },
  { symbol: 'SASA',   name: 'Sasa Polyester', price: 48.20, pct: -0.62, signal: 'WATCH', risk: 'MED'  },
]

const SIGNAL_STYLE: Record<string, { cls: string; label: string }> = {
  BUY:   { cls: 'badge-bull',  label: 'AL SİN.' },
  SELL:  { cls: 'badge-bear',  label: 'SAT SİN.' },
  HOLD:  { cls: 'badge-muted', label: 'BEKLE' },
  WATCH: { cls: 'badge-warn',  label: 'İZLE' },
}

const RISK_STYLE: Record<string, { cls: string; label: string }> = {
  LOW:  { cls: 'badge-bull',  label: 'DÜŞÜK' },
  MED:  { cls: 'badge-warn',  label: 'ORTA' },
  HIGH: { cls: 'badge-bear',  label: 'YÜKSEK' },
}

function MiniSpark({ price, pct }: { price: number; pct: number }) {
  const data = useMemo(() => generateSparkline(price, 14), [price])
  const pos  = pct >= 0
  const min  = Math.min(...data), max = Math.max(...data), range = max - min || 1
  const W = 48, H = 20
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`
  ).join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline points={pts} fill="none" stroke={pos ? '#00d97e' : '#ff3e5e'} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

interface WatchlistTableProps {
  data?: MarketData | null
  impacts?: AssetImpact[]
}

function buildRows(data?: MarketData | null) {
  if (!data?.assets?.length) return MOCK_WATCHLIST
  return data.assets.map((a) => ({
    symbol: a.symbol,
    name:   a.name,
    price:  a.price,
    pct:    a.change_pct_24h,
    signal: a.change_pct_24h > 1.5 ? 'BUY' : a.change_pct_24h < -1 ? 'SELL' : a.change_pct_24h > 0 ? 'HOLD' : 'WATCH',
    risk:   Math.abs(a.change_pct_24h) > 2 ? 'HIGH' : Math.abs(a.change_pct_24h) > 0.8 ? 'MED' : 'LOW',
  }))
}

export default function WatchlistTable({ data, impacts }: WatchlistTableProps) {
  const rows = buildRows(data)

  const getImpact = (symbol: string) =>
    impacts?.find((i) => i.asset.toLowerCase() === symbol.toLowerCase())

  return (
    <div className="t-card">
      <div className="panel-header -mx-4 -mt-4 mb-0 px-4">
        <span className="panel-title">Watchlist</span>
        <span className="text-2xs text-slate-600">{rows.length} varlık</span>
      </div>

      <div className="overflow-x-auto">
        <table className="t-table">
          <thead>
            <tr>
              <th>Sembol</th>
              <th>Fiyat</th>
              <th>24s %</th>
              <th className="hidden sm:table-cell">Grafik</th>
              <th>Sinyal</th>
              <th>Risk</th>
              <th className="hidden md:table-cell">AI Etki</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pos    = row.pct >= 0
              const sig    = SIGNAL_STYLE[row.signal] ?? SIGNAL_STYLE.WATCH
              const risk   = RISK_STYLE[row.risk] ?? RISK_STYLE.MED
              const impact = getImpact(row.symbol)
              return (
                <tr key={row.symbol} className="cursor-default">
                  <td>
                    <div>
                      <p className="font-semibold text-white">{row.symbol}</p>
                      <p className="text-2xs text-slate-600 truncate max-w-[80px]">{row.name}</p>
                    </div>
                  </td>
                  <td>
                    <span className="font-mono text-white">
                      {row.price.toLocaleString('tr-TR', { maximumFractionDigits: row.price < 100 ? 2 : 0 })}
                    </span>
                  </td>
                  <td>
                    <span className={`font-mono font-semibold ${pos ? 'text-bull' : 'text-bear'}`}>
                      {pos ? '+' : ''}{row.pct.toFixed(2)}%
                    </span>
                  </td>
                  <td className="hidden sm:table-cell">
                    <MiniSpark price={row.price} pct={row.pct} />
                  </td>
                  <td><span className={sig.cls}>{sig.label}</span></td>
                  <td><span className={risk.cls}>{risk.label}</span></td>
                  <td className="hidden md:table-cell">
                    {impact ? (
                      <span className={
                        impact.direction === 'positive' ? 'text-bull' :
                        impact.direction === 'negative' ? 'text-bear' : 'text-slate-500'
                      }>
                        {impact.direction === 'positive' ? '↑' : impact.direction === 'negative' ? '↓' : '→'}
                        {' '}{impact.confidence}
                      </span>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-2xs text-slate-700 mt-3 px-1">
        ⚠ Sinyaller simülasyon amaçlıdır. Yatırım tavsiyesi değildir.
      </p>
    </div>
  )
}
