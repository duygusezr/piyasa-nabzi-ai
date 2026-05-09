interface HeaderProps {
  isLive?: boolean
}

export default function Header({ isLive = false }: HeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20">
            P
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Piyasa Nabzı AI</h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              Gerçek zamanlı piyasa analizi · Finansal senaryo simülasyonu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isLive && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-900/40 border border-emerald-700/50">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">Canlı</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700">
            <span className="text-xs text-slate-400">Simülasyon Modu</span>
          </div>
        </div>
      </div>
    </header>
  )
}
