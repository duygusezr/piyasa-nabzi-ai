import type { NewsSignal, RiskLevel } from '../types'

const RISK_CFG: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  low:    { label: 'Düşük Risk',  color: '#00d97e', bg: '#00d97e15' },
  medium: { label: 'Orta Risk',   color: '#f5a623', bg: '#f5a62315' },
  high:   { label: 'Yüksek Risk', color: '#ff3e5e', bg: '#ff3e5e15' },
}

const IMPACT_CFG: Record<string, { icon: string; label: string; color: string }> = {
  'pozitif': { icon: '↑', label: 'Pozitif Etki',  color: '#00d97e' },
  'negatif': { icon: '↓', label: 'Negatif Etki',  color: '#ff3e5e' },
  'karışık': { icon: '↕', label: 'Karışık Etki',  color: '#f5a623' },
  'nötr':    { icon: '→', label: 'Nötr',           color: '#475569' },
}

const CONF_LABEL: Record<string, string> = {
  low: 'Düşük', medium: 'Orta', high: 'Yüksek',
}

function NewsCard({ s }: { s: NewsSignal }) {
  const risk      = RISK_CFG[s.risk_level] ?? RISK_CFG.medium
  const impact    = IMPACT_CFG[s.impact_direction ?? 'nötr'] ?? IMPACT_CFG['nötr']
  const confLabel = CONF_LABEL[s.confidence ?? 'medium'] ?? 'Orta'

  // title / summary zaten Türkçe gelir (backend DeepL → tr_title öncelikli)
  // tr_title ayrıca dolu gelirse onu, yoksa ana title'ı kullan (garanti fallback)
  const displayTitle   = s.tr_title || s.title
  const displaySummary = s.tr_summary || s.summary

  return (
    <div
      className="flex flex-col gap-3 rounded-lg p-4 hover:border-slate-500 transition-all duration-150 animate-fade-in"
      style={{ background: '#0f1929', border: `1px solid #1a2535`, borderLeft: `3px solid ${risk.color}` }}
    >
      {/* Üst satır: risk + etki yönü */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-2xs font-bold px-2 py-0.5 rounded"
          style={{ background: risk.bg, color: risk.color }}
        >
          {risk.label}
        </span>
        <span
          className="text-2xs font-bold px-2 py-0.5 rounded flex items-center gap-1"
          style={{ background: `${impact.color}15`, color: impact.color }}
        >
          <span>{impact.icon}</span>
          <span>{impact.label}</span>
        </span>
      </div>

      {/* Başlık */}
      <h3 className="text-xs font-semibold text-white leading-snug">{displayTitle}</h3>

      {/* Özet */}
      {displaySummary && displaySummary !== displayTitle && (
        <p className="text-2xs text-slate-400 leading-relaxed">{displaySummary}</p>
      )}

      {/* AI Finansal Asistan Yorumu — sadece yorum varsa göster */}
      {s.gemini_comment && (
        <div
          className="rounded-md p-3 space-y-1"
          style={{ background: '#0c1320', border: '1px solid #1a2535' }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <span
              className="flex items-center justify-center w-4 h-4 rounded-full text-2xs font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg,#06d6f0,#8b5cf6)', color: '#070c15' }}
            >
              AI
            </span>
            <span className="text-2xs font-semibold text-accent-cyan">AI Finansal Asistan Yorumu</span>
          </div>
          <p className="text-2xs text-slate-300 leading-relaxed">{s.gemini_comment}</p>
        </div>
      )}

      {/* Etkilenen varlıklar */}
      {s.affected_assets.length > 0 && (
        <div>
          <p className="text-2xs text-slate-600 mb-1">Etkilenebilecek Varlıklar</p>
          <div className="flex flex-wrap gap-1">
            {s.affected_assets.map((a) => (
              <span
                key={a}
                className="text-2xs px-2 py-0.5 rounded"
                style={{ background: '#1a2535', color: '#94a3b8' }}
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Alt satır: kaynak + güven + zaman + link */}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid #1a2535' }}>
        <div className="flex items-center gap-2 text-2xs text-slate-600">
          <span>{s.source}</span>
          <span>·</span>
          <span>{new Date(s.published_at).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xs text-slate-600">Güven: <span className="text-slate-400">{confLabel}</span></span>
          {s.url && (
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-2xs text-accent-cyan hover:underline"
            >
              ↗
            </a>
          )}
        </div>
      </div>

      {/* Yasal not */}
      <p className="text-2xs text-slate-700">Yatırım tavsiyesi değildir.</p>
    </div>
  )
}

interface NewsSignalsProps {
  signals: NewsSignal[]
  isLoading?: boolean
}

export default function NewsSignals({ signals, isLoading }: NewsSignalsProps) {
  return (
    <div className="t-card">
      <div className="panel-header -mx-4 -mt-4 mb-4 px-4">
        <span className="panel-title">Güncel Haberler</span>
        {signals.length > 0 && (
          <span className="text-2xs text-slate-600">{signals.length} haber · DeepL + AI analizi</span>
        )}
      </div>

      {isLoading && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg p-4 animate-pulse space-y-3" style={{ background: '#0f1929', border: '1px solid #1a2535' }}>
              <div className="flex gap-2">
                <div className="h-4 w-16 bg-t-muted rounded" />
                <div className="h-4 w-20 bg-t-muted rounded" />
              </div>
              <div className="h-3 bg-t-muted rounded w-full" />
              <div className="h-3 bg-t-muted rounded w-4/5" />
              <div className="h-12 bg-t-muted rounded" />
              <div className="flex gap-1">
                <div className="h-4 w-12 bg-t-muted rounded" />
                <div className="h-4 w-10 bg-t-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && signals.length > 0 && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {signals.map((s) => <NewsCard key={s.id} s={s} />)}
        </div>
      )}

      {!isLoading && signals.length === 0 && (
        <div className="text-center py-8 text-slate-600 text-xs">
          Haberler yükleniyor…
        </div>
      )}
    </div>
  )
}
