import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  RefreshCw, BarChart2, PieChart, Clock, Plus, Trash2, X,
  ShoppingBag, CheckCircle, AlertCircle, Search
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  fetchPortfolioSummary,
  fetchSimulationTransactions,
  fetchSimulationPerformance,
  fetchMarketData,
} from '../services/api';
import type {
  SimulationPortfolioSummary,
  VirtualTransaction,
  SimulationPerformance,
  RealPortfolioItem,
  RealPortfolioPosition,
  MarketData,
} from '../types';

// ── Sabitler ──────────────────────────────────────────────────────────────────

const REAL_PORTFOLIO_KEY = 'pn_real_portfolio';

const CATEGORY_COLORS: Record<string, string> = {
  'Kripto':           'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'Borsa İstanbul':   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Değerli Madenler': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'BIST Endeksleri':  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Fonlar':           'bg-green-500/20 text-green-400 border-green-500/30',
  'ABD Hisseleri':    'bg-red-500/20 text-red-400 border-red-500/30',
  'Diğer':            'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

// Piyasa sayfasıyla aynı liste — kullanıcıya seçenek sunmak için
const KNOWN_ASSETS = [
  { symbol: 'BTC',   name: 'Bitcoin',          category: 'Kripto' },
  { symbol: 'ETH',   name: 'Ethereum',         category: 'Kripto' },
  { symbol: 'SOL',   name: 'Solana',           category: 'Kripto' },
  { symbol: 'BNB',   name: 'BNB',              category: 'Kripto' },
  { symbol: 'XRP',   name: 'XRP',              category: 'Kripto' },
  { symbol: 'PAXG',  name: 'PAX Gold',         category: 'Kripto' },
  { symbol: 'XAU',   name: 'Altın',            category: 'Değerli Madenler' },
  { symbol: 'XU100', name: 'BIST 100',         category: 'BIST Endeksleri' },
  { symbol: 'XU030', name: 'BIST 30',          category: 'BIST Endeksleri' },
  { symbol: 'ASELS', name: 'Aselsan',          category: 'Borsa İstanbul' },
  { symbol: 'THYAO', name: 'Türk Hava Yolları',category: 'Borsa İstanbul' },
  { symbol: 'GARAN', name: 'Garanti BBVA',     category: 'Borsa İstanbul' },
  { symbol: 'AKBNK', name: 'Akbank',           category: 'Borsa İstanbul' },
  { symbol: 'KCHOL', name: 'Koç Holding',      category: 'Borsa İstanbul' },
  { symbol: 'TUPRS', name: 'Tüpraş',           category: 'Borsa İstanbul' },
  { symbol: 'SISE',  name: 'Şişe Cam',         category: 'Borsa İstanbul' },
  { symbol: 'BIMAS', name: 'BİM Mağazaları',   category: 'Borsa İstanbul' },
  { symbol: 'FROTO', name: 'Ford Otosan',       category: 'Borsa İstanbul' },
  { symbol: 'EREGL', name: 'Ereğli Demir Çelik',category: 'Borsa İstanbul' },
];

// ── Yardımcı ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPrice(n: number) {
  if (n >= 1_000_000) return `₺${fmt(n, 0)}`;
  if (n >= 100)       return `₺${fmt(n, 2)}`;
  if (n >= 1)         return `₺${n.toFixed(4)}`;
  return `₺${n.toFixed(6)}`;
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

// ── Varlık Ekleme Modalı ─────────────────────────────────────────────────────

interface AddAssetModalProps {
  onAdd: (item: RealPortfolioItem) => void;
  onClose: () => void;
  marketAssets: { symbol: string; name: string; price: number; category: string }[];
}

function AddAssetModal({ onAdd, onClose, marketAssets }: AddAssetModalProps) {
  const [search, setSearch]           = useState('');
  const [selected, setSelected]       = useState<typeof marketAssets[0] | null>(null);
  const [manualSymbol, setManualSymbol] = useState('');
  const [manualName, setManualName]   = useState('');
  const [manualCat, setManualCat]     = useState('Diğer');
  const [quantity, setQuantity]       = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate]   = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes]             = useState('');
  const [mode, setMode]               = useState<'list' | 'manual'>('list');
  const [error, setError]             = useState('');

  // Market listesi + manuel varlıkları birleştir (eşsiz sembol)
  const allAssets = useMemo(() => {
    const known = KNOWN_ASSETS.map(k => {
      const live = marketAssets.find(m => m.symbol === k.symbol);
      return { ...k, price: live?.price ?? 0 };
    });
    const extra = marketAssets.filter(m => !known.find(k => k.symbol === m.symbol));
    return [...known, ...extra];
  }, [marketAssets]);

  const filtered = useMemo(() =>
    search.trim()
      ? allAssets.filter(a =>
          a.symbol.toLowerCase().includes(search.toLowerCase()) ||
          a.name.toLowerCase().includes(search.toLowerCase())
        )
      : allAssets,
    [search, allAssets]
  );

  const handleSubmit = () => {
    setError('');
    const q  = parseFloat(quantity.replace(',', '.'));
    const pp = parseFloat(purchasePrice.replace(',', '.'));

    if (mode === 'list' && !selected) { setError('Lütfen bir varlık seçin.'); return; }
    if (mode === 'manual' && !manualSymbol.trim()) { setError('Sembol zorunlu.'); return; }
    if (!quantity || isNaN(q) || q <= 0)  { setError('Geçerli bir miktar girin.'); return; }
    if (!purchasePrice || isNaN(pp) || pp <= 0) { setError('Geçerli bir alış fiyatı girin.'); return; }

    const item: RealPortfolioItem = {
      id: `rp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      symbol:         mode === 'list' ? selected!.symbol   : manualSymbol.toUpperCase().trim(),
      name:           mode === 'list' ? selected!.name     : manualName.trim() || manualSymbol.toUpperCase().trim(),
      category:       mode === 'list' ? selected!.category : manualCat,
      quantity:       q,
      purchase_price: pp,
      purchase_date:  purchaseDate,
      notes:          notes.trim() || undefined,
    };
    onAdd(item);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-blue-400" />
            <h2 className="text-white font-semibold">Varlık Ekle</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 px-5 pt-4">
          <button
            onClick={() => setMode('list')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              mode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Listeden Seç
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              mode === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Manuel Gir
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Listeden seç */}
          {mode === 'list' && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="BTC, Altın, THYAO..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {filtered.map(asset => (
                  <button
                    key={asset.symbol}
                    onClick={() => {
                      setSelected(asset);
                      if (asset.price > 0) setPurchasePrice(asset.price.toString());
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      selected?.symbol === asset.symbol
                        ? 'bg-blue-600/20 border border-blue-500/40 text-white'
                        : 'bg-gray-800 hover:bg-gray-750 text-gray-300 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {selected?.symbol === asset.symbol && <CheckCircle size={12} className="text-blue-400" />}
                      <span className="font-mono font-medium text-xs text-gray-400">{asset.symbol}</span>
                      <span className="text-white">{asset.name}</span>
                    </div>
                    {asset.price > 0 && (
                      <span className="text-gray-400 text-xs">{fmtPrice(asset.price)}</span>
                    )}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-gray-600 text-xs text-center py-4">Sonuç bulunamadı. "Manuel Gir" ile ekleyin.</p>
                )}
              </div>
            </div>
          )}

          {/* Manuel giriş */}
          {mode === 'manual' && (
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Sembol *</label>
                <input
                  type="text"
                  placeholder="AAPL, ETH, ..."
                  value={manualSymbol}
                  onChange={e => setManualSymbol(e.target.value.toUpperCase())}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Ad</label>
                <input
                  type="text"
                  placeholder="Apple Inc."
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Kategori</label>
                <select
                  value={manualCat}
                  onChange={e => setManualCat(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {Object.keys(CATEGORY_COLORS).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Ortak alanlar */}
          <div className="border-t border-gray-800 pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Miktar *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.001"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Alış Fiyatı (₺) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="100000"
                  value={purchasePrice}
                  onChange={e => setPurchasePrice(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Alış Tarihi</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Not (isteğe bağlı)</label>
              <input
                type="text"
                placeholder="Uzun vadeli yatırım..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Özet */}
            {quantity && purchasePrice && parseFloat(quantity) > 0 && parseFloat(purchasePrice) > 0 && (
              <div className="bg-gray-800/60 rounded-lg px-3 py-2 text-xs text-gray-300">
                Toplam maliyet:{' '}
                <span className="text-white font-medium">
                  {fmt(parseFloat(quantity.replace(',', '.')) * parseFloat(purchasePrice.replace(',', '.')))} ₺
                </span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs">
                <AlertCircle size={12} />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5 pt-3 border-t border-gray-800">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            Ekle
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Gerçek Portföy Sekmesi ───────────────────────────────────────────────────

interface RealPortfolioTabProps {
  items: RealPortfolioItem[];
  onAdd: (item: RealPortfolioItem) => void;
  onDelete: (id: string) => void;
}

function RealPortfolioTab({ items, onAdd, onDelete }: RealPortfolioTabProps) {
  const [showModal, setShowModal]     = useState(false);
  const [marketData, setMarketData]   = useState<MarketData | null>(null);
  const [loading, setLoading]         = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadPrices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMarketData();
      setMarketData(data);
      setLastUpdated(new Date());
    } catch {
      // Sessiz hata — maliyet fiyatı göster
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPrices(); }, [loadPrices]);

  // Modal için piyasa listesi (fiyatlı)
  const marketAssets = useMemo(() => {
    if (!marketData) return [];
    return marketData.assets.map(a => ({
      symbol:   a.symbol,
      name:     a.name,
      price:    a.price,
      category: 'Kripto', // fallback — gerçek kategori KNOWN_ASSETS'tan alınır
    }));
  }, [marketData]);

  // Pozisyonları canlı fiyatla zenginleştir
  const positions = useMemo<RealPortfolioPosition[]>(() => {
    return items.map(item => {
      const live = marketData?.assets.find(a => a.symbol === item.symbol);
      const currentPrice = live?.price ?? item.purchase_price;
      const costBasis    = item.quantity * item.purchase_price;
      const marketValue  = item.quantity * currentPrice;
      const pnl          = marketValue - costBasis;
      const pnlPct       = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
      return {
        ...item,
        current_price:  currentPrice,
        market_value:   marketValue,
        cost_basis:     costBasis,
        pnl,
        pnl_pct:        pnlPct,
        has_live_price: !!live,
      };
    });
  }, [items, marketData]);

  // Toplam istatistikler
  const totalCost    = positions.reduce((s, p) => s + p.cost_basis, 0);
  const totalValue   = positions.reduce((s, p) => s + p.market_value, 0);
  const totalPnl     = totalValue - totalCost;
  const totalPnlPct  = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const inProfit     = totalPnl >= 0;

  // Kategori dağılımı
  const categoryMap: Record<string, number> = {};
  for (const p of positions) {
    categoryMap[p.category] = (categoryMap[p.category] || 0) + p.market_value;
  }
  const categories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      {/* Yenile + Ekle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {lastUpdated && (
            <span>Fiyatlar: {lastUpdated.toLocaleTimeString('tr-TR')}</span>
          )}
          <button
            onClick={loadPrices}
            disabled={loading}
            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
            title="Fiyatları güncelle"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Güncelle
          </button>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus size={15} />
          Varlık Ekle
        </button>
      </div>

      {/* Boş durum */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center">
            <ShoppingBag size={24} className="text-gray-600" />
          </div>
          <div>
            <p className="text-white font-medium mb-1">Henüz varlık eklenmedi</p>
            <p className="text-gray-500 text-sm">
              Piyasadan aldığın varlıkları ekle,<br />canlı fiyatlarla kâr/zarar takibi yap.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus size={15} />
            İlk Varlığını Ekle
          </button>
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* Özet kartlar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-1">Toplam Maliyet</p>
              <p className="text-white font-bold text-base">{fmt(totalCost)} ₺</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-1">Güncel Değer</p>
              <p className="text-white font-bold text-base">{fmt(totalValue)} ₺</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-1">Kâr / Zarar</p>
              <PnlBadge value={totalPnl} suffix=" ₺" />
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-1">Getiri %</p>
              <PnlBadge value={totalPnlPct} suffix="%" />
            </div>
          </div>

          {/* P&L Banner */}
          <div className={`rounded-xl p-4 border flex items-center justify-between ${
            inProfit
              ? 'bg-green-500/5 border-green-500/20'
              : 'bg-red-500/5 border-red-500/20'
          }`}>
            <div className="flex items-center gap-2">
              {inProfit
                ? <TrendingUp size={20} className="text-green-400" />
                : <TrendingDown size={20} className="text-red-400" />}
              <span className="text-gray-300 text-sm">
                Portföyün toplam olarak{' '}
                <strong className={inProfit ? 'text-green-400' : 'text-red-400'}>
                  {inProfit ? 'kârda' : 'zararda'}
                </strong>
              </span>
            </div>
            <div className="text-right">
              <p className={`font-semibold text-lg ${inProfit ? 'text-green-400' : 'text-red-400'}`}>
                {inProfit ? '+' : ''}{fmt(totalPnl)} ₺
              </p>
              <p className={`text-xs ${inProfit ? 'text-green-500' : 'text-red-500'}`}>
                {inProfit ? '+' : ''}{fmt(totalPnlPct)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Pozisyonlar */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-gray-400" />
                <span className="text-gray-300 text-sm font-medium">Pozisyonlar</span>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {positions.map(pos => (
                  <div
                    key={pos.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-gray-800/60 hover:bg-gray-800 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium">{pos.symbol}</p>
                        {!pos.has_live_price && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-500 border border-yellow-800/40">
                            Fiyat yok
                          </span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${CATEGORY_COLORS[pos.category] ?? CATEGORY_COLORS['Diğer']}`}>
                          {pos.category}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {pos.quantity.toLocaleString('tr-TR', { maximumFractionDigits: 6 })} adet
                        {' '}@ alış {fmtPrice(pos.purchase_price)}
                      </p>
                      {pos.notes && (
                        <p className="text-gray-600 text-xs italic mt-0.5 truncate">{pos.notes}</p>
                      )}
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="text-white text-sm font-medium">{fmt(pos.market_value)} ₺</p>
                      <div className="flex items-center gap-1 justify-end">
                        <PnlBadge value={pos.pnl_pct} suffix="%" />
                      </div>
                      <p className={`text-xs ${pos.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pos.pnl >= 0 ? '+' : ''}{fmt(pos.pnl)} ₺
                      </p>
                    </div>
                    <button
                      onClick={() => onDelete(pos.id)}
                      className="ml-3 text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      title="Sil"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Kategori Dağılımı */}
            {categories.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <PieChart size={16} className="text-gray-400" />
                  <span className="text-gray-300 text-sm font-medium">Kategori Dağılımı</span>
                </div>
                <div className="space-y-3">
                  {categories.map(([cat, val]) => {
                    const pct = totalValue > 0 ? (val / totalValue) * 100 : 0;
                    const colorClass = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Diğer'];
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

                {/* Detaylı liste */}
                <div className="mt-4 space-y-1">
                  {positions.map(pos => (
                    <div key={pos.id} className="flex justify-between text-xs text-gray-400 py-0.5">
                      <span className="font-mono">{pos.symbol}</span>
                      <span>
                        {fmtPrice(pos.current_price)}{' '}
                        <span className={pos.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400'}>
                          ({pos.pnl_pct >= 0 ? '+' : ''}{fmt(pos.pnl_pct)}%)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {showModal && (
        <AddAssetModal
          onAdd={onAdd}
          onClose={() => setShowModal(false)}
          marketAssets={marketAssets}
        />
      )}
    </div>
  );
}

// ── Simülasyon Sekme Yardımcıları ────────────────────────────────────────────

function SimulationTab() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SimulationPortfolioSummary | null>(null);
  const [txs, setTxs]         = useState<VirtualTransaction[]>([]);
  const [perf, setPerf]       = useState<SimulationPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [perfLoading, setPerfLoading] = useState(false);
  const [error, setError]     = useState('');
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
      if (e.message === 'NO_ACCOUNT') setSummary(null);
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPerf = async (range: '1d' | '1w' | '1m') => {
    setPerfLoading(true);
    try {
      const data = await fetchSimulationPerformance(range);
      setPerf(data);
    } catch {
      setPerf(null);
    } finally {
      setPerfLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (summary) loadPerf(perfTab); }, [perfTab, summary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw size={22} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <Wallet size={36} className="text-gray-600" />
        <p className="text-gray-400 text-sm">
          Henüz bir simülasyon hesabınız yok.<br />Cüzdanı kullanmak için önce hesap oluşturun.
        </p>
        <button
          onClick={() => navigate('/simulasyon')}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          Simülasyon Hesabı Oluştur →
        </button>
      </div>
    );
  }

  const perfPnl = perf?.pnl ?? (perfTab === '1w' ? summary.weekly_pnl : perfTab === '1m' ? summary.monthly_pnl : summary.daily_pnl);
  const perfPct = perf?.pnl_pct ?? (perfTab === '1w' ? summary.weekly_pnl_pct : perfTab === '1m' ? summary.monthly_pnl_pct : summary.daily_pnl_pct);
  const chartData = perf?.chart_data ?? [];

  const categoryMap: Record<string, number> = {};
  for (const pos of summary.positions) {
    categoryMap[pos.category] = (categoryMap[pos.category] || 0) + pos.market_value;
  }
  const categories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      {/* Yenile */}
      <div className="flex justify-end">
        <button onClick={load} className="text-gray-500 hover:text-white transition-colors flex items-center gap-1 text-xs">
          <RefreshCw size={13} /> Yenile
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
        <div className="flex items-center gap-6 mb-4">
          <div>
            <p className="text-gray-500 text-xs">P&L</p>
            {perfLoading ? <span className="text-gray-600 text-sm">—</span> : <PnlBadge value={perfPnl} suffix=" ₺" />}
          </div>
          <div>
            <p className="text-gray-500 text-xs">Değişim</p>
            {perfLoading ? <span className="text-gray-600 text-sm">—</span> : <PnlBadge value={perfPct} suffix="%" />}
          </div>
          {perf && (
            <div>
              <p className="text-gray-500 text-xs">Dönem Başı</p>
              <p className="text-gray-300 text-sm font-medium">{fmt(perf.initial_value)} ₺</p>
            </div>
          )}
        </div>
        {chartData.length >= 2 ? (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#9ca3af' }}
                  formatter={(v: number) => [`${fmt(v)} ₺`, 'Değer']}
                />
                <ReferenceLine y={chartData[0]?.value} stroke="#374151" strokeDasharray="3 3" />
                <Line
                  type="monotone" dataKey="value"
                  stroke={perfPnl >= 0 ? '#22c55e' : '#ef4444'}
                  strokeWidth={2} dot={false} activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-600 text-xs text-center py-4">
            Grafik için yeterli veri yok. İşlem yaptıkça geçmiş oluşur.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
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
                    tx.tx_type === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
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
                      hour: '2-digit', minute: '2-digit',
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

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const [activeTab, setActiveTab] = useState<'simulation' | 'real'>('simulation');

  // ── Gerçek portföy — localStorage ─────────────────────────────────────────
  const [realItems, setRealItems] = useState<RealPortfolioItem[]>(() => {
    try {
      const stored = localStorage.getItem(REAL_PORTFOLIO_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // localStorage'a yaz
  useEffect(() => {
    localStorage.setItem(REAL_PORTFOLIO_KEY, JSON.stringify(realItems));
  }, [realItems]);

  const handleAddReal = useCallback((item: RealPortfolioItem) => {
    setRealItems(prev => [item, ...prev]);
  }, []);

  const handleDeleteReal = useCallback((id: string) => {
    setRealItems(prev => prev.filter(i => i.id !== id));
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Başlık + Sekme Seçici */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600/20 rounded-xl flex items-center justify-center">
            <Wallet size={18} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg">Cüzdan</h1>
            <p className="text-gray-500 text-xs">
              {activeTab === 'simulation' ? 'Simülasyon Portföyü' : 'Gerçek Portföy'}
            </p>
          </div>
        </div>

        {/* Tab Seçici */}
        <div className="flex gap-2 bg-gray-900 border border-gray-800 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('simulation')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'simulation'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Simülasyon
          </button>
          <button
            onClick={() => setActiveTab('real')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'real'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Gerçek Portföy
            {realItems.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === 'real' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'
              }`}>
                {realItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* İçerik */}
      {activeTab === 'simulation' ? (
        <SimulationTab />
      ) : (
        <RealPortfolioTab
          items={realItems}
          onAdd={handleAddReal}
          onDelete={handleDeleteReal}
        />
      )}
    </div>
  );
}
