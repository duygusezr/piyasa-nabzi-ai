interface RiskScoreBarProps {
  label: string
  value: number
  max?: number
  colorClass?: string
}

function getColorClass(value: number): string {
  if (value >= 7) return 'bg-red-500'
  if (value >= 4) return 'bg-amber-500'
  return 'bg-emerald-500'
}

export default function RiskScoreBar({
  label,
  value,
  max = 10,
  colorClass,
}: RiskScoreBarProps) {
  const pct = Math.min(100, (value / max) * 100)
  const color = colorClass ?? getColorClass(value)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono font-semibold text-slate-200">
          {value.toFixed(1)}<span className="text-slate-500">/{max}</span>
        </span>
      </div>
      <div className="score-bar-track">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
