import { useState } from 'react'

const EXAMPLES = [
  '100 TL param var, 5 gün içinde Bitcoin, altın ve ASELSAN arasında nasıl bir yol izleyebilirim?',
  '500 TL ile 2 haftalık kısa vadeli senaryo — altın ve BIST hisselerine bakıyorum.',
  '1000 TL sermayem var, 1 ay boyunca güvenli bir strateji arıyorum.',
  '200 dolar bütçeyle kripto ve altın arasında dengeli bir plan istiyorum.',
]

interface GoalInputProps {
  onAnalyze: (msg: string) => void
  isLoading: boolean
  onClose?: () => void
}

export default function GoalInput({ onAnalyze, isLoading, onClose }: GoalInputProps) {
  const [msg, setMsg] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (msg.trim() && !isLoading) onAnalyze(msg.trim())
  }

  return (
    <div className="t-card animate-fade-in">
      <div className="panel-header -mx-4 -mt-4 mb-4 px-4">
        <div className="flex items-center gap-2">
          <span style={{ color: '#06d6f0' }}>✦</span>
          <span className="panel-title">AI Analiz Terminali</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors text-sm leading-none">✕</button>
        )}
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="relative">
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder={"Finansal hedefini, sermayeni ve ilgilendiğin varlıkları yaz…\nÖrn: 500 TL param var, 7 günde altın ve Bitcoin arasında ne yapabilirim?"}
            rows={3}
            disabled={isLoading}
            maxLength={2000}
            className="t-input resize-none text-sm"
          />
          <span className="absolute bottom-2 right-2 text-2xs text-slate-700 font-mono pointer-events-none">
            {msg.length}/2000
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-2xs text-slate-600">Hızlı:</span>
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              type="button"
              disabled={isLoading}
              onClick={() => setMsg(ex)}
              className="t-btn-ghost"
            >
              Örnek {i + 1}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-2xs text-slate-600">
            ⚠ Yatırım tavsiyesi değildir — simülasyon amaçlıdır.
          </p>
          <button
            type="submit"
            disabled={!msg.trim() || isLoading}
            className="t-btn-primary flex items-center gap-2 shrink-0"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Analiz Ediliyor
              </>
            ) : '✦ Analiz Et'}
          </button>
        </div>
      </form>
    </div>
  )
}
