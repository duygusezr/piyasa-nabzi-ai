type Section =
  | 'dashboard'
  | 'market'
  | 'signals'
  | 'analysis'
  | 'scenarios'
  | 'simulation'
  | 'news'
  | 'watchlist'
  | 'settings'

interface NavItem {
  id: Section
  label: string
  icon: string
}

const NAV: NavItem[] = [
  { id: 'dashboard',  label: 'Genel Bakış',   icon: '▣' },
  { id: 'analysis',   label: 'AI Asistan',    icon: '✦' },
  { id: 'market',     label: 'Piyasa',        icon: '◈' },
  { id: 'news',       label: 'Haberler',      icon: '◐' },
  { id: 'watchlist',  label: 'Takip Listesi', icon: '▤' },
  { id: 'settings',   label: 'Ayarlar',       icon: '◳' },
]

interface SidebarProps {
  active: Section
  onNavigate: (s: Section) => void
}

export default function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside
      className="flex flex-col shrink-0 h-screen"
      style={{ width: 200, background: '#080e1c', borderRight: '1px solid #1a2535' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4" style={{ borderBottom: '1px solid #1a2535' }}>
        <div
          className="flex items-center justify-center shrink-0 font-black text-sm"
          style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, #06d6f0 0%, #8b5cf6 100%)',
            color: '#070c15',
          }}
        >
          P
        </div>
        <div>
          <p className="text-xs font-bold text-white leading-none">Piyasa Nabzı</p>
          <p className="text-2xs text-slate-600 leading-none mt-0.5">AI Terminal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`nav-item w-full text-left ${active === item.id ? 'active' : ''}`}
          >
            <span className="text-base leading-none w-4 text-center">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 flex items-center gap-1.5" style={{ borderTop: '1px solid #1a2535' }}>
        <div className="live-dot" />
        <span className="text-2xs text-bull font-semibold">CANLI</span>
        <span className="text-2xs text-slate-700 ml-auto">Simülasyon</span>
      </div>
    </aside>
  )
}

export type { Section }
