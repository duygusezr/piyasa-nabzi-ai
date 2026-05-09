interface ActionPlanProps {
  items: string[]
  riskLevel: 'low' | 'medium' | 'high'
  summary: string
  warning: string
}

export default function ActionPlan({ items, riskLevel, summary, warning }: ActionPlanProps) {
  if (!items || items.length === 0) return null

  const riskColor = riskLevel === 'high' ? '#ff3e5e' : riskLevel === 'medium' ? '#f5a623' : '#00d97e'
  const riskLabel = riskLevel === 'high' ? 'Yüksek Risk' : riskLevel === 'medium' ? 'Orta Risk' : 'Düşük Risk'
  const riskBg    = riskLevel === 'high' ? '#ff3e5e18' : riskLevel === 'medium' ? '#f5a62318' : '#00d97e18'

  return (
    <div
      className="t-card animate-fade-in"
      style={{ borderLeft: `3px solid ${riskColor}` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">Ne Yapmalıyım?</h3>
          <p className="text-2xs text-slate-500 mt-0.5">AI analizine göre önerilen adımlar</p>
        </div>
        <span
          className="text-2xs font-bold px-2 py-1 rounded"
          style={{ background: riskBg, color: riskColor, border: `1px solid ${riskColor}40` }}
        >
          {riskLabel}
        </span>
      </div>

      {/* Özet */}
      <p
        className="text-xs text-slate-300 mb-4 leading-relaxed p-3 rounded-md"
        style={{ background: '#0c1320' }}
      >
        {summary}
      </p>

      {/* Adımlar */}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-md"
            style={{ background: '#0c1320', border: '1px solid #1a2535' }}
          >
            <span
              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold mt-0.5"
              style={{ background: riskBg, color: riskColor }}
            >
              {i + 1}
            </span>
            <p className="text-xs text-slate-200 leading-relaxed">{item}</p>
          </div>
        ))}
      </div>

      {/* Yasal uyarı */}
      <div className="mt-4 pt-3" style={{ borderTop: '1px solid #1a2535' }}>
        <p className="text-2xs text-slate-600 leading-relaxed">⚠ {warning}</p>
      </div>
    </div>
  )
}
