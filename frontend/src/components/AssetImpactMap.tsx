import type { AssetImpact } from '../types'

const DIRECTION_CONFIG = {
  positive: { label: 'Pozitif', cls: 'badge-positive', icon: '↑' },
  negative: { label: 'Negatif', cls: 'badge-negative', icon: '↓' },
  neutral: { label: 'Nötr', cls: 'badge-neutral', icon: '→' },
}

const CONFIDENCE_LABELS = {
  low: 'Düşük güven',
  medium: 'Orta güven',
  high: 'Yüksek güven',
}

interface AssetImpactMapProps {
  impacts: AssetImpact[]
}

export default function AssetImpactMap({ impacts }: AssetImpactMapProps) {
  if (impacts.length === 0) return null

  return (
    <section>
      <h2 className="section-title">
        <span className="text-2xl">🗺</span>
        Varlık Etki Haritası
      </h2>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {impacts.map((impact, i) => {
          const dir = DIRECTION_CONFIG[impact.direction]
          return (
            <div key={i} className="card-hover space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">{impact.asset}</span>
                <span className={dir.cls}>
                  {dir.icon} {dir.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{impact.reason}</p>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{CONFIDENCE_LABELS[impact.confidence]}</span>
                {impact.signal_sources.length > 0 && (
                  <span>{impact.signal_sources.length} sinyal kaynağı</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
