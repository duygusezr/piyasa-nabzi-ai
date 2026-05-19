import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain, TrendingUp, TrendingDown, Bot, Cpu, Zap, Activity,
  ArrowRight, GitBranch, Layers, Database, Newspaper,
  BarChart2, RefreshCw, ChevronRight, Sparkles, Shield,
} from 'lucide-react';
import type { MarketData, NewsSignal } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// ── Sabitler ─────────────────────────────────────────────────────────────────

const AGENTS = [
  {
    id:    'user_goal',
    name:  'UserGoalAgent',
    role:  'NLP Hedef Ayrıştırma',
    tech:  'Gemini 2.5 · Regex NLP',
    type:  'NLP',
    color: 'purple',
    icon:  Brain,
    desc:  'Kullanıcı mesajını ayrıştırarak sermaye, varlık tercihi ve risk iştahını yapısal formata dönüştürür.',
  },
  {
    id:    'market_data',
    name:  'MarketDataAgent',
    role:  'Gerçek Zamanlı Veri',
    tech:  'Binance · Yahoo Finance · TCMB',
    type:  'DATA',
    color: 'blue',
    icon:  Database,
    desc:  'Kripto, hisse, döviz ve emtia verilerini paralel API çağrılarıyla çeker; 60 sn TTL cache uygular.',
  },
  {
    id:    'geo_news',
    name:  'GeopoliticalNewsAgent',
    role:  'NLP Haber & Sinyal',
    tech:  'GDELT · RSS · Gemini NLP',
    type:  'NLP',
    color: 'cyan',
    icon:  Newspaper,
    desc:  'Küresel haber akışını işleyerek piyasa etki yönü, risk seviyesi ve varlık bağlantısını sınıflandırır.',
  },
  {
    id:    'simulation',
    name:  'SimulationPortfolioAgent',
    role:  'Portföy Optimizasyon',
    tech:  'Rule Engine · Scenario Analysis',
    type:  'AGT',
    color: 'emerald',
    icon:  BarChart2,
    desc:  'Senaryo bazlı portföy dağılımı üretir; risk/getiri dengesi, volatilite ve çeşitlendirme skorlar.',
  },
  {
    id:    'asset_impact',
    name:  'AssetImpactAgent',
    role:  'Pre-Trade Risk Analizi',
    tech:  'Rule-Based · NLP Cross-Ref',
    type:  'AGT',
    color: 'amber',
    icon:  Activity,
    desc:  'İşlem öncesi portföy ağırlık, risk skoru ve volatilite değişimini hesaplayarak uyarı üretir.',
  },
  {
    id:    'compliance',
    name:  'ComplianceGuardAgent',
    role:  'Uyumluluk Denetimi',
    tech:  'Policy Engine · Content Filter',
    type:  'AGT',
    color: 'rose',
    icon:  Shield,
    desc:  'Tüm AI çıktılarını yatırım tavsiyesi uyumluluğu açısından filtreler; disclaimer enforcement sağlar.',
  },
];

const COLOR_MAP: Record<string, {
  badge: string; border: string; bg: string; dot: string; text: string;
}> = {
  purple:  { badge: 'bg-purple-900/40 text-purple-400 border-purple-700/50',  border: 'border-purple-700/30',  bg: 'bg-purple-900/10',  dot: 'bg-purple-400',  text: 'text-purple-400'  },
  blue:    { badge: 'bg-blue-900/40   text-blue-400   border-blue-700/50',    border: 'border-blue-700/30',    bg: 'bg-blue-900/10',    dot: 'bg-blue-400',    text: 'text-blue-400'    },
  cyan:    { badge: 'bg-cyan-900/40   text-cyan-400   border-cyan-700/50',    border: 'border-cyan-700/30',    bg: 'bg-cyan-900/10',    dot: 'bg-cyan-400',    text: 'text-cyan-400'    },
  emerald: { badge: 'bg-emerald-900/40 text-emerald-400 border-emerald-700/50', border: 'border-emerald-700/30', bg: 'bg-emerald-900/10', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  amber:   { badge: 'bg-amber-900/40  text-amber-400  border-amber-700/50',   border: 'border-amber-700/30',   bg: 'bg-amber-900/10',   dot: 'bg-amber-400',   text: 'text-amber-400'   },
  rose:    { badge: 'bg-rose-900/40   text-rose-400   border-rose-700/50',    border: 'border-rose-700/30',    bg: 'bg-rose-900/10',    dot: 'bg-rose-400',    text: 'text-rose-400'    },
};

// ── Yardımcılar ───────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  if (price >= 1_000_000) return `₺${(price / 1_000_000).toFixed(2)}M`;
  if (price >= 1_000)     return `₺${price.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
  return `₺${price.toFixed(4)}`;
}

function fmt2(n: number) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Bileşenler ────────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: typeof AGENTS[0] }) {
  const c = COLOR_MAP[agent.color];
  const Icon = agent.icon;
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.bg} border ${c.border}`}>
            <Icon size={16} className={c.text} />
          </div>
          <div>
            <p className="text-white text-xs font-bold font-mono">{agent.name}</p>
            <p className={`text-[10px] ${c.text}`}>{agent.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-pulse`} />
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${c.badge}`}>
            {agent.type}
          </span>
        </div>
      </div>

      <p className="text-gray-500 text-xs leading-relaxed">{agent.desc}</p>

      <div className="flex items-center gap-1.5 pt-1 border-t border-white/5">
        <Cpu size={10} className="text-gray-600" />
        <span className="text-gray-600 text-[10px] font-mono">{agent.tech}</span>
      </div>
    </div>
  );
}

function NLPSignalBadge({ direction }: { direction: string }) {
  const map: Record<string, string> = {
    pozitif: 'bg-emerald-900/40 text-emerald-400 border-emerald-700/40',
    negatif: 'bg-red-900/40 text-red-400 border-red-700/40',
    karışık: 'bg-amber-900/40 text-amber-400 border-amber-700/40',
    nötr:    'bg-gray-800 text-gray-400 border-gray-700',
  };
  const label: Record<string, string> = {
    pozitif: '↑ Pozitif', negatif: '↓ Negatif', karışık: '↔ Karışık', nötr: '→ Nötr',
  };
  const cls = map[direction] ?? map['nötr'];
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${cls}`}>
      {label[direction] ?? direction}
    </span>
  );
}

function RiskChip({ level }: { level: string }) {
  const map: Record<string, string> = {
    high:   'bg-red-900/30 text-red-400',
    medium: 'bg-amber-900/30 text-amber-400',
    low:    'bg-emerald-900/30 text-emerald-400',
  };
  const label: Record<string, string> = { high: 'Yüksek', medium: 'Orta', low: 'Düşük' };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${map[level] ?? map['low']}`}>
      {label[level] ?? level}
    </span>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const navigate = useNavigate();
  const [market, setMarket]   = useState<MarketData | null>(null);
  const [news, setNews]       = useState<NewsSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [m, n] = await Promise.all([
        fetch(`${BASE_URL}/api/market-data`).then(r => r.json()),
        fetch(`${BASE_URL}/api/news-signals`).then(r => r.json()),
      ]);
      setMarket(m);
      setNews(n.signals?.slice(0, 6) || []);
      setLastUpdate(new Date());
    } catch {
      // sessiz
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const keyAssets = market ? [market.bitcoin, market.gold, market.usd_try, market.bist100] : [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-800/30 bg-gradient-to-br from-gray-950 via-purple-950/20 to-gray-950 p-6">
        {/* Arka plan ışıması */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-32 w-48 h-48 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-900/40">
                <Brain size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-xl">Intelligence Hub</h1>
                <p className="text-purple-400 text-xs">Piyasa Nabzı AI · Çok Ajanlı Analiz Sistemi</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm max-w-xl leading-relaxed">
              6 özelleşmiş AI agent, NLP pipeline ve Gemini 2.5 Flash LLM entegrasyonu ile gerçek zamanlı
              finansal analiz, haber sınıflandırma ve portföy optimizasyonu sunar.
            </p>
          </div>

          {/* Stats */}
          <div className="flex gap-3 flex-wrap">
            {[
              { label: 'AI Agent',    value: '6',              icon: Bot,       color: 'text-purple-400' },
              { label: 'NLP Modülü', value: '3',              icon: Brain,     color: 'text-cyan-400'   },
              { label: 'API Kaynağı',value: '5+',             icon: Database,  color: 'text-blue-400'   },
              { label: 'LLM Motor',  value: 'Gemini 2.5',     icon: Sparkles,  color: 'text-amber-400'  },
            ].map(stat => (
              <div key={stat.label} className="bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3 text-center min-w-[90px]">
                <stat.icon size={14} className={`${stat.color} mx-auto mb-1`} />
                <p className={`text-base font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-gray-600 text-[10px]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline Görselleştirmesi */}
        <div className="mt-5 pt-5 border-t border-purple-900/30">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-gray-600 text-xs mr-2">Pipeline:</span>
            {[
              { label: 'Kullanıcı Girişi', sub: 'serbest metin',   color: 'text-gray-400',   bg: 'bg-gray-800' },
              { label: 'NLP Ayrıştırma',   sub: 'UserGoalAgent',   color: 'text-purple-400', bg: 'bg-purple-900/30' },
              { label: 'Veri Toplama',      sub: 'MarketDataAgent', color: 'text-blue-400',   bg: 'bg-blue-900/30' },
              { label: 'Haber Sinyali',     sub: 'NLP Sınıflama',   color: 'text-cyan-400',   bg: 'bg-cyan-900/30' },
              { label: 'LLM Analizi',       sub: 'Gemini 2.5',      color: 'text-amber-400',  bg: 'bg-amber-900/30' },
              { label: 'Portföy Çıktısı',   sub: 'SimulationAgent', color: 'text-emerald-400',bg: 'bg-emerald-900/30' },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} className="text-gray-700 flex-shrink-0" />}
                <div className={`${step.bg} rounded-lg px-2.5 py-1.5 flex-shrink-0`}>
                  <p className={`text-[10px] font-bold ${step.color}`}>{step.label}</p>
                  <p className="text-gray-600 text-[9px] font-mono">{step.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI Agent Sistemi ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-purple-400" />
            <h2 className="text-white font-semibold text-sm">AI Agent Sistemi</h2>
            <span className="text-[10px] px-2 py-0.5 bg-emerald-900/30 text-emerald-400 rounded border border-emerald-800/40 font-medium">
              6/6 Aktif
            </span>
          </div>
          <button
            onClick={() => navigate('/asistan')}
            className="text-purple-400 hover:text-purple-300 text-xs flex items-center gap-1 transition-colors"
          >
            AI Asistan'a Git <ArrowRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {AGENTS.map(agent => <AgentCard key={agent.id} agent={agent} />)}
        </div>
      </div>

      {/* ── Piyasa Snapshot + NLP Haberler (2 kolon) ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Piyasa Snapshot */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-blue-400" />
              <h2 className="text-white font-semibold text-sm">Piyasa Snapshot</h2>
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/30 text-blue-400 rounded border border-blue-800/40">
                MarketDataAgent
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-[10px]">
                {lastUpdate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <button onClick={loadData} className="text-gray-600 hover:text-gray-400 transition-colors">
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {loading
              ? Array(4).fill(0).map((_, i) => (
                  <div key={i} className="h-14 bg-gray-800 rounded-xl animate-pulse" />
                ))
              : keyAssets.map(asset => {
                  const isUp = asset.change_pct_24h >= 0;
                  return (
                    <div
                      key={asset.symbol}
                      onClick={() => navigate('/piyasa')}
                      className="flex items-center justify-between bg-gray-800/50 hover:bg-gray-800 rounded-xl px-4 py-3 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          isUp ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
                        }`}>
                          {asset.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{asset.name}</p>
                          <p className="text-gray-500 text-xs font-mono">{asset.symbol}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold text-sm">{formatPrice(asset.price)}</p>
                        <div className="flex items-center gap-1 justify-end">
                          {isUp ? <TrendingUp size={10} className="text-emerald-400" /> : <TrendingDown size={10} className="text-red-400" />}
                          <p className={`text-xs font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isUp ? '+' : ''}{fmt2(asset.change_pct_24h)}%
                          </p>
                        </div>
                      </div>
                      <ArrowRight size={12} className="text-gray-700 group-hover:text-gray-500 ml-2 transition-colors" />
                    </div>
                  );
                })
            }
          </div>

          <button
            onClick={() => navigate('/piyasa')}
            className="w-full mt-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-400 hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-2"
          >
            <BarChart2 size={13} /> Tüm Piyasayı Gör
          </button>
        </div>

        {/* NLP Haber Sinyalleri */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-cyan-400" />
              <h2 className="text-white font-semibold text-sm">NLP Haber Sinyalleri</h2>
              <span className="text-[10px] px-1.5 py-0.5 bg-cyan-900/30 text-cyan-400 rounded border border-cyan-800/40">
                GeopoliticalNewsAgent
              </span>
            </div>
            <button
              onClick={() => navigate('/haberler')}
              className="text-cyan-400 hover:text-cyan-300 text-xs flex items-center gap-1 transition-colors"
            >
              Tümü <ArrowRight size={12} />
            </button>
          </div>

          <div className="space-y-2.5">
            {news.length === 0 && loading && (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="h-14 bg-gray-800 rounded-xl animate-pulse" />
              ))
            )}
            {news.length === 0 && !loading && (
              <p className="text-gray-600 text-sm text-center py-6">Haberler yükleniyor...</p>
            )}
            {news.map(n => (
              <div key={n.id} className="bg-gray-800/50 rounded-xl px-3 py-2.5 space-y-1.5">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium leading-snug line-clamp-2">
                      {n.tr_title || n.title}
                    </p>
                  </div>
                  <NLPSignalBadge direction={n.impact_direction} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-gray-600 text-[10px]">{n.source}</span>
                  <RiskChip level={n.risk_level} />
                  {n.affected_assets.slice(0, 2).map(a => (
                    <span key={a} className="text-[10px] px-1.5 py-0.5 bg-gray-700/50 text-gray-400 rounded font-mono">
                      {a}
                    </span>
                  ))}
                  <span className="text-gray-700 text-[10px] ml-auto">NLP sınıflama ✓</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Hızlı Erişim ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'AI Asistan',
            sub:   'Gemini 2.5 · Portföy Analizi',
            path:  '/asistan',
            icon:  Bot,
            color: 'from-purple-600/20 to-purple-900/10 border-purple-700/30 text-purple-400',
          },
          {
            label: 'NLP Haberler',
            sub:   'GDELT · RSS · Sınıflandırma',
            path:  '/haberler',
            icon:  Newspaper,
            color: 'from-cyan-600/20 to-cyan-900/10 border-cyan-700/30 text-cyan-400',
          },
          {
            label: 'Simülasyon',
            sub:   'AI Agent · Paper Trading',
            path:  '/simulasyon',
            icon:  GitBranch,
            color: 'from-emerald-600/20 to-emerald-900/10 border-emerald-700/30 text-emerald-400',
          },
          {
            label: 'Piyasa',
            sub:   'Binance · Yahoo · TCMB',
            path:  '/piyasa',
            icon:  BarChart2,
            color: 'from-blue-600/20 to-blue-900/10 border-blue-700/30 text-blue-400',
          },
        ].map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`bg-gradient-to-br ${item.color} border rounded-xl p-4 text-left group transition-all hover:scale-[1.02] hover:shadow-lg`}
          >
            <item.icon size={20} className="mb-2 opacity-80 group-hover:opacity-100 transition-opacity" />
            <p className="text-white font-semibold text-sm">{item.label}</p>
            <p className="text-gray-500 text-[10px] mt-0.5 font-mono">{item.sub}</p>
            <ArrowRight size={12} className="text-gray-600 group-hover:text-gray-400 mt-2 transition-colors" />
          </button>
        ))}
      </div>

      {/* ── Footer Bilgi ──────────────────────────────────────────────── */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-amber-400" />
          <span className="text-gray-400 text-xs font-medium">Teknoloji Yığını:</span>
        </div>
        {['Python · FastAPI', 'Google Gemini 2.5 Flash', 'Binance API', 'Yahoo Finance', 'GDELT Project', 'TEFAS', 'React · TypeScript', 'TailwindCSS'].map(tech => (
          <span key={tech} className="text-[10px] px-2 py-1 bg-gray-800 text-gray-500 rounded border border-gray-700 font-mono">
            {tech}
          </span>
        ))}
        <span className="ml-auto text-gray-700 text-[10px]">⚠ Bu içerik yatırım tavsiyesi değildir</span>
      </div>
    </div>
  );
}
