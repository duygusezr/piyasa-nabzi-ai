import axios from 'axios'
import type {
  FullAnalysisResponse, MarketData, NewsSignal,
  GoalAnalysis, AssistantAnalysis,
} from '../types'

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 90_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Streaming tipleri ──────────────────────────────────────────────────────────
export type StreamEvent =
  | { type: 'step';               data: { step: string } }
  | { type: 'market_data';        data: MarketData }
  | { type: 'goal_analysis';      data: GoalAnalysis }
  | { type: 'news_signals';       data: NewsSignal[] }
  | { type: 'assistant_analysis'; data: AssistantAnalysis }
  | { type: 'complete';           data: FullAnalysisResponse }
  | { type: 'error';              data: { message: string } }

/**
 * SSE streaming analiz — her adım hazır olduğunda `onEvent` callback'i çalışır.
 * market_data ~2s, goal_analysis ~4s, news_signals ~18s, assistant_analysis ~10s
 */
export async function runFullAnalysisStream(
  message: string,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/full-analysis-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''           // son yarım satırı sakla

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const event = JSON.parse(line.slice(6)) as StreamEvent
        // DEBUG: hangi event'in geldiğini ve içeriğini logla
        if (event.type === 'assistant_analysis') {
          const d = event.data as Record<string, unknown>
          console.log('[stream] assistant_analysis alindi:', {
            directAnswerLen: (d.directAnswer as string)?.length ?? 0,
            scenarioCount:   (d.scenarios  as unknown[])?.length ?? 0,
            assetsCount:     (d.affectedAssets as unknown[])?.length ?? 0,
          })
        } else {
          console.log('[stream] event:', event.type)
        }
        onEvent(event)
      } catch (parseErr) {
        console.error('[stream] JSON parse hatasi:', parseErr, '| satir:', line.slice(6, 100))
      }
    }
  }
}

// ── Eski tek-seferlik endpoint (geriye dönük uyumluluk) ───────────────────────
export async function runFullAnalysis(message: string): Promise<FullAnalysisResponse> {
  const { data } = await client.post<FullAnalysisResponse>('/api/full-analysis', { message })
  return data
}

export async function fetchMarketData(): Promise<MarketData> {
  const { data } = await client.get<MarketData>('/api/market-data')
  return data
}

export async function fetchNewsSignals(): Promise<{ signals: NewsSignal[]; count: number }> {
  const { data } = await client.get('/api/news-signals')
  return data
}

export async function analyzeGoal(message: string) {
  const { data } = await client.post('/api/analyze-goal', { message })
  return data
}
