import { useEffect, useState, useMemo, useCallback } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Wifi, WifiOff, Clock } from 'lucide-react';
import { AssetPrice, MarketData } from '../types';
import { ProfessionalChart } from '../components/ProfessionalChart';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// ── Kategori → sembol eşlemesi ────────────────────────────────────────────────
const CATEGORIES: Record<string, string[]> = {
  'Kripto':          ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'PAXG'],
  'Borsa İstanbul':  ['ASELS', 'THYAO', 'GARAN', 'AKBNK', 'KCHOL', 'TUPRS', 'SISE', 'BIMAS', 'FROTO', 'EREGL'],
  'Değerli Madenler':['XAU', 'PAXG'],
  'BIST Endeksleri': ['XU100', 'XU030'],
  'Fonlar':          [],
};

const CATEGORY_LABELS = Object.keys(CATEGORIES);

// Mock fon verileri (gerçek API yokken)
const MOCK_FUNDS: AssetPrice[] = [
  { symbol: 'PPF', name: 'Para Piyasası Fonu',     price: 1.0423, currency: 'TRY', change_24h: 0.0012,  change_pct_24h:  0.12, timestamp: new Date().toISOString(), source: 'Mock', is_mock: true },
  { symbol: 'BAF', name: 'Borçlanma Araçları Fonu', price: 1.1823, currency: 'TRY', change_24h: 0.0045,  change_pct_24h:  0.38, timestamp: new Date().toISOString(), source: 'Mock', is_mock: true },
  { symbol: 'HSF', name: 'Hisse Senedi Fonu',       price: 2.3412, currency: 'TRY', change_24h: -0.0234, change_pct_24h: -0.99, timestamp: new Date().toISOString(), source: 'Mock', is_mock: true },
  { symbol: 'ALF', name: 'Altın Fonu',              price: 1.8923, currency: 'TRY', change_24h: 0.0189,  change_pct_24h:  1.01, timestamp: new Date().toISOString(), source: 'Mock', is_mock: true },
  { symbol: 'KTF', name: 'Katılım Fonu',            price: 1.2134, currency: 'TRY', change_24h: 0.0021,  change_pct_24h:  0.17, timestamp: new Date().toISOString(), source: 'Mock', is_mock: true },
];

// ── Yardımcı bileşenler ───────────────────────────────────────────────────────

function DataBadge({ source, isMock }: { source: string; isMock: boolean }) {
  if (isMock) return (
    <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-orange-900/50 text-orange-400 border border-orange-800/50">
      <WifiOff size={9} />Mock
    </span>
  );
  if (source.includes('Binance')) return (
    <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-green-900/50 text-green-400 border border-green-800/50">
      <Wifi size={9} />Canlı
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-yellow-900/50 text-yellow-400 border border-yellow-800/50">
      <Clock size={9} />Gecikmeli
    </span>
  );
}

function formatPrice(price: number): string {
  if (price >= 1_000_000) return `₺${price.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
  if (price >= 100)       return `₺${price.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
  if (price >= 1)         return `₺${price.toFixed(4)}`;
  return `₺${price.toFixed(6)}`;
}

// Küçük SVG sparkline — kart içi mini grafik (sahte, stabil seed bazlı)
function MiniSparkline({ price, changePct, symbol }: { price: number; changePct: number; symbol: string }) {
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const points = 20;
  const values: number[] = [];
  let v = price * 0.96;
  for (let i = 0; i < points; i++) {
    const n = Math.sin(i * 0.4 + seed) * price * 0.008 + Math.cos(i * 0.9 + seed * 1.3) * price * 0.004;
    v = v + n;
    values.push(Math.max(v, price * 0.85));
  }
  // Sonu mevcut fiyata yaklaştır
  values[values.length - 1] = price;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 80, H = 32;

  const pts = values.map((val, i) => {
    const x = (i / (points - 1)) * W;
    const y = H - ((val - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');

  const color = changePct >= 0 ? '#22c55e' : '#ef4444';
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mt-2">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Ana bileşen ────────────────────────────────────────────────────────────────

export default function MarketPage() {
  const [market, setMarket]                 = useState<MarketData | null>(null);
  const [loading, setLoading]               = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Kripto');
  const [selectedAsset, setSelectedAsset]   = useState<AssetPrice | null>(null);
  const [lastUpdated, setLastUpdated]       = useState<Date>(new Date());

  const loadData = useCallback(() => {
    setLoading(true);
    fetch(`${BASE_URL}/api/market-data`)
      .then(r => r.json())
      .then((data: MarketData) => {
        setMarket(data);
        setLastUpdated(new Date());
        setLoading(false);
        // İlk yüklemede BTC'yi seç
        setSelectedAsset(prev => prev ?? data.bitcoin ?? null);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Kategori değişince ilk varlığı seç
  useEffect(() => {
    if (!market) return;
    const syms = CATEGORIES[selectedCategory] ?? [];
    if (syms.length === 0) { setSelectedAsset(MOCK_FUNDS[0]); return; }
    const found = market.assets.find(a => a.symbol === syms[0]);
    if (found) setSelectedAsset(found);
  }, [selectedCategory, market]);

  const filteredAssets = useMemo<AssetPrice[]>(() => {
    if (!market) return [];
    const syms = CATEGORIES[selectedCategory] ?? [];
    if (syms.length === 0) return MOCK_FUNDS;
    return market.assets.filter(a => syms.includes(a.symbol));
  }, [market, selectedCategory]);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* ── Başlık ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Piyasa</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Güncellendi: {lastUpdated.toLocaleTimeString('tr-TR')}
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Yenile
        </button>
      </div>

      {/* ── Kategori sekmeleri ──────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORY_LABELS.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Profesyonel grafik ──────────────────────────────────────────────── */}
      {selectedAsset && (
        <ProfessionalChart
          key={selectedAsset.symbol}
          symbol={selectedAsset.symbol}
          assetName={selectedAsset.name}
          currentPrice={selectedAsset.price}
          changePct24h={selectedAsset.change_pct_24h}
          isMock={selectedAsset.is_mock}
        />
      )}

      {/* ── Varlık kartları ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {loading
          ? Array(6).fill(0).map((_, i) => (
              <div key={i} className="bg-gray-900 rounded-xl p-4 border border-gray-800 animate-pulse h-36" />
            ))
          : filteredAssets.map(asset => {
              const isSelected = selectedAsset?.symbol === asset.symbol;
              const isUp = asset.change_pct_24h >= 0;
              return (
                <div
                  key={asset.symbol}
                  onClick={() => setSelectedAsset(asset)}
                  className={`bg-gray-900 rounded-xl p-4 border cursor-pointer transition-all hover:shadow-lg ${
                    isSelected
                      ? 'border-blue-500 shadow-blue-500/10'
                      : 'border-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="text-gray-500 text-xs font-mono">{asset.symbol}</p>
                      <p className="text-white text-xs font-medium leading-tight line-clamp-1 mt-0.5">
                        {asset.name}
                      </p>
                    </div>
                    <DataBadge source={asset.source} isMock={asset.is_mock} />
                  </div>

                  <p className="text-white font-bold text-sm mt-2">{formatPrice(asset.price)}</p>
                  <div className="flex items-center gap-1">
                    {isUp
                      ? <TrendingUp size={10} className="text-green-400" />
                      : <TrendingDown size={10} className="text-red-400" />}
                    <p className={`text-xs font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                      {isUp ? '+' : ''}{asset.change_pct_24h.toFixed(2)}%
                    </p>
                    <p className={`text-xs ${isUp ? 'text-green-600' : 'text-red-600'}`}>
                      ({isUp ? '+' : ''}{formatPrice(Math.abs(asset.change_24h))})
                    </p>
                  </div>

                  <MiniSparkline price={asset.price} changePct={asset.change_pct_24h} symbol={asset.symbol} />
                </div>
              );
            })
        }
        {!loading && filteredAssets.length === 0 && (
          <div className="col-span-full text-center text-gray-600 py-10">
            Bu kategoride veri bulunamadı
          </div>
        )}
      </div>
    </div>
  );
}
