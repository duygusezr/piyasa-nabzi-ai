import { useEffect, useState, useRef } from 'react';
import { Calendar, Clock, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { NewsSignal, MarketCalendarEvent } from '../types';

const BASE_URL = 'http://localhost:8001';

const NEWS_CATEGORIES = [
  'Tümü', 'Kripto', 'Borsa İstanbul', 'Fonlar', 'Değerli Madenler',
  'Döviz', 'Dünya Siyaseti', 'Türkiye Ekonomisi', 'Şirket Haberleri',
  'KAP / Finansal Duyurular', 'Merkez Bankaları', 'Genel'
];

function ImpactBadge({ direction }: { direction: string }) {
  if (direction === 'pozitif') return (
    <span className="flex items-center gap-1 text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded">
      <TrendingUp size={10} /> Pozitif
    </span>
  );
  if (direction === 'negatif') return (
    <span className="flex items-center gap-1 text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded">
      <TrendingDown size={10} /> Negatif
    </span>
  );
  if (direction === 'karışık') return (
    <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded">
      <Minus size={10} /> Karışık
    </span>
  );
  return <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded"><Minus size={10} /> Nötr</span>;
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    high: { label: 'Yüksek Risk', cls: 'bg-red-900/30 text-red-400 border-red-800/30' },
    medium: { label: 'Orta Risk', cls: 'bg-yellow-900/30 text-yellow-400 border-yellow-800/30' },
    low: { label: 'Düşük Risk', cls: 'bg-green-900/30 text-green-400 border-green-800/30' },
  };
  const m = map[level] || map.medium;
  return <span className={`text-xs px-2 py-0.5 rounded border ${m.cls}`}>{m.label}</span>;
}

function CalendarCard({ event }: { event: MarketCalendarEvent }) {
  const importanceColor = {
    'yüksek': 'border-red-500',
    'orta': 'border-yellow-500',
    'düşük': 'border-gray-600',
  }[event.importance] || 'border-gray-600';

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 border-l-4 ${importanceColor} p-4 min-w-64 flex-shrink-0`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-white text-sm font-medium leading-tight">{event.title}</p>
        <span className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${
          event.importance === 'yüksek' ? 'bg-red-900/50 text-red-400' :
          event.importance === 'orta' ? 'bg-yellow-900/50 text-yellow-400' :
          'bg-gray-800 text-gray-400'
        }`}>{event.importance}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><Calendar size={10} />{event.date}</span>
        {event.time && <span className="flex items-center gap-1"><Clock size={10} />{event.time}</span>}
      </div>
      {event.affected_assets.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {event.affected_assets.map(a => (
            <span key={a} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{a}</span>
          ))}
        </div>
      )}
      {event.description && <p className="text-gray-500 text-xs mt-2 line-clamp-2">{event.description}</p>}
    </div>
  );
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsSignal[]>([]);
  const [calendar, setCalendar] = useState<MarketCalendarEvent[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // StrictMode'da çift fetch'i önlemek için: ilk fetch tamamlandı mı?
  const fetchedRef = useRef(false);

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const [n, c] = await Promise.all([
        fetch(`${BASE_URL}/api/news-signals`).then(r => r.json()),
        fetch(`${BASE_URL}/api/market-calendar`).then(r => r.json()),
      ]);
      setNews(n.signals || []);
      setCalendar(c.events || []);
    } catch {
      // hata durumunda mevcut veriyi koru
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // StrictMode yüzünden iki kez çalışmasını engelle
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    loadData();
    // interval YOK — haberler sadece mount'ta veya manuel yenilemeyle çekilir
  }, []);

  // Kategori değişince backend'e istek ATILMAZ; mevcut liste frontend'de filtrelenir
  const filtered = selectedCategory === 'Tümü'
    ? news
    : news.filter(n => n.category === selectedCategory);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Haberler</h1>
          <p className="text-gray-400 text-sm mt-1">
            {loading ? 'Yükleniyor…' : (
              selectedCategory === 'Tümü'
                ? <>{filtered.length} haber • Türkçe içerik</>
                : <>{filtered.length} haber <span className="text-gray-600">/ toplam {news.length}</span> • {selectedCategory}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Manuel yenileme butonu — otomatik refresh yok */}
          <button
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Yenileniyor…' : 'Yenile'}
          </button>
          <div className="text-xs text-yellow-500 bg-yellow-500/10 px-3 py-1.5 rounded-lg border border-yellow-500/20">
            ⚠ Bu içerik yatırım tavsiyesi değildir
          </div>
        </div>
      </div>

      {/* Piyasa Takvimi */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={16} className="text-blue-400" />
          <h2 className="font-semibold text-white text-sm">Piyasa Takvimi ve Hatırlatıcılar</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {calendar.map(event => <CalendarCard key={event.id} event={event} />)}
        </div>
      </div>

      {/* Kategori filtresi */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {NEWS_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Haber kartları */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array(6).fill(0).map((_, i) => <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 h-48 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-12">Bu kategoride haber bulunamadı</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(n => (
            <div key={n.id} className="bg-gray-900 rounded-xl border border-gray-800 hover:border-gray-700 p-5 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 border border-blue-800/30">{n.category || 'Genel'}</span>
                  <RiskBadge level={n.risk_level} />
                </div>
                <ImpactBadge direction={n.impact_direction} />
              </div>

              <h3 className="text-white font-semibold text-sm leading-tight mb-1">
                {n.tr_title || n.title}
              </h3>
              <p className="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-3">
                {n.tr_summary || n.summary}
              </p>

              {n.gemini_comment && (
                <div className="bg-gray-800/50 rounded-lg p-3 mb-3 border-l-2 border-purple-500">
                  <p className="text-purple-300 text-xs font-medium mb-1">AI Finansal Yorum</p>
                  <p className="text-gray-300 text-xs leading-relaxed line-clamp-3">{n.gemini_comment}</p>
                </div>
              )}

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs">{n.source}</span>
                  {n.affected_assets.slice(0, 3).map(a => (
                    <span key={a} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{a}</span>
                  ))}
                </div>
                <span className="text-gray-600 text-xs">
                  {new Date(n.published_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-gray-700 text-xs mt-2">Bu içerik yatırım tavsiyesi değildir.</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
