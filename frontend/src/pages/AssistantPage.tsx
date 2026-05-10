import { useState } from 'react';
import { Bot, Send, AlertCircle, TrendingUp, TrendingDown, Minus, Loader } from 'lucide-react';
import { AssistantAskResponse, NewsSignal } from '../types';
import { askAssistant } from '../services/api';

const EXAMPLE_QUESTIONS = [
  'ASELSAN hakkında ne düşünüyorsunuz?',
  'Bitcoin bu hafta nasıl görünüyor?',
  'Altın almak için doğru zaman mı?',
  'BIST 100 için kısa vadeli beklentiler nedir?',
  'Dolar/TL için ne izlemeliyim?',
];

function ImpactBadge({ direction }: { direction: string }) {
  if (direction === 'pozitif') return <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded flex items-center gap-1"><TrendingUp size={10} />Pozitif</span>;
  if (direction === 'negatif') return <span className="text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded flex items-center gap-1"><TrendingDown size={10} />Negatif</span>;
  return <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded flex items-center gap-1"><Minus size={10} />Nötr</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">{title}</h3>
      {children}
    </div>
  );
}

export default function AssistantPage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AssistantAskResponse | null>(null);
  const [error, setError] = useState('');

  const handleAsk = async (q?: string) => {
    const qText = q || question;
    if (!qText.trim()) return;
    setLoading(true);
    setError('');
    setResponse(null);
    try {
      const res = await askAssistant(qText);
      setResponse(res);
      if (q) setQuestion(q);
    } catch (e: any) {
      setError('AI Asistan şu anda yanıt veremiyor. Lütfen tekrar deneyin.');
    }
    setLoading(false);
  };

  const answer = response?.answer;
  const relatedNews = response?.related_news || [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Finansal Asistan</h1>
            <p className="text-gray-400 text-sm">Piyasa, haber ve senaryo bazlı analiz</p>
          </div>
        </div>
        <div className="text-xs text-yellow-500 bg-yellow-500/10 px-3 py-2 rounded-lg border border-yellow-500/20 mt-3">
          ⚠ Bu içerik yatırım tavsiyesi değildir. AI yanıtları bilgilendirme amaçlıdır. Gerçek yatırım kararlarını bir uzmana danışarak alın.
        </div>
      </div>

      {/* Soru alanı */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <label className="text-gray-400 text-sm mb-2 block">Sorunuzu yazın</label>
        <div className="flex gap-3">
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
            placeholder="Örn: ASELSAN hakkında ne düşünüyorsunuz?"
            rows={2}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm resize-none focus:outline-none focus:border-blue-500"
          />
          <button onClick={() => handleAsk()}
            disabled={loading || !question.trim()}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors self-end">
            {loading ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>

        {/* Örnek sorular */}
        <div className="mt-3 flex gap-2 flex-wrap">
          {EXAMPLE_QUESTIONS.map(q => (
            <button key={q} onClick={() => handleAsk(q)}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Yükleniyor */}
      {loading && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
          <Loader size={32} className="animate-spin text-blue-400 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">AI Asistan analiz yapıyor...</p>
          <p className="text-gray-600 text-xs mt-1">Piyasa verisi, haberler ve senaryolar işleniyor</p>
        </div>
      )}

      {/* Hata */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-400" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Yanıt */}
      {answer && !loading && (
        <div className="space-y-4">
          {/* Kısa Cevap */}
          {answer.directAnswer && (
            <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-5">
              <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide mb-2">Kısa Cevap</p>
              <p className="text-white leading-relaxed">{answer.directAnswer}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Piyasa Bağlamı */}
            {answer.marketContext && (
              <Section title="📊 Piyasa Bağlamı">
                <p className="text-gray-300 text-sm leading-relaxed">{answer.marketContext}</p>
              </Section>
            )}

            {/* İlgili Haberler */}
            {relatedNews.length > 0 && (
              <Section title="📰 İlgili Haberler">
                <div className="space-y-2">
                  {relatedNews.map((n: NewsSignal) => (
                    <div key={n.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-gray-800 last:border-0">
                      <p className="text-gray-300 text-xs leading-tight flex-1">{n.tr_title || n.title}</p>
                      <ImpactBadge direction={n.impact_direction} />
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Etkilenebilecek Varlıklar */}
            {answer.affectedAssets.length > 0 && (
              <Section title="🎯 Etkilenebilecek Varlıklar">
                <div className="space-y-2">
                  {answer.affectedAssets.map((a, i) => (
                    <div key={i} className="bg-gray-800/50 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-white text-sm font-medium">{a.asset}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          a.riskLevel === 'yüksek' ? 'bg-red-900/50 text-red-400' :
                          a.riskLevel === 'orta' ? 'bg-yellow-900/50 text-yellow-400' :
                          'bg-green-900/50 text-green-400'
                        }`}>{a.riskLevel}</span>
                      </div>
                      <p className="text-gray-400 text-xs">{a.possibleEffect}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Ne Yapılabilir? */}
            {answer.actionableOptions.length > 0 && (
              <Section title="💡 Ne Yapılabilir?">
                <div className="space-y-2">
                  {answer.actionableOptions.map((o, i) => (
                    <div key={i} className="bg-gray-800/50 rounded-lg p-3">
                      <p className="text-white text-sm font-medium mb-1">{o.title}</p>
                      <p className="text-gray-400 text-xs leading-relaxed">{o.description}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* Olası Senaryolar */}
          {answer.scenarios.length > 0 && (
            <Section title="📈 Olası Senaryolar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {answer.scenarios.map((s, i) => (
                  <div key={i} className="bg-gray-800/50 rounded-xl p-4">
                    <p className="text-white font-semibold text-sm mb-2">{s.name}</p>
                    <div className="space-y-1 mb-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Risk</span>
                        <span className="text-white">{s.riskScore}/10</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Fırsat</span>
                        <span className="text-white">{s.opportunityScore}/10</span>
                      </div>
                    </div>
                    {s.allocation.slice(0, 3).map(a => (
                      <div key={a.asset} className="flex items-center gap-2 mb-1">
                        <div className="flex-1 bg-gray-700 rounded-full h-1">
                          <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${a.percent}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 w-24 truncate">{a.asset}</span>
                        <span className="text-xs text-gray-300 w-8 text-right">{a.percent}%</span>
                      </div>
                    ))}
                    <p className="text-gray-400 text-xs mt-2 leading-relaxed line-clamp-3">{s.logic}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Takip Edilecekler & Riskler */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {answer.whatToWatch.length > 0 && (
              <Section title="👁 Takip Edilecek Göstergeler">
                <ul className="space-y-1.5">
                  {answer.whatToWatch.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                      <span className="text-blue-400 mt-0.5">•</span>{w}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            {answer.risks.length > 0 && (
              <Section title="⚠ Riskler">
                <ul className="space-y-1.5">
                  {answer.risks.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                      <span className="text-red-400 mt-0.5">•</span>{r}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>

          {/* Sonuç */}
          {answer.conclusion && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">Sonuç</p>
              <p className="text-gray-300 text-sm leading-relaxed">{answer.conclusion}</p>
            </div>
          )}

          {/* Disclaimer */}
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 text-center">
            <p className="text-gray-500 text-xs">{answer.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
