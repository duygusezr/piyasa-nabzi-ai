import { NavLink } from 'react-router-dom';
import {
  BarChart2, Newspaper, TrendingUp, Bot, Settings, Activity, Wallet, LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { path: '/',           label: 'Genel Bakış',  icon: Activity },
  { path: '/piyasa',     label: 'Piyasa',        icon: BarChart2 },
  { path: '/haberler',   label: 'Haberler',      icon: Newspaper },
  { path: '/simulasyon', label: 'Simülasyon',    icon: TrendingUp },
  { path: '/cuzdan',     label: 'Cüzdan',        icon: Wallet },
  { path: '/asistan',    label: 'AI Asistan',    icon: Bot },
  { path: '/ayarlar',    label: 'Ayarlar',       icon: Settings },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <BarChart2 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-tight">Piyasa Nabzı</h1>
            <p className="text-gray-500 text-xs">AI Finansal Terminal</p>
          </div>
        </div>
      </div>

      {/* Navigasyon */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Kullanıcı & çıkış */}
      <div className="p-4 border-t border-gray-800 space-y-3">
        {user && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-400 text-xs font-bold uppercase">
                {user.email[0]}
              </span>
            </div>
            <span className="text-gray-400 text-xs truncate flex-1" title={user.email}>
              {user.email}
            </span>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-800 hover:text-red-400 transition-all"
        >
          <LogOut size={15} />
          Çıkış Yap
        </button>
        <p className="text-gray-600 text-xs text-center">Yatırım tavsiyesi değildir</p>
      </div>
    </aside>
  );
}
