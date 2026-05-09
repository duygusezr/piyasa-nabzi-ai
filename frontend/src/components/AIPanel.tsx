import type { FullAnalysisResponse } from '../types'

function ScoreGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.min(100, (value / 10) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-2xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>{value.toFixed(1)}</span>
      </div>
      <div className="score-track">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

interface SentimentDonutProps { score: number }
function SentimentDonut({ score }: SentimentDonutProps) {
  const r = 28, cx = 36, cy = 36
  const circ = 2 * Math.PI * r
  const pct  = score / 10
  const dash = circ * pct
  const color = score >= 7 ? '#ff3e5e' : score >= 4 ? '#f5a623' : '#00d97e'
  const label = score >= 7 ? 'RİSKLİ' : score >= 4 ? 'ORTA' : 'GÜVENLİ'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={72} height={72} className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a2535" strokeWidth={6} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="text-center -mt-1">
        <p className="text-sm font-bold font-mono text-white">{score.toFixed(1)}</p>
        <p className="text-2xs font-semibold" style={{ color }}>{label}</p>
      </div>
    </div>
  )
}

interface AIPanelProps {
  data: FullAnalysisResponse | null
  isLoading: boolean
}

const SKELETON_SIGNALS = ['Analiz bekleniyor…', 'Veri yükleniyor…', 'Sistem hazır']

export default function AIPanel({ data, isLoading }: AIPanelProps) {
  const goal     = data?.goal_analysis
  const sim      = data?.simulation
  const balanced = sim?.balanced_portfolio
  const impacts  = data?.asset_impact_map ?? []

  const overallRisk = balanced?.risk_score ?? (isLoading ? 0 : 5)
  const oppScore    = balanced?.opportunity_score ?? (isLoading ? 0 : 5)
  const volScore    = balanced?.volatility_score  ?? (isLoading ? 0 : 5)

  return (
    <div className="flex flex-col gap-3" style={{ width: 260, flexShrink: 0 }}>

      {/* Sentiment gauge */}
      <div className="t-card">
        <div className="panel-header -mx-4 -mt-4 mb-3 px-4">
          <span className="panel-title">Piyasa Duyarlılığı</span>
          <span className="text-2xs text-accent-cyan">AI</span>
        </div>

        <div className="flex items-center gap-3">
          <SentimentDonut score={overallRisk} />
          <div className="flex-1 space-y-2.5">
            <ScoreGauge value={overallRisk} label="Risk"       color="#ff3e5e" />
            <ScoreGauge value={oppScore}    label="Fırsat"     color="#06d6f0" />
            <ScoreGauge value={volScore}    label="Volatilite" color="#f5a623" />
          </div>
        </div>
      </div>

      {/* Goal summary */}
      {goal && (
        <div className="t-card animate-fade-in">
          <div className="panel-header -mx-4 -mt-4 mb-3 px-4">
            <span className="panel-title">Hedef Analizi</span>
            <span className={`badge-${goal.risk_level === 'high' ? 'bear' : goal.risk_level === 'medium' ? 'warn' : 'bull'} text-2xs`}>
              {goal.risk_level.toUpperCase()}
            </span>
          </div>
          <p className="text-2xs text-slate-400 leading-relaxed">{goal.summary}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {goal.parsed_goal.assets.map((a) => (
              <span key={a} className="badge-info text-2xs">{a}</span>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-t-border grid grid-cols-2 gap-1 text-2xs">
            <span className="text-slate-600">Sermaye</span>
            <span className="font-mono text-white text-right">
              {goal.parsed_goal.capital.toLocaleString('tr-TR')} {goal.parsed_goal.capital_currency}
            </span>
            <span className="text-slate-600">Süre</span>
            <span className="font-mono text-white text-right">{goal.parsed_goal.duration_days} gün</span>
          </div>
        </div>
      )}

      {/* Asset impact signals */}
      <div className="t-card">
        <div className="panel-header -mx-4 -mt-4 mb-3 px-4">
          <span className="panel-title">Varlık Sinyalleri</span>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {SKELETON_SIGNALS.map((s, i) => (
              <div key={i} className="flex items-center gap-2 animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-t-muted" />
                <div className="h-2.5 bg-t-muted rounded flex-1" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && impacts.length > 0 && (
          <div className="space-y-1.5">
            {impacts.slice(0, 6).map((imp, i) => {
              const col = imp.direction === 'positive' ? '#00d97e' : imp.direction === 'negative' ? '#ff3e5e' : '#475569'
              const arrow = imp.direction === 'positive' ? '▲' : imp.direction === 'negative' ? '▼' : '→'
              return (
                <div key={i} className="flex items-center justify-between gap-2 py-1 border-b border-t-border/50 last:border-0">
                  <span className="text-2xs text-slate-300 font-medium">{imp.asset}</span>
                  <span className="text-2xs font-bold font-mono" style={{ color: col }}>{arrow}</span>
                  <span className="text-2xs text-slate-600 flex-1 text-right truncate">{imp.confidence}</span>
                </div>
              )
            })}
          </div>
        )}

        {!isLoading && impacts.length === 0 && (
          <p className="text-2xs text-slate-600 text-center py-3">Analiz başlatıldığında görünecek</p>
        )}
      </div>

      {/* Geopolitical risk */}
      <div className="t-card">
        <div className="panel-header -mx-4 -mt-4 mb-3 px-4">
          <span className="panel-title">Jeopolitik Risk</span>
        </div>
        <div className="space-y-1.5">
          {[
            { label: 'Orta Doğu',    score: 7.2, color: '#ff3e5e' },
            { label: 'ABD Faiz',     score: 5.8, color: '#f5a623' },
            { label: 'Enflasyon TR', score: 8.1, color: '#ff3e5e' },
            { label: 'Enerji',       score: 4.5, color: '#f5a623' },
            { label: 'Kripto Reg.',  score: 3.2, color: '#00d97e' },
          ].map((item) => (
            <ScoreGauge key={item.label} value={item.score} label={item.label} color={item.color} />
          ))}
        </div>
        <p className="text-2xs text-slate-600 mt-3">⚠ Simülasyon verisi</p>
      </div>
    </div>
  )
}
