import type { MarketData, AssetPrice } from '../types'

const ASSET_ICONS: Record<string, string> = {
  BTC: '₿',
  ETH: 'Ξ',
  XAU: '⬡',
  USDTRY: '$',
  XU100: '📈',
  ASELS: '🛡',
}

function PriceCard({ asset }: { asset: AssetPrice }) {
  const isPositive = asset.change_pct_24h >= 0
  const icon = ASSET_ICONS[asset.symbol] ?? asset.symbol[0]

  return (
    <div className="card-hover flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-lg font-bold text-slate-300">
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">{asset.name}</p>
            <p className="text-xs text-slate-500">{asset.symbol}</p>
          </div>
        </div>
        {asset.is_mock && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700">
            Mock
          </span>
        )}
      </div>

      <div>
        <p className="text-2xl font-bold text-slate-100 font-mono">
          {asset.price.toLocaleString('tr-TR', {
            minimumFractionDigits: asset.price < 100 ? 2 : 0,
            maximumFractionDigits: asset.price < 100 ? 4 : 0,
          })}
          <span className="text-sm text-slate-500 font-normal ml-1">{asset.currency}</span>
        </p>
        <p
          className={`text-sm font-medium mt-0.5 flex items-center gap-1 ${
            isPositive ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {isPositive ? '▲' : '▼'}
          {Math.abs(asset.change_pct_24h).toFixed(2)}%
          <span className="text-xs text-slate-500 font-normal">24s</span>
        </p>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-800">
        <span>{asset.source}</span>
        <span>{new Date(asset.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  )
}

interface MarketDataCardsProps {
  data: MarketData | null
  isLoading?: boolean
}

export default function MarketDataCards({ data, isLoading }: MarketDataCardsProps) {
  const primaryAssets = data
    ? [data.bitcoin, data.gold, data.usd_try, data.bist100]
    : []

  const extraAssets = data?.assets.filter(
    (a) => !['BTC', 'XAU', 'USDTRY', 'XU100'].includes(a.symbol)
  ) ?? []

  return (
    <section>
      <h2 className="section-title">
        <span className="text-2xl">📊</span>
        Gerçek Zamanlı Piyasa Verileri
        {data && (
          <span className="ml-auto text-xs text-slate-500 font-normal">
            {new Date(data.fetched_at).toLocaleString('tr-TR')}
          </span>
        )}
      </h2>

      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-3/4 mb-3" />
              <div className="h-8 bg-slate-800 rounded w-1/2 mb-2" />
              <div className="h-3 bg-slate-800 rounded w-1/3" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {primaryAssets.map((asset) => (
              <PriceCard key={asset.symbol} asset={asset} />
            ))}
          </div>
          {extraAssets.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
              {extraAssets.map((asset) => (
                <PriceCard key={asset.symbol} asset={asset} />
              ))}
            </div>
          )}
        </>
      )}

      {!isLoading && !data && (
        <div className="card text-center py-10 text-slate-500">
          <p>Piyasa verisi bekleniyor… Analiz başlatıldığında yüklenecek.</p>
        </div>
      )}
    </section>
  )
}
