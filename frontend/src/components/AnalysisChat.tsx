import { useState } from 'react'
import type { FullAnalysisResponse, AssistantAnalysis, AssistantScenario } from '../types'

const EXAMPLES = [
  'Dolar yükselirse ne yapmalıyım?',
  '5000 TL ile 30 günde güvenli bir senaryo ne olur?',
  'ASELSAN, THY ve Bitcoin arasında nasıl bir dağılım yapabilirim?',
  'Orta Doğu gerilimleri piyasayı nasıl etkiler?',
]

const RISK_COLOR: Record<string, string> = {
  'düşük': '#00d97e', 'low': '#00d97e',
  'orta': '#f5a623', 'medium': '#f5a623',
  'orta-yüksek': '#f5a623', 'orta-düşük': '#f5a623',
  'yüksek': '#ff3e5e', 'high': '#ff3e5e',
}
const riskColor = (r?: string) => RISK_COLOR[(r ?? '').toLowerCase()] ?? '#94a3b8'

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 rounded-full" style={{ background: '#1a2535' }}>
        <div className="h-1 rounded-full" style={{ width: `${(value / 10) * 100}%`, background: color }} />
      </div>
      <span className="text-2xs text-slate-500 w-4 text-right">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-2xs font-bold text-accent-cyan uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  )
}

function ScenarioCard({ s }: { s: AssistantScenario }) {
  const isProtective = s.name.includes('Koruyucu')
  const isAggressive = s.name.includes('Agresif')
  const borderColor = isProtective ? '#00d97e' : isAggressive ? '#ff3e5e' : '#06d6f0'

  return (
    <div className="rounded-lg p-4 space-y-3" style={{ background: '#0c1320', border: `1px solid #1a2535`, borderLeft: `3px solid ${borderColor}` }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white">{s.name}</span>
      </div>

      {/* Dağılım */}
      <div className="space-y-1">
        {s.allocation.map((a) => (
          <div key={a.asset} className="flex items-center justify-between">
            <span className="text-2xs text-slate-400">{a.asset}</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1 rounded-full" style={{ background: '#1a2535' }}>
                <div className="h-1 rounded-full" style={{ width: `${a.percent}%`, background: borderColor }} />
              </div>
              <span className="text-2xs font-mono text-slate-300 w-8 text-right">%{a.percent}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-2xs text-slate-500 leading-relaxed">{s.logic}</p>

      {/* Skorlar */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div>
          <p className="text-2xs text-slate-600 mb-1">Risk</p>
          <ScoreBar value={s.riskScore} color="#ff3e5e" />
        </div>
        <div>
          <p className="text-2xs text-slate-600 mb-1">Fırsat</p>
          <ScoreBar value={s.opportunityScore} color="#00d97e" />
        </div>
        <div>
          <p className="text-2xs text-slate-600 mb-1">Volatilite</p>
          <ScoreBar value={s.volatilityScore} color="#f5a623" />
        </div>
      </div>
    </div>
  )
}

function AssistantResponse({ a }: { a: AssistantAnalysis }) {
  return (
    <div className="space-y-5 animate-fade-in">

      {/* Kısa Cevap */}
      <div className="p-4 rounded-lg" style={{ background: '#0f1929', border: '1px solid #06d6f030' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #06d6f0, #8b5cf6)', color: '#070c15' }}>
            AI
          </span>
          <span className="text-xs font-semibold text-accent-cyan">AI Finansal Asistan</span>
        </div>
        <p className="text-sm text-slate-200 leading-relaxed">{a.directAnswer}</p>
      </div>

      {/* Piyasa Bağlamı */}
      {a.marketContext && (
        <Section title="Piyasa Bağlamı">
          <p className="text-xs text-slate-400 leading-relaxed p-3 rounded-md" style={{ background: '#0c1320' }}>
            {a.marketContext}
          </p>
        </Section>
      )}

      {/* Etkilenebilecek Varlıklar */}
      {a.affectedAssets.length > 0 && (
        <Section title="Etkilenebilecek Varlıklar">
          <div className="space-y-2">
            {a.affectedAssets.map((asset, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-md" style={{ background: '#0c1320', border: '1px solid #1a2535' }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-white">{asset.asset}</span>
                    <span className="text-2xs px-1.5 py-0.5 rounded font-medium"
                      style={{ background: `${riskColor(asset.riskLevel)}18`, color: riskColor(asset.riskLevel) }}>
                      {asset.riskLevel}
                    </span>
                  </div>
                  <p className="text-2xs text-slate-300 leading-relaxed">{asset.possibleEffect}</p>
                  <p className="text-2xs text-slate-600 mt-0.5">{asset.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Ne Yapılabilir */}
      {a.actionableOptions.length > 0 && (
        <Section title="Ne Yapılabilir?">
          <div className="space-y-2">
            {a.actionableOptions.map((opt, i) => (
              <div key={i} className="p-3 rounded-md" style={{ background: '#0c1320', border: '1px solid #1a2535' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-white">{opt.title}</span>
                  <span className="text-2xs px-1.5 py-0.5 rounded"
                    style={{ background: `${riskColor(opt.risk)}18`, color: riskColor(opt.risk) }}>
                    {opt.risk} risk
                  </span>
                </div>
                <p className="text-2xs text-slate-300 leading-relaxed">{opt.description}</p>
                <p className="text-2xs text-slate-600 mt-1">Ne zaman: {opt.whenUseful}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Senaryo Simülasyonu */}
      {a.scenarios.length > 0 && (
        <Section title="Senaryo Simülasyonu">
          <div className="grid sm:grid-cols-3 gap-3">
            {a.scenarios.map((s, i) => <ScenarioCard key={i} s={s} />)}
          </div>
        </Section>
      )}

      {/* Takip Edilecek Göstergeler + Senaryo Bozulması + Riskler — yan yana */}
      <div className="grid sm:grid-cols-3 gap-4">
        {a.whatToWatch.length > 0 && (
          <Section title="Takip Edilecek">
            <ul className="space-y-1">
              {a.whatToWatch.map((w, i) => (
                <li key={i} className="text-2xs text-slate-400 flex items-start gap-1.5">
                  <span className="text-accent-cyan mt-0.5 shrink-0">·</span>{w}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {a.scenarioInvalidation.length > 0 && (
          <Section title="Senaryo Ne Zaman Bozulur?">
            <ul className="space-y-1">
              {a.scenarioInvalidation.map((item, i) => (
                <li key={i} className="text-2xs text-slate-400 flex items-start gap-1.5">
                  <span className="text-bear mt-0.5 shrink-0">·</span>{item}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {a.risks.length > 0 && (
          <Section title="Riskler">
            <ul className="space-y-1">
              {a.risks.map((r, i) => (
                <li key={i} className="text-2xs text-slate-400 flex items-start gap-1.5">
                  <span style={{ color: '#f5a623' }} className="mt-0.5 shrink-0">·</span>{r}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {/* Sonuç */}
      {a.conclusion && (
        <div className="p-3 rounded-md" style={{ background: '#0c1320', border: '1px solid #1a2535' }}>
          <p className="text-xs text-slate-300 leading-relaxed">{a.conclusion}</p>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-2xs text-slate-700">{a.disclaimer}</p>
    </div>
  )
}

interface AnalysisChatProps {
  onAnalyze: (msg: string) => void
  isLoading: boolean
  loadingStep?: string
  data: FullAnalysisResponse | null
  error?: string
  onDismissError?: () => void
}

export default function AnalysisChat({
  onAnalyze,
  isLoading,
  loadingStep,
  data,
  error,
  onDismissError,
}: AnalysisChatProps) {
  const [input, setInput] = useState('')

  const submit = () => {
    const msg = input.trim()
    if (!msg || isLoading) return
    onAnalyze(msg)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Başlık */}
      <div>
        <h2 className="text-base font-bold text-white">AI Finansal Asistan</h2>
        <p className="text-2xs text-slate-500 mt-0.5">
          Piyasa verilerini analiz eder, senaryolar üretir — yatırım tavsiyesi vermez
        </p>
      </div>

      {/* Input */}
      <div className="rounded-lg p-1" style={{ background: '#0f1929', border: '1px solid #1a2535' }}>
        <textarea
          className="w-full bg-transparent text-sm text-white placeholder-slate-600 resize-none outline-none p-3"
          rows={3}
          placeholder="Ne öğrenmek istiyorsunuz? Örn: Dolar yükselirse portföyüm nasıl etkilenir?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
          }}
          disabled={isLoading}
        />
        <div className="flex items-center justify-between px-3 pb-2">
          <span className="text-2xs text-slate-700">Enter ile gönder · Shift+Enter yeni satır</span>
          <button
            onClick={submit}
            disabled={!input.trim() || isLoading}
            className="t-btn-primary text-xs px-4 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Analiz ediliyor…' : 'Analiz Et →'}
          </button>
        </div>
      </div>

      {/* Örnek sorular */}
      {!data && !isLoading && (
        <div>
          <p className="text-2xs text-slate-600 mb-2">Örnek sorular:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => setInput(ex)}
                className="text-2xs px-3 py-1.5 rounded-full transition-colors"
                style={{ background: '#0f1929', border: '1px solid #1a2535', color: '#64748b' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#06d6f0')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1a2535')}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hata */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg animate-fade-in"
          style={{ background: '#ff3e5e12', border: '1px solid #ff3e5e40' }}>
          <span className="text-bear text-sm shrink-0">!</span>
          <p className="text-xs text-slate-300 flex-1">{error}</p>
          {onDismissError && (
            <button onClick={onDismissError} className="text-slate-600 hover:text-slate-300 text-sm">✕</button>
          )}
        </div>
      )}

      {/* Yükleniyor */}
      {isLoading && (
        <div className="p-5 rounded-lg animate-fade-in" style={{ background: '#0f1929', border: '1px solid #1a2535' }}>
          <div className="flex items-center gap-2 mb-3">
            <svg className="animate-spin w-4 h-4 text-accent-cyan shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-sm text-accent-cyan font-semibold">
              {loadingStep || 'Analiz yapılıyor…'}
            </span>
          </div>
          <div className="space-y-1.5 text-2xs">
            {[
              { label: 'Piyasa verileri çekiliyor',            done: loadingStep?.includes('Haber') || loadingStep?.includes('AI') },
              { label: 'Haberler ve sinyaller analiz ediliyor', done: loadingStep?.includes('AI') },
              { label: 'AI finansal analiz üretiliyor',         done: false },
            ].map(({ label, done }) => (
              <p key={label} className={done ? 'text-slate-500 line-through' : 'text-slate-600'}>
                {done ? '✓' : '✦'} {label}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Yapılandırılmış AI Yanıtı */}
      {data?.assistant_analysis && (
        <AssistantResponse a={data.assistant_analysis} />
      )}

    </div>
  )
}
