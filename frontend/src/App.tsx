import { useState, useCallback, useEffect, useRef } from 'react'
import type { AnalysisState, FullAnalysisResponse, MarketData, NewsSignal } from './types'
import { runFullAnalysisStream, runFullAnalysis, fetchMarketData, fetchNewsSignals } from './services/api'

import Sidebar, { type Section } from './components/Sidebar'
import TopBar from './components/TopBar'
import MarketCards from './components/MarketCards'
import TradingChart from './components/TradingChart'
import AIPanel from './components/AIPanel'
import NewsSignals from './components/NewsSignals'
import ScenarioTabs from './components/ScenarioTabs'
import WatchlistTable from './components/WatchlistTable'
import AnalysisChat from './components/AnalysisChat'

const SECTION_TITLES: Record<Section, string> = {
  dashboard:  'Genel Bakış',
  market:     'Piyasa',
  signals:    'Sinyaller',
  analysis:   'AI Asistan',
  scenarios:  'Senaryolar',
  simulation: 'Simülasyon',
  news:       'Haberler',
  watchlist:  'Takip Listesi',
  settings:   'Ayarlar',
}

export default function App() {
  const [state,   setState]   = useState<AnalysisState>({ status: 'idle' })
  const [section, setSection] = useState<Section>('dashboard')

  const [liveMarket,       setLiveMarket]       = useState<MarketData | null>(null)
  const [liveSignals,      setLiveSignals]      = useState<NewsSignal[]>([])
  const [marketLoading,    setMarketLoading]    = useState(true)
  const [newsLoading,      setNewsLoading]      = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  // Market verisi: hızlı, bağımsız, 30s'de bir güncelle
  useEffect(() => {
    let cancelled = false
    const loadMarket = async () => {
      try {
        const market = await fetchMarketData()
        if (!cancelled) { setLiveMarket(market); setMarketLoading(false) }
      } catch {
        if (!cancelled) setMarketLoading(false)
      }
    }
    loadMarket()
    const t = setInterval(loadMarket, 30_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  // Haberler: yavaş (Gemini), ayrı yükle — market'i bloklama, 5dk'da bir yenile
  useEffect(() => {
    let cancelled = false
    const loadNews = async () => {
      try {
        const newsResp = await fetchNewsSignals()
        if (!cancelled) { setLiveSignals(newsResp.signals ?? []); setNewsLoading(false) }
      } catch {
        if (!cancelled) setNewsLoading(false)
      }
    }
    loadNews()
    const t = setInterval(loadNews, 300_000)  // 5 dakika
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  const isLoading = state.status === 'loading'
  const data: FullAnalysisResponse | null = state.status === 'success' ? state.data : null

  // Analiz varsa analiz verisini göster; yoksa canlı veriyi kullan
  // NOT: stream event'ten gelen market_data liveMarket'i ezmez — ayrı tutar
  const marketData  = data?.market_data  ?? liveMarket
  const newsSignals = data?.news_signals?.length ? data.news_signals : liveSignals

  const handleAnalyze = useCallback(async (message: string) => {
    // Önceki isteği iptal et
    abortRef.current?.abort()
    const abortCtrl = new AbortController()
    abortRef.current = abortCtrl

    setState({ status: 'loading', step: 'Başlatılıyor…' })

    try {
      let partial: Partial<FullAnalysisResponse> = {}

      await runFullAnalysisStream(
        message,
        (event) => {
          if (abortCtrl.signal.aborted) return

          if (event.type === 'step') {
            setState({ status: 'loading', step: event.data.step })

          } else if (event.type === 'market_data') {
            // liveMarket'i ETME — kendi periyodik döngüsü var, çakışır
            partial = { ...partial, market_data: event.data }

          } else if (event.type === 'news_signals') {
            partial = { ...partial, news_signals: event.data }

          } else if (event.type === 'goal_analysis') {
            partial = { ...partial, goal_analysis: event.data }

          } else if (event.type === 'assistant_analysis') {
            partial = { ...partial, assistant_analysis: event.data }
            console.log('[app] assistant_analysis state\'e eklendi, goal_analysis:', !!partial.goal_analysis, 'market_data:', !!partial.market_data)
            // AI analizi hazır — yeterli partial veri varsa hemen göster (complete'i bekleme)
            if (partial.goal_analysis && partial.market_data && partial.simulation) {
              console.log('[app] assistant_analysis ile erken success state set ediliyor')
              setState({
                status: 'success',
                data: {
                  ...partial,
                  assistant_analysis: event.data,
                  news_signals: partial.news_signals ?? [],
                  asset_impact_map: partial.asset_impact_map ?? [],
                  simulation: partial.simulation,
                  agent_flow: [],
                  natural_response: '',
                  disclaimer: '',
                  generated_at: new Date().toISOString(),
                } as FullAnalysisResponse,
              })
            }

          } else if (event.type === 'complete') {
            setState({ status: 'success', data: event.data })

          } else if (event.type === 'error') {
            setState({ status: 'error', message: event.data.message })
          }
        },
        abortCtrl.signal,
      )
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      // Stream başarısız olduysa (404 veya network) eski endpoint'e fallback
      try {
        setState({ status: 'loading', step: 'Analiz yapılıyor…' })
        const result = await runFullAnalysis(message)
        setState({ status: 'success', data: result })
      } catch (fallbackErr) {
        const msg = fallbackErr instanceof Error ? fallbackErr.message : 'Backend bağlantısı kurulamadı.'
        setState({ status: 'error', message: msg })
      }
    }
  }, [])

  const handleNavigate = (s: Section) => setSection(s)

  function renderContent() {
    // ── AI Asistan (tamamen ayrı sayfa) ──────────────────────────
    if (section === 'analysis') {
      return (
        <AnalysisChat
          onAnalyze={handleAnalyze}
          isLoading={isLoading}
          loadingStep={state.status === 'loading' ? state.step : undefined}
          data={data}
          error={state.status === 'error' ? state.message : undefined}
          onDismissError={() => setState({ status: 'idle' })}
        />
      )
    }

    // ── Dashboard ────────────────────────────────────────────────
    if (section === 'dashboard') {
      return (
        <div className="space-y-4">
          <div className="t-card p-0 overflow-hidden">
            <MarketCards data={marketData} isLoading={marketLoading && !marketData} />
          </div>
          <div className="flex gap-4">
            <div className="flex-1 min-w-0">
              <TradingChart marketData={marketData} />
            </div>
            <AIPanel data={data} isLoading={isLoading} />
          </div>
          <NewsSignals signals={newsSignals} isLoading={newsLoading && newsSignals.length === 0} />
        </div>
      )
    }

    // ── Piyasa ───────────────────────────────────────────────────
    if (section === 'market') {
      return (
        <div className="space-y-4">
          <div className="t-card p-0 overflow-hidden">
            <MarketCards data={marketData} isLoading={marketLoading && !marketData} />
          </div>
          <TradingChart marketData={marketData} />
        </div>
      )
    }

    // ── Canlı Sinyaller ──────────────────────────────────────────
    if (section === 'signals') {
      return (
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <NewsSignals signals={newsSignals} isLoading={newsLoading && newsSignals.length === 0} />
          </div>
          <AIPanel data={data} isLoading={isLoading} />
        </div>
      )
    }

    // ── Senaryolar / Simülasyon ───────────────────────────────────
    if (section === 'scenarios' || section === 'simulation') {
      return (
        <div className="space-y-4">
          {!data && (
            <div
              className="p-5 rounded-lg text-center"
              style={{ background: '#0f1929', border: '1px solid #1a2535' }}
            >
              <p className="text-sm text-slate-400">Senaryo görmek için önce AI Asistan'dan analiz başlatın.</p>
              <button
                onClick={() => setSection('analysis')}
                className="t-btn-primary text-xs mt-3 px-4 py-2"
              >
                AI Asistan'a Git →
              </button>
            </div>
          )}
          <ScenarioTabs portfolio={data?.simulation} isLoading={isLoading} />
        </div>
      )
    }

    // ── Haberler ─────────────────────────────────────────────────
    if (section === 'news') {
      return <NewsSignals signals={newsSignals} isLoading={newsLoading && newsSignals.length === 0} />
    }

    // ── Takip Listesi ────────────────────────────────────────────
    if (section === 'watchlist') {
      return <WatchlistTable data={marketData} impacts={data?.asset_impact_map} />
    }

    // ── Ayarlar ──────────────────────────────────────────────────
    if (section === 'settings') {
      return (
        <div className="t-card-md space-y-4 max-w-lg">
          <div className="panel-header -mx-4 -mt-4 mb-4 px-4">
            <span className="panel-title">Ayarlar</span>
          </div>
          <div className="space-y-2 text-xs text-slate-400">
            {[
              ['Backend',       'localhost:8001'],
              ['Kripto Kaynağı','Binance'],
              ['Döviz Kaynağı', 'TCMB XML'],
              ['Hisse Kaynağı', 'Yahoo Finance'],
              ['Haber Kaynağı', 'BBC / Reuters / Yahoo'],
              ['AI Motoru',     'AI Finansal Asistan'],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between p-3 rounded-md"
                style={{ background: '#0c1320', border: '1px solid #1a2535' }}
              >
                <span>{k}</span>
                <span className="font-mono text-slate-300 text-right">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#070c15' }}>
      <Sidebar active={section} onNavigate={handleNavigate} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar
          marketData={marketData}
          lastUpdated={data?.generated_at ?? liveMarket?.fetched_at}
          isLive={!!liveMarket}
          onOpenAnalysis={() => setSection('analysis')}
        />

        <main className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xs text-slate-700">Terminal</span>
            <span className="text-2xs text-slate-700">/</span>
            <span className="text-2xs font-semibold text-accent-cyan">{SECTION_TITLES[section]}</span>
          </div>

          {renderContent()}

          <div className="mt-8 pt-4 border-t border-t-border text-center">
            <p className="text-2xs text-slate-700">
              Piyasa Nabzı AI · Simülasyon · Yatırım tavsiyesi değildir
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
