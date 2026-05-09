import type { GoalAnalysis } from '../types'

const RISK_LABELS = {
  low: { label: 'Düşük Risk', cls: 'badge-low' },
  medium: { label: 'Orta Risk', cls: 'badge-medium' },
  high: { label: 'Yüksek Risk', cls: 'badge-high' },
}

interface GoalAnalysisCardProps {
  analysis: GoalAnalysis
}

export default function GoalAnalysisCard({ analysis }: GoalAnalysisCardProps) {
  const risk = RISK_LABELS[analysis.risk_level]

  return (
    <section>
      <h2 className="section-title">
        <span className="text-2xl">🎯</span>
        Hedef Analizi
      </h2>
      <div className="card space-y-4">
        <div className="flex flex-wrap items-start gap-3 justify-between">
          <p className="text-sm text-slate-200 font-medium flex-1">{analysis.summary}</p>
          <span className={risk.cls}>{risk.label}</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="bg-slate-800/60 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500 mb-1">Gerçekçilik Değerlendirmesi</p>
            <p className="text-sm text-slate-300">{analysis.realism}</p>
          </div>
          <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3">
            <p className="text-xs text-amber-500 mb-1">Risk Uyarısı</p>
            <p className="text-sm text-amber-200/80">{analysis.warning}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm border-t border-slate-800 pt-3">
          <div>
            <span className="text-slate-500">Sermaye: </span>
            <span className="font-semibold text-slate-200 font-mono">
              {analysis.parsed_goal.capital.toLocaleString('tr-TR')} {analysis.parsed_goal.capital_currency}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Süre: </span>
            <span className="font-semibold text-slate-200">{analysis.parsed_goal.duration_days} gün</span>
          </div>
          <div>
            <span className="text-slate-500">Risk İştahı: </span>
            <span className="font-semibold text-slate-200">{analysis.parsed_goal.risk_appetite}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-500">Varlıklar:</span>
          {analysis.parsed_goal.assets.map((a) => (
            <span
              key={a}
              className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 border border-blue-700/50 text-blue-300"
            >
              {a}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
