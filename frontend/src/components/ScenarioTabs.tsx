import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { SimulationPortfolio, Scenario } from '../types'

const PIE_COLORS = ['#06d6f0', '#8b5cf6', '#00d97e', '#f5a623', '#ff3e5e', '#60a5fa', '#34d399']

const TABS = [
  { key: 'protective' as const, label: 'Koruyucu', icon: '◉', accent: '#00d97e' },
  { key: 'balanced'   as const, label: 'Dengeli',  icon: '◈', accent: '#06d6f0' },
  { key: 'aggressive' as const, label: 'Agresif',  icon: '◆', accent: '#ff3e5e' },
]
type TabKey = (typeof TABS)[number]['key']

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-2xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-mono font-semibold" style={{ color }}>{value.toFixed(1)}/10</span>
      </div>
      <div className="score-track">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value * 10}%`, background: color }} />
      </div>
    </div>
  )
}

function ScenarioView({ scenario, accent }: { scenario: Scenario; accent: string }) {
  const pieData = scenario.allocation.map((a) => ({ name: a.asset, value: a.percentage }))

  return (
    <div className="grid md:grid-cols-2 gap-5 animate-fade-in">
      {/* Left: pie + allocation */}
      <div>
        <p className="text-2xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Portföy Dağılımı</p>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip
                formatter={(v: number) => [`%${v}`, '']}
                contentStyle={{ background: '#0f1929', border: '1px solid #1a2535', borderRadius: 6, fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="flex-1 space-y-1.5">
            {scenario.allocation.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-2xs text-slate-300 flex-1 truncate">{a.asset}</span>
                <span className="text-2xs font-mono font-semibold text-white shrink-0">%{a.percentage}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rationale */}
        <div className="mt-4 space-y-1.5">
          {scenario.allocation.map((a, i) => (
            <div key={i} className="flex gap-2 text-2xs">
              <span style={{ color: PIE_COLORS[i % PIE_COLORS.length] }} className="shrink-0 mt-0.5">▸</span>
              <span className="text-slate-500">{a.rationale}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: scores + explanation + warnings */}
      <div className="space-y-4">
        {/* Scores */}
        <div className="space-y-2.5">
          <ScoreBar label="Risk Skoru"  value={scenario.risk_score}        color="#ff3e5e" />
          <ScoreBar label="Fırsat"       value={scenario.opportunity_score} color={accent} />
          <ScoreBar label="Volatilite"   value={scenario.volatility_score}  color="#f5a623" />
        </div>

        {/* Explanation */}
        <div className="rounded-md p-3 text-2xs space-y-1.5" style={{ background: '#0c1320', border: '1px solid #1a2535' }}>
          <p className="font-semibold uppercase tracking-wider text-slate-500">Beklenen Davranış</p>
          <p className="text-slate-300 leading-relaxed">{scenario.expected_behavior}</p>
          <p className="text-slate-500 leading-relaxed">{scenario.explanation}</p>
        </div>

        {/* Warnings */}
        {scenario.warnings.length > 0 && (
          <div className="space-y-1.5">
            {scenario.warnings.map((w, i) => (
              <div key={i} className="flex gap-2 text-2xs rounded px-2.5 py-1.5" style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)' }}>
                <span className="text-warn shrink-0">⚠</span>
                <span className="text-warn/80">{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface ScenarioTabsProps {
  portfolio: SimulationPortfolio | null | undefined
  isLoading?: boolean
}

export default function ScenarioTabs({ portfolio, isLoading }: ScenarioTabsProps) {
  const [active, setActive] = useState<TabKey>('balanced')

  const scenarioMap: Record<TabKey, Scenario | undefined> = portfolio
    ? { protective: portfolio.protective_portfolio, balanced: portfolio.balanced_portfolio, aggressive: portfolio.aggressive_portfolio }
    : { protective: undefined, balanced: undefined, aggressive: undefined }

  const activeTab = TABS.find((t) => t.key === active)!

  return (
    <div className="t-card">
      <div className="panel-header -mx-4 -mt-4 mb-4 px-4">
        <span className="panel-title">Senaryo Simülasyonu</span>
        {portfolio && (
          <span className="text-2xs text-slate-600 font-mono">
            {portfolio.initial_capital.toLocaleString('tr-TR')} {portfolio.currency} sanal bakiye
          </span>
        )}
      </div>

      {isLoading && (
        <div className="animate-pulse space-y-4 py-4">
          <div className="h-3 bg-t-muted rounded w-1/3" />
          <div className="h-36 bg-t-muted rounded" />
        </div>
      )}

      {!isLoading && portfolio && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: '#080e1c' }}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActive(tab.key)}
                className="flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5"
                style={active === tab.key
                  ? { background: '#0f1929', color: tab.accent, border: `1px solid ${tab.accent}40` }
                  : { color: '#475569', border: '1px solid transparent' }}
              >
                <span style={active === tab.key ? { color: tab.accent } : {}}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {scenarioMap[active] && (
            <ScenarioView scenario={scenarioMap[active]!} accent={activeTab.accent} />
          )}
        </>
      )}

      {!isLoading && !portfolio && (
        <div className="text-center py-8 text-slate-600 text-xs">
          Senaryo bekleniyor — analiz başlatıldığında oluşturulacak.
        </div>
      )}

      {!isLoading && portfolio && (
        <p className="text-2xs text-slate-700 mt-4 pt-3" style={{ borderTop: '1px solid #1a2535' }}>
          Simülasyon amaçlıdır. Yatırım tavsiyesi değildir.
        </p>
      )}
    </div>
  )
}
