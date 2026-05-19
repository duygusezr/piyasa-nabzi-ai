import { useState } from 'react';
import {
  Bot, Send, AlertCircle, TrendingUp, TrendingDown, Minus, Loader,
  Wallet, Zap, ChevronDown, ChevronUp, ArrowRightLeft,
  Target, ShieldAlert, Eye, BarChart2,
} from 'lucide-react';
import { AssistantAskResponse, AssistantAnalysis, NewsSignal, WhatIfResult, PortfolioContext } from '../types';
import { askAssistant } from '../services/api';

const EXAMPLE_QUESTIONS = [
  'Bitcoin bu hafta nasıl görünüyor?',
  'Altın almak için doğru zaman mı?',
  'BIST 100 için kısa vadeli beklentiler nedir?',
  'Dolar/TL için ne izlemeliyim?',
  'Portföyümü nasıl değerlendirirsin?',
];

const WHATIF_PRESETS = [
  { label: 'BTC −10%', asset: 'BTC', change: -10 },
  { label: 'BTC +15%', asset: 'BTC', change: 15 },
  { label: 'Altın −5%', asset: 'XAU', change: -5 },
  { label: 'Altın +8%', asset: 'XAU', change: 8 },
  { label: 'USD/TL −3%', asset: 'USDTRY', change: -3 },
  { label: 'BIST −7%', asset: 'BIST100', change: -7 },
];

function ImpactBadge({ direction }: { direction: string }) {
  if (direction === 'pozitif') return <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded flex items-center gap-1"><TrendingUp size={10} />Pozitif</span>;
  if (direction === 'negatif') return <span className="text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded flex items-center gap-1"><TrendingDown size={10} />Negatif</span>;
  return <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded flex items-center gap-1"><Minus size={10} />Nötr</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <h3 className="text-white font-semibold text-sm mb-3">{title}</h3>
      {children}
    </div>
  );
}

// ── Senaryo Kartı ────────────────────────────────────────────────────────────────────────
const SCENARIO_META: Record<string, {
  accent: string; bg: string; border: string; bar: string; label: string;
}> = {
  Koruyucu: { accent: 'text-emerald-400', bg: 'bg-emerald-900/15', border: 'border-emerald-700/40', bar: 'bg-emerald-500', label: '🛡️ Koruyucu' },
  Dengeli:  { accent: 'text-amber-400',   bg: 'bg-amber-900/15',   border: 'border-amber-700/40',   bar: 'bg-amber-500',   label: '⚖️ Dengeli'  },
  Agresif:  { accent: 'text-rose-400',    bg: 'bg-rose-900/15',    border: 'border-rose-700/40',    bar: 'bg-rose-500',    label: '🚀 Agresif'  },
};

function getScenarioMeta(name: string) {
  const key = Object.keys(SCENARIO_META).find(k => name.includes(k));
  return SCENARIO_META[key ?? 'Dengeli'];
}

function ScoreBar({ label, value, barClass }: { label: string; value: number; barClass: string }) {
  const safe = Math.max(0, Math.min(10, Number(value) || 0));
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-500 text-xs w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-700/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${safe * 10}%` }} />
      </div>
      <span className="text-gray-400 text-xs w-4 text-right">{safe}</span>
    </div>
  );
}

function ScenarioCard({ s }: { s: import('../types').AssistantScenario }) {
  const meta = getScenarioMeta(s.name);
  const allocation = (s.allocation ?? []).filter(a => (a.percent ?? 0) > 0).slice(0, 5);
  const totalPct = allocation.reduce((sum, a) => sum + (a.percent ?? 0), 0);

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${meta.bg} ${meta.border}`}>
      {/* Başlık */}
      <p className={`font-bold text-sm ${meta.accent}`}>{meta.label.split(' ').slice(1).join(' ') || s.name}</p>

      {/* Skorlar */}
      <div className="space-y-1.5">
        <ScoreBar label="Risk" value={s.riskScore} barClass={meta.bar} />
        <ScoreBar label="Fırsat" value={s.opportunityScore} barClass={meta.bar} />
        <ScoreBar label="Volatilite" value={s.volatilityScore} barClass={meta.bar} />
      </div>

      {/* Dağılım */}
      {allocation.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-white/5">
          <p className="text-gray-600 text-xs uppercase tracking-wide font-medium">Dağılım</p>
          {allocation.map((a, i) => {
            const pct = a.percent ?? 0;
            const barWidth = totalPct > 0 ? (pct / totalPct) * 100 : pct;
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-gray-400 text-xs flex-1 truncate" title={a.asset}>{a.asset}</span>
                <div className="w-14 h-1.5 bg-gray-700/60 rounded-full overflow-hidden shrink-0">
                  <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${barWidth}%` }} />
                </div>
                <span className="text-gray-300 text-xs w-7 text-right shrink-0">%{pct}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Mantık */}
      {s.logic && (
        <p className="text-gray-400 text-xs leading-relaxed pt-2 border-t border-white/5">
          {s.logic}
        </p>
      )}
    </div>
  );
}

// ── Verdict Card — Net Görüş ──────────────────────────────────────────────────
function VerdictCard({ answer }: { answer: AssistantAnalysis }) {
  const { netGorus, kisaVadeBeklenti, guvenSkoru, anaSebep, portfoyEtkisi, izlenecekSeviye } = answer;
  if (!netGorus && !kisaVadeBeklenti) return null;

  const gorusLower = (netGorus || '').toLowerCase();
  const beklentiLower = (kisaVadeBeklenti || '').toLowerCase();

  const isPositive = gorusLower.includes('olumlu') && !gorusLower.includes('nötr');
  const isNegative = gorusLower.includes('olumsuz') || beklentiLower.includes('düşüş');
  const isNeutral  = !isPositive && !isNegative;

  const borderColor = isPositive ? 'border-green-700/60' : isNegative ? 'border-red-700/60' : 'border-yellow-700/50';
  const bgColor     = isPositive ? 'bg-green-900/10'    : isNegative ? 'bg-red-900/10'    : 'bg-yellow-900/10';
  const accentColor = isPositive ? 'text-green-400'     : isNegative ? 'text-red-400'     : 'text-yellow-400';
  const badgeBg     = isPositive ? 'bg-green-900/40 border-green-700' : isNegative ? 'bg-red-900/40 border-red-700' : 'bg-yellow-900/30 border-yellow-700';

  const scoreColor = guvenSkoru >= 70 ? 'text-green-400' : guvenSkoru >= 45 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-5 space-y-4`}>
      {/* Başlık satırı */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`text-xs font-bold uppercase tracking-wider ${accentColor}`}>Net Görüş</span>
          <span className={`px-3 py-1 rounded-lg border text-sm font-bold ${badgeBg} ${accentColor}`}>
            {isPositive ? <TrendingUp className="inline w-3.5 h-3.5 mr-1" /> : isNegative ? <TrendingDown className="inline w-3.5 h-3.5 mr-1" /> : <Minus className="inline w-3.5 h-3.5 mr-1" />}
            {netGorus}
          </span>
          {kisaVadeBeklenti && (
            <span className="px-2 py-1 rounded bg-gray-800 text-gray-300 text-xs font-medium border border-gray-700">
              Kısa Vade: {kisaVadeBeklenti}
            </span>
          )}
        </div>
        {/* Güven skoru */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">Güven</span>
          <div className="w-20 bg-gray-800 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${isPositive ? 'bg-green-500' : isNegative ? 'bg-red-500' : 'bg-yellow-500'}`}
              style={{ width: `${Math.min(guvenSkoru, 100)}%` }}
            />
          </div>
          <span className={`text-sm font-bold ${scoreColor}`}>{guvenSkoru}/100</span>
        </div>
      </div>

      {/* Ana Sebep */}
      {anaSebep && (
        <div className="flex gap-3">
          <ShieldAlert size={15} className={`${accentColor} shrink-0 mt-0.5`} />
          <p className="text-gray-200 text-sm leading-relaxed">{anaSebep}</p>
        </div>
      )}

      {/* Alt satır — Portföy etkisi + İzlenecek seviye */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {portfoyEtkisi && (
          <div className="bg-gray-900/60 rounded-lg p-3 flex gap-2.5">
            <BarChart2 size={14} className="text-purple-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-gray-500 text-xs mb-0.5 uppercase tracking-wide font-medium">Portföy Etkisi</p>
              <p className="text-gray-200 text-xs leading-relaxed">{portfoyEtkisi}</p>
            </div>
          </div>
        )}
        {izlenecekSeviye && (
          <div className="bg-gray-900/60 rounded-lg p-3 flex gap-2.5">
            <Eye size={14} className="text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-gray-500 text-xs mb-0.5 uppercase tracking-wide font-medium">İzlenecek Seviye</p>
              <p className="text-gray-200 text-xs leading-relaxed">{izlenecekSeviye}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PortfolioContextCard({ ctx }: { ctx: PortfolioContext }) {
  const [expanded, setExpanded] = useState(false);
  const retPos = ctx.total_return_pct >= 0;
  return (
    <div className="bg-gray-900/60 border border-purple-800/40 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet size={14} className="text-purple-400" />
          <span className="text-purple-300 text-xs font-semibold uppercase tracking-wide">Portföy Bazlı Analiz</span>
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-gray-500 hover:text-gray-300 transition-colors">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Toplam Değer</p>
          <p className="text-white text-sm font-semibold">{ctx.total_value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Nakit</p>
          <p className="text-white text-sm font-semibold">{ctx.cash_balance.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Başlangıç</p>
          <p className="text-white text-sm font-semibold">{ctx.initial_balance.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Toplam Getiri</p>
          <p className={`text-sm font-semibold ${retPos ? 'text-green-400' : 'text-red-400'}`}>
            {retPos ? '+' : ''}{ctx.total_return_pct.toFixed(2)}%
          </p>
        </div>
      </div>
      {expanded && ctx.positions.length > 0 && (
        <div className="mt-3 border-t border-gray-800 pt-3 space-y-2">
          {ctx.positions.map(p => {
            const pnlPos = p.pnl >= 0;
            return (
              <div key={p.symbol} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300 font-mono">{p.symbol}</span>
                  <span className="text-gray-400">{p.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">%{p.portfolio_weight.toFixed(1)}</span>
                  <span className={pnlPos ? 'text-green-400' : 'text-red-400'}>
                    {pnlPos ? '+' : ''}{p.pnl.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WhatIfCard({ result }: { result: WhatIfResult }) {
  const [expanded, setExpanded] = useState(true);
  const impactPos = result.total_impact_tl >= 0;
  return (
    <div className={`rounded-xl border p-4 ${impactPos ? 'bg-green-900/10 border-green-800/40' : 'bg-red-900/10 border-red-800/40'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowRightLeft size={14} className={impactPos ? 'text-green-400' : 'text-red-400'} />
          <span className={`text-xs font-semibold uppercase tracking-wide ${impactPos ? 'text-green-300' : 'text-red-300'}`}>
            What-If: {result.asset} {result.change_pct > 0 ? '+' : ''}{result.change_pct}%
          </span>
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-gray-500 hover:text-gray-300 transition-colors">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Önceki Değer</p>
          <p className="text-white text-sm font-semibold">{result.portfolio_before.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Sonraki Değer</p>
          <p className="text-white text-sm font-semibold">{result.portfolio_after.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-0.5">Toplam Etki</p>
          <p className={`text-sm font-semibold ${impactPos ? 'text-green-400' : 'text-red-400'}`}>
            {impactPos ? '+' : ''}{result.total_impact_tl.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
            {' '}({impactPos ? '+' : ''}{result.total_impact_pct.toFixed(2)}%)
          </p>
        </div>
      </div>
      {expanded && result.position_impacts.length > 0 && (
        <div className="mt-3 border-t border-gray-700/50 pt-3 space-y-1.5">
          {result.position_impacts.map(p => {
            const pos = p.impact_tl >= 0;
            return (
              <div key={p.symbol} className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{p.name} ({p.symbol})</span>
                <span className={pos ? 'text-green-400' : 'text-red-400'}>
                  {pos ? '+' : ''}{p.impact_tl.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} TL
                  {' '}({pos ? '+' : ''}{p.impact_pct.toFixed(2)}%)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AssistantPage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AssistantAskResponse | null>(null);
  const [error, setError] = useState('');
  const [activeWhatif, setActiveWhatif] = useState<{ asset: string; change: number } | null>(null);

  const handleAsk = async (q?: string, wi?: { asset: string; change: number } | null) => {
    const qText = q ?? question;
    if (!qText.trim()) return;
    const whatif = wi !== undefined ? wi : activeWhatif;
    setLoading(true);
    setError('');
    setResponse(null);
    try {
      const res = await askAssistant(
        qText,
        whatif?.asset,
        whatif?.change,
      );
      setResponse(res);
      if (q) setQuestion(q);
    } catch {
      setError('AI Asistan şu anda yanıt veremiyor. Lütfen tekrar deneyin.');
    }
    setLoading(false);
  };

  const handleWhatifPreset = (preset: typeof WHATIF_PRESETS[0]) => {
    const isActive = activeWhatif?.asset === preset.asset && activeWhatif?.change === preset.change;
    setActiveWhatif(isActive ? null : { asset: preset.asset, change: preset.change });
  };

  const answer = response?.answer;
  const relatedNews = response?.related_news ?? [];
  const portfolioCtx = response?.portfolio_context;
  const whatifResult = response?.whatif_result;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Başlık */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Finansal Asistan</h1>
            <p className="text-gray-400 text-sm">Portföy bazlı, kişiselleştirilmiş piyasa analizi</p>
          </div>
        </div>
        <div className="text-xs text-yellow-500 bg-yellow-500/10 px-3 py-2 rounded-lg border border-yellow-500/20 mt-3">
          ⚠ Bu içerik yatırım tavsiyesi değildir. AI yanıtları bilgilendirme ve simülasyon amaçlıdır.
        </div>
      </div>

      {/* Soru alanı */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
        <div>
          <label className="text-gray-400 text-sm mb-2 block">Sorunuzu yazın</label>
          <div className="flex gap-3">
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
              placeholder="Örn: Portföyümü nasıl değerlendirirsin? Bitcoin düşerse ne yapmalıyım?"
              rows={2}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm resize-none focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => handleAsk()}
              disabled={loading || !question.trim()}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors self-end"
            >
              {loading ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>

          {/* Örnek sorular */}
          <div className="mt-3 flex gap-2 flex-wrap">
            {EXAMPLE_QUESTIONS.map(q => (
              <button key={q} onClick={() => handleAsk(q, activeWhatif)}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* What-If Senaryo Butonları */}
        <div className="border-t border-gray-800 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={13} className="text-yellow-400" />
            <span className="text-gray-400 text-xs font-medium">What-If Senaryo</span>
            <span className="text-gray-600 text-xs">(bir varlık seçip soru sor)</span>
            {activeWhatif && (
              <button onClick={() => setActiveWhatif(null)} className="ml-auto text-xs text-gray-500 hover:text-gray-300 underline">
                Temizle
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {WHATIF_PRESETS.map(p => {
              const isActive = activeWhatif?.asset === p.asset && activeWhatif?.change === p.change;
              const isPos = p.change > 0;
              return (
                <button
                  key={p.label}
                  onClick={() => handleWhatifPreset(p)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                    isActive
                      ? isPos
                        ? 'bg-green-900/40 border-green-700 text-green-300'
                        : 'bg-red-900/40 border-red-700 text-red-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {activeWhatif && (
            <p className="text-xs text-yellow-400/70 mt-2">
              ✓ Senaryo seçildi: <strong>{activeWhatif.asset} {activeWhatif.change > 0 ? '+' : ''}{activeWhatif.change}%</strong> — Bir soru sorun
            </p>
          )}
        </div>
      </div>

      {/* Yükleniyor */}
      {loading && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
          <Loader size={32} className="animate-spin text-blue-400 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">AI Asistan analiz yapıyor...</p>
          <p className="text-gray-600 text-xs mt-1">Portföy, piyasa verisi ve haberler işleniyor</p>
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
          {/* Net Görüş Kartı — her zaman en üstte */}
          <VerdictCard answer={answer} />

          {/* Portföy Bağlamı */}
          {portfolioCtx && portfolioCtx.positions.length > 0 && (
            <PortfolioContextCard ctx={portfolioCtx} />
          )}

          {/* What-If Sonucu */}
          {whatifResult && (
            <WhatIfCard result={whatifResult} />
          )}

          {/* Detaylı Cevap */}
          {answer.directAnswer && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Target size={11} /> Detaylı Değerlendirme
              </p>
              <p className="text-gray-200 text-sm leading-relaxed">{answer.directAnswer}</p>
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
                      <p className="text-gray-400 text-xs mb-1">{a.possibleEffect}</p>
                      <p className="text-gray-600 text-xs italic">Risk Sebebi: {a.reason}</p>
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
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-white text-sm font-medium">{o.title}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded ml-2 shrink-0 ${
                          o.risk === 'yüksek' ? 'bg-red-900/50 text-red-400' :
                          o.risk === 'orta' ? 'bg-yellow-900/50 text-yellow-400' :
                          'bg-green-900/50 text-green-400'
                        }`}>{o.risk}</span>
                      </div>
                      <p className="text-gray-400 text-xs leading-relaxed">{o.description}</p>
                      {o.whenUseful && (
                        <p className="text-gray-600 text-xs mt-1">Ne zaman: {o.whenUseful}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* Senaryolar */}
          {answer.scenarios.length > 0 && (
            <Section title="📈 Olası Senaryolar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {answer.scenarios.map((s, i) => (
                  <ScenarioCard key={i} s={s} />
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

          {/* Senaryo İptal Koşulları */}
          {answer.scenarioInvalidation.length > 0 && (
            <Section title="🔄 Senaryo İptal Koşulları">
              <ul className="space-y-1.5">
                {answer.scenarioInvalidation.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                    <span className="text-orange-400 mt-0.5">•</span>{s}
                  </li>
                ))}
              </ul>
            </Section>
          )}

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
