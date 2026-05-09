export interface OHLCPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export function generateOHLC(basePrice: number, days = 60): OHLCPoint[] {
  const data: OHLCPoint[] = []
  let price = basePrice * (0.82 + Math.random() * 0.08)
  const now = Date.now()

  for (let i = days; i >= 0; i--) {
    const volatility = 0.025 + Math.random() * 0.02
    const drift = (Math.random() - 0.46) * volatility
    const open = price
    const change = price * drift
    const close = price + change
    const swing = Math.abs(change) * (1 + Math.random())
    const high = Math.max(open, close) + swing * 0.4
    const low = Math.min(open, close) - swing * 0.4
    const volume = basePrice * (500 + Math.random() * 2000)

    const d = new Date(now - i * 86_400_000)
    data.push({
      date: d.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: +volume.toFixed(0),
    })
    price = close
  }
  return data
}

export function generateSparkline(basePrice: number, points = 20): number[] {
  const data: number[] = []
  let p = basePrice * (0.95 + Math.random() * 0.05)
  for (let i = 0; i < points; i++) {
    p += p * (Math.random() - 0.48) * 0.025
    data.push(+p.toFixed(2))
  }
  return data
}

export function sliceByPeriod(data: OHLCPoint[], period: '1W' | '1M' | '3M' | '1Y'): OHLCPoint[] {
  const map = { '1W': 7, '1M': 30, '3M': 90, '1Y': 365 }
  return data.slice(-map[period])
}
