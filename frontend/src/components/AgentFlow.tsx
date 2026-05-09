interface AgentFlowProps {
  steps: string[]
  currentStep?: number
  isRunning?: boolean
}

const DEFAULT_STEPS = [
  'Kullanıcı Hedefi', 'Piyasa Verisi', 'Haber Analizi',
  'Varlık Etkisi', 'Senaryo Üretimi', 'Uyum Kontrolü', 'Simülasyon',
]

export default function AgentFlow({ steps, currentStep, isRunning }: AgentFlowProps) {
  const displaySteps = steps.length > 0 ? steps : DEFAULT_STEPS

  return (
    <div className="t-card-md animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="panel-title">Agent Pipeline</span>
        {!isRunning && steps.length > 0 && (
          <span className="badge-bull">✓ Tamamlandı</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {displaySteps.map((step, i) => {
          const done   = steps.length > 0
          const active = isRunning && i === (currentStep ?? 0)
          return (
            <div key={i} className="flex items-center gap-1">
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded text-2xs font-medium transition-all duration-300"
                style={{
                  background: active ? 'rgba(6,214,240,0.12)' : done ? 'rgba(0,217,126,0.08)' : '#0c1320',
                  border: `1px solid ${active ? 'rgba(6,214,240,0.4)' : done ? 'rgba(0,217,126,0.25)' : '#1a2535'}`,
                  color: active ? '#06d6f0' : done ? '#00d97e' : '#475569',
                }}
              >
                <span className="font-mono">{done && !active ? '✓' : String(i + 1).padStart(2, '0')}</span>
                <span className="hidden sm:inline">{step}</span>
              </div>
              {i < displaySteps.length - 1 && (
                <span className="text-slate-700 text-2xs">→</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
