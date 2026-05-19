import { useNavigate } from 'react-router-dom';
import { Bot, Cpu, GitBranch, Layers, Zap } from 'lucide-react';

const PIPELINE_STAGES = [
  { id: 'nlp',    label: 'NLP',     sub: 'Hedef Ayrıştırma',  color: 'text-purple-400', dot: 'bg-purple-400' },
  { id: 'data',   label: 'DATA',    sub: 'Binance · Yahoo',    color: 'text-blue-400',   dot: 'bg-blue-400' },
  { id: 'signal', label: 'SIGNAL',  sub: 'GDELT · RSS',        color: 'text-cyan-400',   dot: 'bg-cyan-400' },
  { id: 'llm',    label: 'LLM',     sub: 'Gemini 2.5 Flash',   color: 'text-amber-400',  dot: 'bg-amber-400' },
  { id: 'agent',  label: 'AGENT',   sub: '6 Ajan Aktif',       color: 'text-emerald-400', dot: 'bg-emerald-400' },
];

export default function TopBar() {
  const navigate = useNavigate();

  return (
    <header className="bg-gray-950 border-b border-gray-800 px-4 py-0 flex items-stretch">

      {/* Sol: Pipeline */}
      <div className="flex items-center gap-0 flex-1 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2 mr-4 flex-shrink-0">
          <Cpu size={13} className="text-gray-600" />
          <span className="text-gray-600 text-xs font-mono uppercase tracking-wider">AI Pipeline</span>
        </div>

        {PIPELINE_STAGES.map((stage, i) => (
          <div key={stage.id} className="flex items-center flex-shrink-0">
            {i > 0 && (
              <div className="flex items-center mx-1">
                <div className="w-4 h-px bg-gray-700" />
                <div className="w-0 h-0 border-l-4 border-l-gray-700 border-y-2 border-y-transparent" />
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-3 group cursor-default">
              <span className={`w-1.5 h-1.5 rounded-full ${stage.dot} animate-pulse`}
                style={{ animationDelay: `${i * 200}ms` }} />
              <div>
                <p className={`text-[10px] font-bold font-mono ${stage.color}`}>{stage.label}</p>
                <p className="text-[9px] text-gray-600 leading-none mt-0.5">{stage.sub}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Ayırıcı */}
        <div className="w-px bg-gray-800 h-8 mx-3 flex-shrink-0" />

        {/* Canlı Durum */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-emerald-400 text-xs font-medium">Canlı</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers size={11} className="text-gray-600" />
            <span className="text-gray-500 text-xs">6 Agent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <GitBranch size={11} className="text-gray-600" />
            <span className="text-gray-500 text-xs font-mono text-[10px]">gemini-2.5-flash</span>
          </div>
        </div>
      </div>

      {/* Sağ: Disclaimer + CTA */}
      <div className="flex items-center gap-3 pl-4 border-l border-gray-800 flex-shrink-0">
        <span className="text-yellow-600 text-[10px] hidden lg:block">⚠ Simülasyon · Yatırım tavsiyesi değildir</span>
        <button
          onClick={() => navigate('/asistan')}
          className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-xs font-semibold text-white transition-all shadow-lg shadow-purple-900/30 my-2"
        >
          <Zap size={12} />
          AI Analiz
        </button>
      </div>
    </header>
  );
}
