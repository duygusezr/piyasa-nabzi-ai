import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Newspaper, Bot, ArrowRight } from 'lucide-react';
import { MarketData, NewsSignal } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

function formatPrice(price: number): string {
  if (price >= 1000000) return `₺${(price / 1000000).toFixed(2)}M`;
  if (price >= 1000) return `₺${price.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
  return `₺${price.toFixed(4)}`;
}

export default function OverviewPage() {
  const navigate = useNavigate();
  const [market, setMarket] = useState<MarketData | null>(null);
  const [news, setNews] = useState<NewsSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE_URL}/api/market-data`).then(r => r.json()),
      fetch(`${BASE_URL}/api/news-signals`).then(r => r.json()),
    ]).then(([m, n]) => {
      setMarket(m);
      setNews(n.signals?.slice(0, 4) || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const keyAssets = market ? [
    market.bitcoin, market.gold, market.usd_try, market.bist100
  ] : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Genel Bakış</h1>
          <p className="text-gray-400 text-sm mt-1">Piyasa özeti ve güncel sinyaller</p>
        </div>
        <div className="text-xs text-yellow-500 bg-yellow-500/10 px-3 py-1.5 rounded-lg border border-yellow-500/20">
          ⚠ Bu içerik yatırım tavsiyesi değildir
        </div>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? Array(4).fill(0).map((_, i) => (
          <div key={i} className="bg-gray-900 rounded-xl p-4 border border-gray-800 animate-pulse h-24" />
        )) : keyAssets.map(asset => (
          <div key={asset.symbol} className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-colors cursor-pointer" onClick={() => navigate('/piyasa')}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-gray-400 text-xs">{asset.name}</p>
                <p className="text-white font-bold text-lg">{formatPrice(asset.price)}</p>
              </div>
              {asset.change_pct_24h >= 0
                ? <TrendingUp size={20} className="text-green-400" />
                : <TrendingDown size={20} className="text-red-400" />}
            </div>
            <p className={`text-sm font-medium ${asset.change_pct_24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {asset.change_pct_24h >= 0 ? '+' : ''}{asset.change_pct_24h.toFixed(2)}%
            </p>
            <p className="text-gray-600 text-xs mt-1">{asset.is_mock ? 'Mock veri' : asset.source}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Son haberler */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Newspaper size={18} className="text-blue-400" />
              <h2 className="font-semibold text-white">Son Haberler</h2>
            </div>
            <button onClick={() => navigate('/haberler')} className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1">
              Tümü <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {news.length === 0 && <p className="text-gray-500 text-sm">Haberler yükleniyor...</p>}
            {news.map(n => (
              <div key={n.id} className="border-l-2 border-gray-700 pl-3 py-1">
                <p className="text-white text-sm font-medium line-clamp-1">{n.tr_title || n.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-gray-500 text-xs">{n.source}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    n.impact_direction === 'pozitif' ? 'bg-green-900/50 text-green-400' :
                    n.impact_direction === 'negatif' ? 'bg-red-900/50 text-red-400' :
                    'bg-gray-800 text-gray-400'
                  }`}>{n.impact_direction || 'nötr'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hızlı erişim */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={18} className="text-purple-400" />
            <h2 className="font-semibold text-white">Hızlı Erişim</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Piyasa verilerini incele', path: '/piyasa', color: 'blue' },
              { label: 'Haberleri kategorize et', path: '/haberler', color: 'green' },
              { label: 'Sanal portföy oluştur', path: '/simulasyon', color: 'yellow' },
              { label: 'AI Asistan\'a sor', path: '/asistan', color: 'purple' },
            ].map(item => (
              <button key={item.path} onClick={() => navigate(item.path)}
                className="w-full text-left px-4 py-3 bg-gray-800 hover:bg-gray-750 rounded-lg text-sm text-gray-300 hover:text-white transition-colors flex items-center justify-between group">
                {item.label}
                <ArrowRight size={14} className="text-gray-600 group-hover:text-gray-400" />
              </button>
            ))}
          </div>
          <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
            <p className="text-gray-500 text-xs text-center">
              Bu platform gerçek para ile işlem yapmaz. Tüm simülasyonlar sanal ortamda çalışır.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
