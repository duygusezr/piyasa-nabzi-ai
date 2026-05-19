import { NavLink } from 'react-router-dom';
import {
  Brain, BarChart2, Newspaper, TrendingUp, Bot, Settings,
  Wallet, LogOut, Cpu, Zap, Activity, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AI_ITEMS = [
  { path: '/',         label: 'Intelligence Hub', icon: Brain,     badge: 'AI' },
  { path: '/asistan',  label: 'AI Asistan',        icon: Bot,      badge: 'NLP' },
  { path: '/haberler', label: 'NLP Haberler',      icon: Newspaper, badge: null },
];

const MARKET_ITEMS = [
  { path: '/piyasa',     label: 'Piyasa',       icon: BarChart2  },
  { path: '/simulasyon', label: 'Simülasyon',   icon: TrendingUp },
  { path: '/cuzdan',     label: 'Cüzdan',       icon: Wallet     },
];

const SYSTEM_ITEMS = [
  { path: '/ayarlar', label: 'Ayarlar', icon: Settings },
];

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-gray-600 text-[10px] uppercase tracking-widest font-semibold px-3 py-1.5">
        {title}
      </p>
      {children}
    </div>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col h-full">

      {/* Logo */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-900/30">
            <Brain size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-tight">Piyasa Nabzı</h1>
            <p className="text-purple-400 text-xs font-medium">AI Finansal Terminal</p>
          </div>
        </div>

        {/* AI System Status */}
        <div className="bg-gray-900 rounded-lg px-3 py-2 border border-gray-800">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-gray-500 text-xs flex items-center gap-1.5">
              <Cpu size={10} />
              AI Sistem Durumu
            </span>
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Aktif
            </span>
          </div>
          <div className="flex gap-1.5">
            {['NLP', 'LLM', 'AGT', 'MKT'].map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-purple-900/40 text-purple-400 rounded border border-purple-800/40 font-mono">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Navigasyon */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">

        <NavSection title="AI Sistemi">
          {AI_ITEMS.map(({ path, label, icon: Icon, badge }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all group ${
                  isActive
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-600/30'
                    : 'text-gray-400 hover:bg-gray-800/60 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} className={isActive ? 'text-purple-400' : 'text-gray-500 group-hover:text-gray-300'} />
                    <span>{label}</span>
                  </div>
                  {badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                      isActive
                        ? 'bg-purple-600/30 text-purple-300 border-purple-500/30'
                        : 'bg-gray-800 text-gray-500 border-gray-700 group-hover:text-gray-400'
                    }`}>
                      {badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </NavSection>

        <NavSection title="Piyasa">
          {MARKET_ITEMS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all group ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30'
                    : 'text-gray-400 hover:bg-gray-800/60 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </NavSection>

        <NavSection title="Sistem">
          {SYSTEM_ITEMS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all group ${
                  isActive
                    ? 'bg-gray-700 text-white border border-gray-600'
                    : 'text-gray-400 hover:bg-gray-800/60 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-300'} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </NavSection>

        {/* Agent Sayacı */}
        <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-xl border border-purple-800/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={12} className="text-yellow-400" />
            <span className="text-gray-400 text-xs font-medium">AI Agent Sistemi</span>
          </div>
          {[
            { name: 'UserGoalAgent',    type: 'NLP' },
            { name: 'MarketDataAgent',  type: 'MKT' },
            { name: 'GeopoliticalNews', type: 'NLP' },
            { name: 'SimulationAgent',  type: 'AGT' },
            { name: 'AssetImpact',      type: 'AGT' },
            { name: 'Compliance',       type: 'AGT' },
          ].map(agent => (
            <div key={agent.name} className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-1.5">
                <Activity size={8} className="text-emerald-400" />
                <span className="text-gray-500 text-[10px] font-mono">{agent.name}</span>
              </div>
              <span className="text-[9px] px-1 py-0.5 bg-gray-800 text-gray-600 rounded font-mono">
                {agent.type}
              </span>
            </div>
          ))}
        </div>
      </nav>

      {/* Kullanıcı */}
      <div className="p-3 border-t border-gray-800 space-y-2">
        {user && (
          <div className="flex items-center gap-2 px-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold uppercase">{user.email[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-300 text-xs truncate">{user.email}</p>
              <p className="text-purple-500 text-[10px]">AI Kullanıcısı</p>
            </div>
            <ChevronRight size={12} className="text-gray-600 flex-shrink-0" />
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-800 hover:text-red-400 transition-all"
        >
          <LogOut size={13} />
          Çıkış Yap
        </button>
        <p className="text-gray-700 text-[10px] text-center">Yatırım tavsiyesi değildir</p>
      </div>
    </aside>
  );
}
