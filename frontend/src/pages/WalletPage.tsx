import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  RefreshCw, BarChart2, PieChart, Clock
} from 'lucide-react';
import { fetchPortfolioSummary, fetchSimulationTransactions } from '../services/api';
import type { SimulationPortfolioSummary, VirtualTransaction } from '../types';

const CATEGORY_COLORS: Record<string, string> = {
  'Kripto':           'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'Borsa İstanbul':   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Değerli Madenler': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'BIST Endeksleri':  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Fonlar':           'bg-green-500/20 text-green-400 border-green-500/30',
  'ABD Hisseleri':    'bg-red-500/20 text-red-400 border-red-500/30',
};

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function PnlBadge({ value, suffix = '' }: { value: number; suffix?: string }) {
  const pos = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${pos ? 'text-green-400' : 'text-red-400'}`}>
      {pos ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {pos ? '+' : ''}{fmt(value)}{suffix}
    </span>
  );
}

export default function WalletPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SimulationPortfolioSummary | null>(null);
  const [txs, setTxs] = useState<VirtualTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [perfTab, setPerfTab] = useState<'1d' | '1w' | '1m'>('1d');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [sum, txData] = await Promise.all([
        fetchPortfolioSummary(),
        fetchSimulationTransactions(),
      ]);
      setSummary(sum);
      setTxs(txData.transactions);
    } catch (e: any) {
      if (e.message === 'NO_ACCOUNT') {
        setSummary(null);
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 h-64">
        <Wallet size={40} className="text-gray-600" />
        <p className="text-gray-400 text-sm text-center">
          Henüz bir simülasyon hesabınız yok.<br />Cüzdanı kullanmak için önce hesap oluşturun.
        </p>
        <button
          onClick={() => navigate('/simulasyon')}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          Simülasyon Hesabı Oluştur →
        </button>
      </div>
    );
  }

  // Performans değerleri
  const perfPnl = perfTab === '1w' ? summary.weekly_pnl : perfTab === '1m' ? summary.monthly_pnl : summary.daily_pnl;
  const perfPct = perfTab === '1w' ? summary.weekly_pnl_pct : perfTab === '1m' ? summary.monthly_pnl_pct : summary.daily_pnl_pct;

  // Kategori bazlı dağılım
  const categoryMap: Record<string, number> = {};
  for (const pos of summary.positions) {
    categoryMap[pos.category] = (categoryMap[pos.category] || 0) + pos.market_value;
  }
  const categories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600/20 rounded-xl flex items-center justify-center">
            <Wallet size={18} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg">Cüzdan</h1>
            <p className="text-gray-500 text-xs">Simülasyon Portföyü</p>
          </div>
        </div>
        <button onClick={load} className="text-gray-500 hover:text-white transition-colors" title="Yenile">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs mb-1">Toplam Değer</p>
          <p className="text-white font-bold text-lg">{fmt(summary.total_portfolio_value)} ₺</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs mb-1">Nakit</p>
          <p className="text-white font-bold text-lg">{fmt(summary.cash_balance)} ₺</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs mb-1">Yatırım Değeri</p>
          <p className="text-white font-bold text-lg">{fmt(summary.positions_value)} ₺</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs mb-1">Toplam Getiri</p>
          <PnlBadge value={summary.total_return} suffix=" ₺" />
          <p className={`text-xs mt-0.5 ${summary.total_return_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {summary.total_return_pct >= 0 ? '+' : ''}{fmt(summary.total_return_pct)}%
          </p>
        </div>
      </div>

      {/* P&L Banner */}
      <div className={`rounded-xl p-4 border flex items-center justify-between ${
        summary.total_return >= 0
          ? 'bg-green-500/5 border-green-500/20'
          : 'bg-red-500/5 border-red-500/20'
      }`}>
        <div className="flex items-center gap-2">
          {summary.total_return >= 0
            ? <TrendingUp size={20} className="text-green-400" />
            : <TrendingDown size={20} className="text-red-400" />}
          <span className="text-gray-300 text-sm">
            Başlangıç: <strong className="text-white">{fmt(summary.initial_balance)} ₺</strong>
          </span>
        </div>
        <div className="text-right">
          <p className={`font-semibold ${summary.total_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {summary.total_return >= 0 ? '+' : ''}{fmt(summary.total_return)} ₺
          </p>
          <p className={`text-xs ${summary.total_return >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {summary.total_return_pct >= 0 ? '+' : ''}{fmt(summary.total_return_pct)}% toplam
          </p>
        </div>
      </div>

      {/* Dönemsel Performans */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 size={16} className="text-gray-400" />
            <span className="text-gray-300 text-sm font-medium">Dönemsel Performans</span>
          </div>
          <div className="flex gap-1">
            {(['1d', '1w', '1m'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setPerfTab(r)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  perfTab === r ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'
                }`}
              >
                {r === '1d' ? 'Günlük' : r === '1w' ? 'Haftalık' : 'Aylık'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-gray-500 text-xs">P&L</p>
            <PnlBadge value={perfPnl} suffix=" ₺" />
          </div>
          <div>
            <p className="text-gray-500 text-xs">Değişim</p>
            <PnlBadge value={perfPct} suffix="%" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kategori Dağılımı */}
        {categories.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <PieChart size={16} className="text-gray-400" />
              <span className="text-gray-300 text-sm font-medium">Kategori Dağılımı</span>
            </div>
            <div className="space-y-3">
              {categories.map(([cat, val]) => {
                const pct = summary.positions_value > 0 ? (val / summary.total_portfolio_value) * 100 : 0;
                const colorClass = CATEGORY_COLORS[cat] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${colorClass}`}>{cat}</span>
                      <span className="text-gray-300 text-xs">{fmt(pct, 1)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pozisyonlar */}
        {summary.positions.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-gray-400" />
              <span className="text-gray-300 text-sm font-medium">Pozisyonlar</span>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {summary.positions.map((pos) => (
                <div key={pos.symbol} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">{pos.symbol}</p>
                    <p className="text-gray-500 text-xs">{pos.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm">{fmt(pos.market_value)} ₺</p>
                    <PnlBadge value={pos.pnl_pct} suffix="%" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* İşlem Geçmişi */}
      {txs.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-gray-400" />
            <span className="text-gray-300 text-sm font-medium">Son İşlemler</span>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {txs.slice(0, 20).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`w-14 text-center text-xs py-1 rounded-full font-medium ${
                    tx.tx_type === 'buy'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {tx.tx_type === 'buy' ? 'ALIŞ' : 'SATIŞ'}
                  </span>
                  <div>
                    <p className="text-white text-sm font-medium">{tx.symbol}</p>
                    <p className="text-gray-500 text-xs">{tx.quantity.toFixed(4)} adet @ {fmt(tx.price)} ₺</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white text-sm">{fmt(tx.total)} ₺</p>
                  <p className="text-gray-500 text-xs">
                    {new Date(tx.timestamp).toLocaleDateString('tr-TR', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.positions.length === 0 && txs.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          Henüz işlem yapılmamış.{' '}
          <button onClick={() => navigate('/simulasyon')} className="text-blue-400 hover:text-blue-300">
            Simülasyon sayfasına git →
          </button>
        </div>
      )}
    </div>
  );
}
