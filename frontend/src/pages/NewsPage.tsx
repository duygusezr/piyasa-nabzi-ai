import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Calendar, Clock, TrendingUp, TrendingDown, Minus,
  RefreshCw, Brain, Cpu, Newspaper, Zap, Activity,
  Globe, MessageSquare, BarChart2, Search,
} from 'lucide-react';
import type { NewsSignal, MarketCalendarEvent } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

const NEWS_CATEGORIES = [
  'Tümü', 'Kripto', 'Borsa İstanbul', 'Fonlar', 'Değerli Madenler',
  'Döviz', 'Dünya Siyaseti', 'Türkiye Ekonomisi', 'Şirket Haberleri',
  'KAP / Finansal Duyurular', 'Merkez Bankaları', 'Genel',
];

// ── AI Pipeline Yükleme Slaytları ────────────────────────────────────────────

const LOADING_SLIDES = [
  {
    icon: Globe,
    color: 'text-blue-400',
    bg: 'bg-blue-900/20',
    border: 'border-blue-700/30',
    title: 'Küresel Kaynaklar Taranıyor',
    sub: 'GDELT, RSS feed\'leri ve haber ajanslarından veri çekiliyor…',
    tag: 'DATA FETCH',
  },
  {
    icon: Brain,
    color: 'text-purple-400',
    bg: 'bg-purple-900/20',
    border: 'border-purple-700/30',
    title: 'NLP Modeli Metinleri İşliyor',
    sub: 'Haber başlıkları ve içerikleri doğal dil işleme pipeline\'ından geçiyor…',
    tag: 'NLP',
  },
  {
    icon: MessageSquare,
    color: 'text-cyan-400',
    bg: 'bg-cyan-900/20',
    border: 'border-cyan-700/30',
    title: 'Türkçe İçerik Hazırlanıyor',
    sub: 'İngilizce kaynaklar Türkçeye çevriliyor, yerelleştirme uygulanıyor…',
    tag: 'TRANSLATE',
  },
  {
    icon: Zap,
    color: 'text-amber-400',
    bg: 'bg-amber-900/20',
    border: 'border-amber-700/30',
    title: 'Gemini 2.5 Flash Analiz Yapıyor',
    sub: 'Her haber için finansal etki, risk seviyesi ve yorum üretiliyor…',
    tag: 'LLM',
  },
  {
    icon: Search,
    color: 'text-emerald-400',
    bg: 'bg-emerald-900/20',
    border: 'border-emerald-700/30',
    title: 'Etkilenen Varlıklar Tespit Ediliyor',
    sub: 'Haber içeriğinden BTC, Altın, BIST gibi varlık bağlantıları çıkarılıyor…',
    tag: 'ENTITY',
  },
  {
    icon: BarChart2,
    color: 'text-rose-400',
    bg: 'bg-rose-900/20',
    border: 'border-rose-700/30',
    title: 'Risk Seviyeleri Sınıflandırılıyor',
    sub: 'Piyasa etki yönü ve güven skoru hesaplanıyor, sinyaller derleniyor…',
    tag: 'CLASSIFY',
  },
  {
    icon: Activity,
    color: 'text-indigo-400',
    bg: 'bg-indigo-900/20',
    border: 'border-indigo-700/30',
    title: 'Sinyaller Son İşlemden Geçiyor',
    sub: 'Analiz sonuçları doğrulanıyor ve arayüze hazırlanıyor…',
    tag: 'FINALIZE',
  },
];

// ── Yükleme Slayt Bileşeni ────────────────────────────────────────────────────

function LoadingSlideshow() {
  const [slide, setSlide] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const cycle = () => {
      setVisible(false);
      setTimeout(() => {
        setSlide(s => (s + 1) % LOADING_SLIDES.length);
        setVisible(true);
      }, 350);
    };
    const id = setInterval(cycle, 2200);
    return () => clearInterval(id);
  }, []);

  const s = LOADING_SLIDES[slide];
  const Icon = s.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      {/* Ana Kart */}
      <div
        className={`w-full max-w-lg rounded-2xl border ${s.border} ${s.bg} p-8 text-center transition-all duration-300 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        {/* İkon + Etiket */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-xl ${s.bg} border ${s.border} flex items-center justify-center`}>
            <Icon size={24} className={s.color} />
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded border ${s.border} ${s.bg} ${s.color} font-mono tracking-wider`}>
            {s.tag}
          </span>
        </div>

        {/* Başlık */}
        <h3 className="text-white font-bold text-lg mb-2">{s.title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{s.sub}</p>

        {/* Animasyonlu nokta çubuğu */}
        <div className="flex items-center justify-center gap-1.5 mt-5">
          {[0, 1, 2, 3].map(i => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${s.color.replace('text-', 'bg-')} animate-bounce`}
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Slayt noktaları */}
      <div className="flex gap-1.5 mt-5">
        {LOADING_SLIDES.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i === slide ? 'w-5 h-1.5 bg-purple-400' : 'w-1.5 h-1.5 bg-gray-700'
            }`}
          />
        ))}
      </div>

      {/* Alt Bilgi */}
      <div className="mt-5 flex items-center gap-4 flex-wrap justify-center">
        <div className="flex items-center gap-1.5">
          <Cpu size={12} className="text-gray-600" />
          <span className="text-gray-600 text-xs">AI Pipeline Aktif</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-gray-600 text-xs">GeopoliticalNewsAgent çalışıyor</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: '500ms' }} />
          <span className="text-gray-600 text-xs">Gemini 2.5 Flash</span>
        </div>
      </div>

      {/* İskelet kartlar */}
      <div className="w-full max-w-2xl mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 opacity-20">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 h-36 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ── Yardımcı Badge Bileşenleri ────────────────────────────────────────────────

function ImpactBadge({ direction }: { direction: string }) {
  if (direction === 'pozitif') return (
    <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-800/30 whitespace-nowrap">
      <TrendingUp size={10} /> Pozitif
    </span>
  );
  if (direction === 'negatif') return (
    <span className="flex items-center gap-1 text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded border border-red-800/30 whitespace-nowrap">
      <TrendingDown size={10} /> Negatif
    </span>
  );
  if (direction === 'karışık') return (
    <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-800/30 whitespace-nowrap">
      <Minus size={10} /> Karışık
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded border border-gray-700 whitespace-nowrap">
      <Minus size={10} /> Nötr
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    high:   { label: 'Yüksek Risk', cls: 'bg-red-900/30 text-red-400 border-red-800/30' },
    medium: { label: 'Orta Risk',   cls: 'bg-amber-900/30 text-amber-400 border-amber-800/30' },
    low:    { label: 'Düşük Risk',  cls: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/30' },
  };
  const m = map[level] || map.medium;
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${m.cls} whitespace-nowrap`}>{m.label}</span>
  );
}

function ConfidenceDot({ level }: { level: string }) {
  const map: Record<string, string> = {
    high:   'bg-emerald-400',
    medium: 'bg-amber-400',
    low:    'bg-gray-500',
  };
  const label: Record<string, string> = { high: 'Yüksek', medium: 'Orta', low: 'Düşük' };
  return (
    <div className="flex items-center gap-1" title={`Güven: ${label[level] ?? level}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${map[level] ?? 'bg-gray-600'}`} />
      <span className="text-gray-600 text-[10px]">Güven: {label[level] ?? level}</span>
    </div>
  );
}

// ── AI Yorum Bileşeni ─────────────────────────────────────────────────────────

/**
 * Frontend güvenlik neti: backend'den yorum gelmezse
 * haber başlığı, varlıklar, risk ve etki yönüne göre
 * benzersiz bir yorum üretir. Her haber farklı metin alır.
 */
function generateFallbackComment(n: NewsSignal): string {
  const title    = (n.tr_title || n.title || '').trim();
  const assets   = n.affected_assets?.slice(0, 3) ?? [];
  const primary  = assets[0] ?? 'ilgili varlık';
  const secondary = assets.slice(1, 3).join(', ');
  const category = n.category || 'Genel';

  const shortTitle = title.length > 60 ? title.slice(0, 57) + '…' : title;
  const prefix = shortTitle ? `“${shortTitle}” — ` : '';
  const disclaimer = ' Bu yorum simülasyon amaçlıdır.';

  let verdict: string;
  let reason: string;

  if (n.impact_direction === 'pozitif') {
    verdict = `Bu haber ${primary} fiyatını YÜKSELTİR.`;
    reason  = `${category} kaynaklı bu olumlu gelişme ${primary} talebini artırır` +
              (secondary ? `; ${secondary} da pozitif etkilenir` : '') +
              '. Fiyat hareketini doğrulamak için hacim artışı takip edilmeli.';
  } else if (n.impact_direction === 'negatif') {
    verdict = `Bu haber ${primary} fiyatını DÜŞÜRÜR.`;
    reason  = `Bu olumsuz gelişme ${primary} üzerinde satış baskısı yaratır` +
              (secondary ? `; ${secondary} da olumsuz etkilenir` : '') +
              '. Destek seviyesi kırılırsa düşüş hızlanabilir.';
  } else if (n.impact_direction === 'karışık') {
    const second = assets[1] ?? 'diğer varlıklar';
    verdict = `Bu haber ${primary}'i yükseltir, ${second}'yi baskılar.`;
    reason  = `${category} kategorisinde sektörel ayrışma yaşanır; ` +
              'her varlık birbirinden bağımsız değerlendirilmeli. ' +
              'Belirsizlik kademeli açıklamalarla azalabilir.';
  } else {
    verdict = `Bu haberin ${primary} üzerinde belirgin yönlü etkisi beklenmez.`;
    reason  = `${category} kategorisindeki mevcut trend devam eder; ` +
              'piyasa fiyatlamada bu haberi ikincil görüyor. ' +
              'Farklı bir katalist çıkmazsa yön değişmesi öngörülmez.';
  }

  return prefix + verdict + ' ' + reason + disclaimer;
}

function AiCommentBox({ news }: { news: NewsSignal }) {
  // Önce Gemini yorumunu dene, sonra frontend fallback'a geç
  const gemini  = (news.gemini_comment ?? '').trim();
  const comment = gemini || generateFallbackComment(news);
  const isReal  = gemini.length > 0;

  const [expanded, setExpanded] = useState(false);
  const isTruncatable = comment.length > 200;
  const shown = (!isTruncatable || expanded) ? comment : comment.slice(0, 200) + '…';

  return (
    <div className="rounded-lg border border-purple-700/30 bg-purple-900/10 p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded bg-purple-900/50 border border-purple-700/40 flex items-center justify-center flex-shrink-0">
          <Brain size={10} className="text-purple-400" />
        </div>
        <span className="text-purple-400 text-[11px] font-bold uppercase tracking-wider">
          Gemini AI Finansal Yorum
        </span>
        {isReal && (
          <span className="ml-auto text-[9px] px-1.5 py-0.5 bg-purple-900/40 text-purple-500 rounded border border-purple-800/30 font-mono">
            LLM ✓
          </span>
        )}
      </div>
      <p className="text-gray-300 text-xs leading-relaxed">{shown}</p>
      {isTruncatable && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-purple-400 hover:text-purple-300 text-[11px] mt-1.5 transition-colors"
        >
          {expanded ? '↑ Daha az göster' : '↓ Devamını gör'}
        </button>
      )}
      <p className="text-gray-700 text-[9px] mt-2">
        Bu yorum simülasyon/bilgilendirme amaçlıdır. Yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}

// ── Takvim Kartı ──────────────────────────────────────────────────────────────

function CalendarCard({ event }: { event: MarketCalendarEvent }) {
  const importanceColor = {
    'yüksek': 'border-red-500',
    'orta':   'border-amber-500',
    'düşük':  'border-gray-600',
  }[event.importance] || 'border-gray-600';

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 border-l-4 ${importanceColor} p-4 min-w-64 flex-shrink-0`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-white text-sm font-medium leading-tight">{event.title}</p>
        <span className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0 ${
          event.importance === 'yüksek' ? 'bg-red-900/50 text-red-400' :
          event.importance === 'orta'   ? 'bg-amber-900/50 text-amber-400' :
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
      {event.description && (
        <p className="text-gray-500 text-xs mt-2 line-clamp-2">{event.description}</p>
      )}
    </div>
  );
}

// ── Haber Kartı ───────────────────────────────────────────────────────────────

function NewsCard({ news: n }: { news: NewsSignal }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 hover:border-gray-700 p-5 transition-colors flex flex-col gap-3">
      {/* Başlık satırı */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 border border-blue-800/30 whitespace-nowrap">
            {n.category || 'Genel'}
          </span>
          <RiskBadge level={n.risk_level} />
        </div>
        <ImpactBadge direction={n.impact_direction} />
      </div>

      {/* Başlık */}
      <h3 className="text-white font-semibold text-sm leading-snug">
        {n.tr_title || n.title}
      </h3>

      {/* Özet */}
      {(n.tr_summary || n.summary) && (
        <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">
          {n.tr_summary || n.summary}
        </p>
      )}

      {/* AI Yorum — her zaman göster */}
      <AiCommentBox news={n} />

      {/* Alt bilgi */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-gray-800">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Newspaper size={10} className="text-gray-600" />
            <span className="text-gray-500 text-xs">{n.source}</span>
          </div>
          <ConfidenceDot level={n.confidence} />
          {n.affected_assets.slice(0, 3).map(a => (
            <span key={a} className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-mono">{a}</span>
          ))}
        </div>
        <span className="text-gray-600 text-xs">
          {new Date(n.published_at).toLocaleDateString('tr-TR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const [news, setNews]         = useState<NewsSignal[]>([]);
  const [calendar, setCalendar] = useState<MarketCalendarEvent[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetchedRef = useRef(false);

  const loadData = useCallback(async (isManual = false) => {
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
      // mevcut veriyi koru
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    loadData();
  }, [loadData]);

  const filtered = selectedCategory === 'Tümü'
    ? news
    : news.filter(n => n.category === selectedCategory);

  return (
    <div className="p-6 space-y-6">

      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Newspaper size={20} className="text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">NLP Haberler</h1>
            <span className="text-[10px] px-2 py-0.5 bg-cyan-900/30 text-cyan-400 border border-cyan-800/30 rounded font-bold">
              GeopoliticalNewsAgent
            </span>
          </div>
          <p className="text-gray-400 text-sm">
            {loading
              ? 'AI pipeline çalışıyor…'
              : selectedCategory === 'Tümü'
                ? `${filtered.length} haber · NLP sınıflandırıldı · Gemini AI yorumlandı`
                : `${filtered.length} haber (toplam ${news.length}) · ${selectedCategory}`
            }
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Yenileniyor…' : 'Yenile'}
          </button>
          <div className="text-xs text-amber-600 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
            ⚠ Yatırım tavsiyesi değildir
          </div>
        </div>
      </div>

      {/* Piyasa Takvimi */}
      {!loading && calendar.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={15} className="text-blue-400" />
            <h2 className="font-semibold text-white text-sm">Piyasa Takvimi</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {calendar.map(event => <CalendarCard key={event.id} event={event} />)}
          </div>
        </div>
      )}

      {/* Kategori filtresi */}
      {!loading && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {NEWS_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* İçerik alanı */}
      {loading ? (
        <LoadingSlideshow />
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          Bu kategoride haber bulunamadı.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(n => <NewsCard key={n.id} news={n} />)}
        </div>
      )}
    </div>
  );
}
