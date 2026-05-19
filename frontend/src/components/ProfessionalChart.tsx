/**
 * ProfessionalChart — TradingView Lightweight Charts tabanlı profesyonel finans grafiği
 * Özellikler:
 *  - Mum grafik (candlestick)
 *  - Hacim histogramı (volume bars)
 *  - Hareketli ortalama çizgileri (MA20 sarı, MA50 mor)
 *  - OHLCV tooltip (crosshair üzerinde)
 *  - 1D / 1W / 1M / 3M / 1Y periyot seçimi
 *  - Karanlık tema (uygulamayla uyumlu)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from 'lightweight-charts';
import { Loader, AlertCircle, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { fetchMarketHistory } from '../services/api';
import type { CandleData } from '../types';

// ── Sabitler ─────────────────────────────────────────────────────────────────────

const PERIODS = [
  { key: '1D' as const, label: '1G' },
  { key: '1W' as const, label: '1H' },
  { key: '1M' as const, label: '1A' },
  { key: '3M' as const, label: '3A' },
  { key: '1Y' as const, label: '1Y' },
];

const CHART_COLORS = {
  bg:          '#111827',
  grid:        '#1f2937',
  text:        '#6b7280',
  border:      '#1f2937',
  upCandle:    '#22c55e',
  downCandle:  '#ef4444',
  upVolume:    'rgba(34,197,94,0.25)',
  downVolume:  'rgba(239,68,68,0.25)',
  ma20:        '#f59e0b',
  ma50:        '#8b5cf6',
  crosshair:   '#374151',
};

// ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────────

function calcMA(candles: CandleData[], period: number): { time: Time; value: number }[] {
  if (candles.length < period) return [];
  return candles.slice(period - 1).map((_, i) => {
    const slice = candles.slice(i, i + period);
    const avg = slice.reduce((s, c) => s + c.close, 0) / period;
    return { time: candles[i + period - 1].time as Time, value: avg };
  });
}

function fmtPrice(v: number): string {
  if (v >= 1_000_000) return `₺${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `₺${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
  if (v >= 1)         return `₺${v.toFixed(4)}`;
  return `₺${v.toFixed(6)}`;
}

function fmtVolume(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)         return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ── Bileşen ─────────────────────────────────────────────────────────────────────

interface Props {
  symbol: string;
  assetName: string;
  currentPrice: number;
  changePct24h: number;
  isMock?: boolean;
}

interface HoveredOHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function ProfessionalChart({ symbol, assetName, currentPrice, changePct24h, isMock }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const candleRef    = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const [period, setPeriod] = useState<'1D' | '1W' | '1M' | '3M' | '1Y'>('1M');
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [hovered, setHovered] = useState<HoveredOHLCV | null>(null);

  // ── Veri yükle ────────────────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchMarketHistory(symbol, period);
      setCandles(res.candles ?? []);
    } catch {
      setError('Geçmiş fiyat verisi yüklenemedi');
      setCandles([]);
    } finally {
      setLoading(false);
    }
  }, [symbol, period]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── Grafik oluştur / güncelle ─────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    // Önceki grafiği temizle
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      candleRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.bg },
        textColor: CHART_COLORS.text,
        fontSize: 11,
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid, style: 1 },
        horzLines: { color: CHART_COLORS.grid, style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: CHART_COLORS.crosshair,
          labelBackgroundColor: '#374151',
          width: 1,
          style: 1,
        },
        horzLine: {
          color: CHART_COLORS.crosshair,
          labelBackgroundColor: '#374151',
          width: 1,
          style: 1,
        },
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
        scaleMargins: { top: 0.08, bottom: 0.28 },
        autoScale: true,
      },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: period === '1D' || period === '1W',
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 2,
      },
      handleScroll: true,
      handleScale:  true,
      width:  containerRef.current.clientWidth,
      height: 420,
    });

    chartRef.current = chart;

    // ── Mum serisi ──────────────────────────────────────────────────────────────
    const candleSeries = chart.addCandlestickSeries({
      upColor:        CHART_COLORS.upCandle,
      downColor:      CHART_COLORS.downCandle,
      borderVisible:  false,
      wickUpColor:    CHART_COLORS.upCandle,
      wickDownColor:  CHART_COLORS.downCandle,
    });
    candleRef.current = candleSeries;

    const candleData: CandlestickData[] = candles.map(c => ({
      time:  c.time as Time,
      open:  c.open,
      high:  c.high,
      low:   c.low,
      close: c.close,
    }));
    candleSeries.setData(candleData);

    // ── Hacim histogramı ────────────────────────────────────────────────────────
    const volumeSeries = chart.addHistogramSeries({
      priceFormat:  { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });
    const volData = candles.map(c => ({
      time:  c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? CHART_COLORS.upVolume : CHART_COLORS.downVolume,
    }));
    volumeSeries.setData(volData);

    // ── MA 20 (sarı) ────────────────────────────────────────────────────────────
    if (candles.length >= 20) {
      const ma20 = chart.addLineSeries({
        color:                CHART_COLORS.ma20,
        lineWidth:            1,
        priceLineVisible:     false,
        lastValueVisible:     true,
        crosshairMarkerVisible: false,
        title: 'MA20',
      });
      ma20.setData(calcMA(candles, 20));
    }

    // ── MA 50 (mor) ─────────────────────────────────────────────────────────────
    if (candles.length >= 50) {
      const ma50 = chart.addLineSeries({
        color:                CHART_COLORS.ma50,
        lineWidth:            1,
        priceLineVisible:     false,
        lastValueVisible:     true,
        crosshairMarkerVisible: false,
        title: 'MA50',
      });
      ma50.setData(calcMA(candles, 50));
    }

    // ── Crosshair tooltip aboneliği ─────────────────────────────────────────────
    const volByTime = new Map(candles.map(c => [c.time, c.volume]));

    chart.subscribeCrosshairMove(param => {
      if (!param.time || !param.seriesData.has(candleSeries)) {
        setHovered(null);
        return;
      }
      const d = param.seriesData.get(candleSeries) as CandlestickData;
      if (!d) { setHovered(null); return; }
      setHovered({
        time:   param.time as number,
        open:   d.open,
        high:   d.high,
        low:    d.low,
        close:  d.close,
        volume: volByTime.get(param.time as number) ?? 0,
      });
    });

    // ── Resize handler ──────────────────────────────────────────────────────────
    const onResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
    };
  }, [candles, period]);

  // ── Özet istatistikler ─────────────────────────────────────────────────────────
  const lastCandle  = candles[candles.length - 1];
  const firstCandle = candles[0];
  const periodPct   = firstCandle && lastCandle
    ? ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100
    : null;
  const isUp = changePct24h >= 0;
  const dispCandle = hovered ?? lastCandle;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* ── Başlık & fiyat ────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-gray-400 text-xs mb-0.5">{symbol}</p>
          <p className="text-white font-bold text-2xl leading-tight">{fmtPrice(currentPrice)}</p>
          <span className={`text-sm font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            {isUp ? <TrendingUp className="inline w-3 h-3 mr-0.5" /> : <TrendingDown className="inline w-3 h-3 mr-0.5" />}
            {isUp ? '+' : ''}{changePct24h.toFixed(2)}% (24s)
          </span>
          {periodPct !== null && (
            <span className={`ml-3 text-xs ${periodPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              Dönem: {periodPct >= 0 ? '+' : ''}{periodPct.toFixed(2)}%
            </span>
          )}
        </div>

        {/* Periyot butonları */}
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                period === p.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── OHLCV tooltip satırı ────────────────────────────────────────────────── */}
      {dispCandle && !loading && (
        <div className="px-5 pb-2 flex flex-wrap gap-4 text-xs text-gray-500 border-b border-gray-800">
          {hovered && (
            <span className="text-gray-400">{fmtTime(hovered.time)}</span>
          )}
          <span>A: <span className="text-white">{fmtPrice(dispCandle.open)}</span></span>
          <span>Y: <span className="text-green-400">{fmtPrice(dispCandle.high)}</span></span>
          <span>D: <span className="text-red-400">{fmtPrice(dispCandle.low)}</span></span>
          <span>K: <span className="text-white">{fmtPrice(dispCandle.close)}</span></span>
          <span>Hacim: <span className="text-gray-300">{fmtVolume(dispCandle.volume)}</span></span>
          {dispCandle.open > 0 && (
            <span className={dispCandle.close >= dispCandle.open ? 'text-green-400' : 'text-red-400'}>
              {((dispCandle.close - dispCandle.open) / dispCandle.open * 100).toFixed(2)}%
            </span>
          )}
          <span className="ml-auto text-gray-700 hidden md:block">
            <span className="text-yellow-500">─</span> MA20 &nbsp;
            <span className="text-purple-400">─</span> MA50
          </span>
        </div>
      )}

      {/* ── Grafik alanı ───────────────────────────────────────────────────────── */}
      <div className="relative min-h-[420px]">

        {/* Yükleniyor */}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/90">
            <div className="text-center space-y-3 px-6">
              <Loader size={32} className="animate-spin text-blue-400 mx-auto" />
              <p className="text-white text-sm font-medium">Grafik verisi çekiliyor…</p>
              <p className="text-gray-500 text-xs max-w-xs">
                Binance veya CoinGecko API'sından geçmiş fiyatlar alınıyor.
                Bu işlem birkaç saniye sürebilir.
              </p>
              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-600">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Hata */}
        {error && !loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/90">
            <div className="text-center px-8 space-y-3">
              <AlertCircle size={32} className="text-yellow-400 mx-auto" />
              <p className="text-white text-sm font-medium">Grafik şu an yüklenemiyor</p>
              <p className="text-gray-400 text-xs max-w-xs">
                Harici API geçici olarak yanıt vermiyor olabilir.
                Fiyat kartı yukarıda günceldir.
              </p>
              <button
                onClick={loadHistory}
                className="flex items-center gap-2 mx-auto mt-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
              >
                <RefreshCw size={12} /> Tekrar dene
              </button>
            </div>
          </div>
        )}

        {/* Veri yok (loading bitti, hata yok, mum da yok) */}
        {candles.length === 0 && !loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-8 space-y-3">
              <AlertCircle size={28} className="text-gray-600 mx-auto" />
              <p className="text-gray-400 text-sm">Geçmiş veri henüz alınamadı</p>
              <p className="text-gray-600 text-xs max-w-xs">
                API yavaş yanıt vermiş olabilir. Birkaç saniye bekleyip tekrar deneyin.
              </p>
              <button
                onClick={loadHistory}
                className="flex items-center gap-2 mx-auto px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
              >
                <RefreshCw size={12} /> Tekrar dene
              </button>
            </div>
          </div>
        )}

        {/* lightweight-charts render hedefi */}
        <div ref={containerRef} className="w-full" />
      </div>

      {/* ── Alt bilgi ──────────────────────────────────────────────────────────── */}
      <div className="px-5 py-2 flex items-center justify-between text-xs text-gray-700 border-t border-gray-800">
        <span>
          {symbol in { BTC: 1, ETH: 1, SOL: 1, BNB: 1, XRP: 1, PAXG: 1 }
            ? 'Kaynak: Binance klines API'
            : 'Kaynak: Yahoo Finance'}
          {isMock && ' · Mock veri'}
        </span>
        {candles.length > 0 && (
          <span>{candles.length} mum · {PERIODS.find(p => p.key === period)?.label} periyot</span>
        )}
      </div>
    </div>
  );
}
