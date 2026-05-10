import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AssetPrice, MarketData } from '../types';

const BASE_URL = 'http://localhost:8001';

const CATEGORIES: Record<string, string[]> = {
  'Kripto': ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'PAXG'],
  'Borsa İstanbul': ['ASELS', 'THYAO', 'GARAN', 'AKBNK', 'KCHOL', 'TUPRS', 'SISE', 'BIMAS', 'FROTO', 'EREGL'],
  'Değerli Madenler': ['XAU', 'PAXG'],
  'BIST Endeksleri': ['XU100', 'XU030'],
  'Fonlar': [],
};

const CATEGORY_LABELS = Object.keys(CATEGORIES);

// Stable mock chart data — seed bazlı, render'da değişmez
function generateMockChart(basePrice: number, seed: number, points = 60) {
  const data = [];
  let price = basePrice * 0.95;
  for (let i = 0; i < points; i++) {
    const noise = Math.sin(i * 0.3 + seed) * basePrice * 0.01 +
                  Math.cos(i * 0.7 + seed * 2) * basePrice * 0.005;
    price = price + noise;
    data.push({ t: i, v: Math.max(price, basePrice * 0.8) });
  }
  return data;
}

function DataBadge({ source, isMock }: { source: string; isMock: boolean }) {
  if (isMock) return <span className="text-xs px-1.5 py-0.5 rounded bg-orange-900/50 text-orange-400 border border-orange-800/50">Mock</span>;
  if (source.includes('Binance')) return <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/50 text-green-400 border border-green-800/50">Canlı</span>;
  return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/50 text-yellow-400 border border-yellow-800/50">Gecikmeli</span>;
}

const PERIODS = [
  { key: '1G', label: '1 Gün', points: 24 },
  { key: '1H', label: '1 Hafta', points: 7 * 24 },
  { key: '1A', label: '1 Ay', points: 30 },
  { key: '3A', label: '3 Ay', points: 90 },
  { key: '1Y', label: '1 Yıl', points: 365 },
];

export default function MarketPage() {
  const [market, setMarket] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Kripto');
  const [selectedAsset, setSelectedAsset] = useState<AssetPrice | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('1A');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadData = () => {
    setLoading(true);
    fetch(`${BASE_URL}/api/market-data`)
      .then(r => r.json())
      .then(data => {
        setMarket(data);
        setLastUpdated(new Date());
        if (!selectedAsset && data.bitcoin) setSelectedAsset(data.bitcoin);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const filteredAssets = useMemo(() => {
    if (!market) return [];
    const symbolsForCategory = CATEGORIES[selectedCategory] || [];
    if (symbolsForCategory.length === 0) {
      // Fonlar — mock veri
      return [
        { symbol: 'PPF', name: 'Para Piyasası Fonu', price: 1.0423, currency: 'TRY', change_24h: 0.0012, change_pct_24h: 0.12, timestamp: new Date().toISOString(), source: 'Mock', is_mock: true },
        { symbol: 'BAF', name: 'Borçlanma Araçları Fonu', price: 1.1823, currency: 'TRY', change_24h: 0.0045, change_pct_24h: 0.38, timestamp: new Date().toISOString(), source: 'Mock', is_mock: true },
        { symbol: 'HSF', name: 'Hisse Senedi Fonu', price: 2.3412, currency: 'TRY', change_24h: -0.0234, change_pct_24h: -0.99, timestamp: new Date().toISOString(), source: 'Mock', is_mock: true },
        { symbol: 'ALF', name: 'Altın Fonu', price: 1.8923, currency: 'TRY', change_24h: 0.0189, change_pct_24h: 1.01, timestamp: new Date().toISOString(), source: 'Mock', is_mock: true },
        { symbol: 'KTF', name: 'Katılım Fonu', price: 1.2134, currency: 'TRY', change_24h: 0.0021, change_pct_24h: 0.17, timestamp: new Date().toISOString(), source: 'Mock', is_mock: true },
      ] as AssetPrice[];
    }
    return market.assets.filter(a => symbolsForCategory.includes(a.symbol));
  }, [market, selectedCategory]);

  const chartData = useMemo(() => {
    if (!selectedAsset) return [];
    const period = PERIODS.find(p => p.key === selectedPeriod)!;
    const seed = selectedAsset.symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return generateMockChart(selectedAsset.price, seed, period.points);
  }, [selectedAsset?.symbol, selectedPeriod]);

  function formatPrice(price: number) {
    if (price > 100000) return `₺${price.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
    if (price > 100) return `₺${price.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
    return `₺${price.toFixed(4)}`;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Piyasa</h1>
          <p className="text-gray-400 text-sm mt-1">
            Son güncelleme: {lastUpdated.toLocaleTimeString('tr-TR')}
          </p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Yenile
        </button>
      </div>

      {/* Kategori sekmeleri */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORY_LABELS.map(cat => (
          <button key={cat} onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Ana grafik */}
      {selectedAsset && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-white font-bold text-xl">{selectedAsset.name}</h2>
                <DataBadge source={selectedAsset.source} isMock={selectedAsset.is_mock} />
              </div>
              <p className="text-3xl font-bold text-white mt-1">{formatPrice(selectedAsset.price)}</p>
              <p className={`text-sm font-medium mt-1 ${selectedAsset.change_pct_24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {selectedAsset.change_pct_24h >= 0 ? '+' : ''}{selectedAsset.change_pct_24h.toFixed(2)}% (24s)
              </p>
            </div>
            {/* Periyot seçici */}
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setSelectedPeriod(p.key)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    selectedPeriod === p.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}>
                  {p.key}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="t" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#9ca3af' }}
                  formatter={(v: number) => [formatPrice(v), 'Fiyat']}
                />
                <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-gray-600 text-xs mt-2 text-center">
            * Grafik verileri gösterim amaçlıdır. Gerçek fiyat hareketlerini yansıtmayabilir.
          </p>
        </div>
      )}

      {/* Varlık kartları */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {loading ? Array(8).fill(0).map((_, i) => (
          <div key={i} className="bg-gray-900 rounded-xl p-4 border border-gray-800 animate-pulse h-32" />
        )) : filteredAssets.map(asset => {
          const seed = asset.symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
          const miniChart = generateMockChart(asset.price, seed, 20);
          const isSelected = selectedAsset?.symbol === asset.symbol;
          return (
            <div key={asset.symbol}
              onClick={() => setSelectedAsset(asset)}
              className={`bg-gray-900 rounded-xl p-4 border cursor-pointer transition-all ${
                isSelected ? 'border-blue-500' : 'border-gray-800 hover:border-gray-700'
              }`}>
              <div className="flex justify-between items-start mb-1">
                <div>
                  <p className="text-gray-400 text-xs">{asset.symbol}</p>
                  <p className="text-white text-xs font-medium leading-tight line-clamp-1">{asset.name}</p>
                </div>
                <DataBadge source={asset.source} isMock={asset.is_mock} />
              </div>
              <p className="text-white font-bold text-sm mt-2">{formatPrice(asset.price)}</p>
              <p className={`text-xs font-medium ${asset.change_pct_24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {asset.change_pct_24h >= 0 ? '+' : ''}{asset.change_pct_24h.toFixed(2)}%
              </p>
              {/* Mini grafik */}
              <div className="h-10 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={miniChart}>
                    <Line type="monotone" dataKey="v"
                      stroke={asset.change_pct_24h >= 0 ? '#22c55e' : '#ef4444'}
                      strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
        {!loading && filteredAssets.length === 0 && (
          <div className="col-span-full text-center text-gray-500 py-8">
            Bu kategoride veri bulunamadı
          </div>
        )}
      </div>
    </div>
  );
}
