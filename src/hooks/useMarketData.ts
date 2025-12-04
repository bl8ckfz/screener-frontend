import { useEffect, useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStore } from './useStore'
import { BinanceFuturesApiClient } from '@/services/binanceFuturesApi'
import { BinanceApiClient } from '@/services/binanceApi'
import { processTickersForPair } from '@/services/dataProcessor'
import { applyTechnicalIndicators } from '@/utils/indicators'
import { USE_MOCK_DATA, getMockDataWithVariations } from '@/services/mockData'
import { isTabVisible, onVisibilityChange } from '@/utils/performance'
import { evaluateAlertRules } from '@/services/alertEngine'
import { showCryptoAlertNotification, getNotificationPermission } from '@/services/notification'
import { audioNotificationService } from '@/services/audioNotification'
import { sendDiscordWebhook, sendToWebhooks } from '@/services/webhookService'
import type { Coin } from '@/types/coin'
import type { Alert } from '@/types/alert'
import type { FuturesMetrics } from '@/types/api'

// Initialize Futures API client
const futuresApi = new BinanceFuturesApiClient()

// Singleton guard to ensure alert evaluation only runs once per data update
// Tracks the last query data timestamp to prevent duplicate evaluations
let lastAlertEvaluationTimestamp = 0
let isEvaluatingAlerts = false

// Klines caching: Since smallest alert timeframe is 5 minutes, no need to fetch more frequently
// This reduces API calls by ~83% (from 1,800 to 302 calls/minute)
let lastKlinesUpdate = 0
const cachedKlinesMetrics = new Map<string, FuturesMetrics>()
const KLINES_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds

/**
 * Fetch and process market data for current currency pair with smart polling
 */
export function useMarketData() {
  const refreshInterval = useStore((state) => state.refreshInterval)
  const autoRefresh = useStore((state) => state.autoRefresh)
  
  // Watchlist filtering
  const currentWatchlistId = useStore((state) => state.currentWatchlistId)
  const watchlists = useStore((state) => state.watchlists)
  
  // Alert system integration
  const alertRules = useStore((state) => state.alertRules)
  const alertSettings = useStore((state) => state.alertSettings)
  const addAlert = useStore((state) => state.addAlert)
  
  // Track recent alerts to prevent spam (symbol -> last alert timestamp)
  const recentAlerts = useRef<Map<string, number>>(new Map())

  // Track tab visibility for smart polling
  const [isVisible, setIsVisible] = useState(isTabVisible())

  useEffect(() => {
    // Listen for tab visibility changes
    const cleanup = onVisibilityChange((visible) => {
      setIsVisible(visible)
      if (visible) {
        console.log('Tab visible - resuming data refresh')
      } else {
        console.log('Tab hidden - pausing data refresh')
      }
    })

    return cleanup
  }, [])

  // Store previous coins data outside query
  const previousCoinsRef = useRef<Coin[]>([])

  // Query for market data
  const query = useQuery({
    queryKey: ['marketData', 'USDT', currentWatchlistId],
    queryFn: async (): Promise<Coin[]> => {
      // Use mock data if enabled, otherwise fetch from Binance Futures API
      let tickers
      if (USE_MOCK_DATA) {
        console.log('Using mock data with variations for alert testing')
        tickers = getMockDataWithVariations()
      } else {
        try {
          // Fetch from Futures API instead of Spot API
          tickers = await futuresApi.fetch24hrTickers()
          console.log(`✅ Fetched ${tickers.length} futures tickers`)
        } catch (error) {
          console.warn(
            'Failed to fetch from Binance Futures API, falling back to mock data:',
            error
          )
          tickers = getMockDataWithVariations()
        }
      }

      // Parse to numeric values
      const processedTickers = BinanceApiClient.parseTickerBatch(tickers)

      // Convert to Coin objects (all are USDT pairs now)
      let coins = processTickersForPair(processedTickers)

      // Apply technical indicators (VCP, Fibonacci, etc.)
      coins = applyTechnicalIndicators(coins)

      // Attach cached futures metrics immediately (non-blocking)
      // This ensures market data list and summary don't wait for klines
      coins = coins.map(coin => {
        const metrics = cachedKlinesMetrics.get(coin.fullSymbol)
        return metrics ? { ...coin, futuresMetrics: metrics } : coin
      })

      // Filter by watchlist if one is selected
      if (currentWatchlistId) {
        const selectedWatchlist = watchlists.find((wl) => wl.id === currentWatchlistId)
        if (selectedWatchlist) {
          coins = coins.filter((coin) => selectedWatchlist.symbols.includes(coin.symbol))
        }
      }

      // Save coins for next fetch (no longer need history preservation)
      previousCoinsRef.current = coins

      return coins
    },
    staleTime: (refreshInterval * 1000) / 2, // Half of refresh interval
    // Smart polling: only refetch when tab is visible AND user is authenticated
    refetchInterval: autoRefresh && isVisible ? refreshInterval * 1000 : false,
    refetchOnWindowFocus: false, // Disable refetch on focus to prevent auth disruption
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  // Fetch klines data in background (non-blocking)
  // This runs separately from the main query to avoid delaying market data display
  // Aligned to 5-minute boundaries (00, 05, 10, 15, 20, ...) for fresh candle data
  useEffect(() => {
    if (!query.data) {
      return
    }

    const symbols = query.data.map(coin => coin.fullSymbol)
    const now = Date.now()
    const currentDate = new Date(now)
    const currentMinute = currentDate.getMinutes()
    
    // Calculate the last 5-minute boundary
    const lastBoundaryMinute = Math.floor(currentMinute / 5) * 5
    const lastBoundary = new Date(currentDate)
    lastBoundary.setMinutes(lastBoundaryMinute, 0, 0) // Set to boundary with 0 seconds/ms
    const lastBoundaryTimestamp = lastBoundary.getTime()
    
    // Check if we've already fetched for this boundary
    const alreadyFetchedForBoundary = lastKlinesUpdate >= lastBoundaryTimestamp
    
    // Debug logging
    if (import.meta.env.DEV || window.location.search.includes('debug')) {
      const currentTime = currentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      const boundaryTime = lastBoundary.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      console.log(`⏱️  Boundary check at ${currentTime}: current=${currentMinute}min, boundary=${lastBoundaryMinute}min (${boundaryTime}), already fetched=${alreadyFetchedForBoundary}`)
    }
    
    if (alreadyFetchedForBoundary) {
      // Already fetched for current 5-min window, skip
      return
    }

    // Fetch klines asynchronously (doesn't block UI)
    ;(async () => {
      try {
        const boundaryTime = lastBoundary.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        const lastFetchedTime = lastKlinesUpdate > 0 
          ? new Date(lastKlinesUpdate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : 'never'
        console.log(`🔄 Fetching fresh klines data for ${boundaryTime} boundary (last fetch: ${lastFetchedTime})`)
        const { futuresMetricsService } = await import('@/services/futuresMetricsService')
        
        const metricsArray = await futuresMetricsService.fetchMultipleSymbolMetrics(
          symbols,
          (progress) => {
            if (progress.completed % 10 === 0) {
              console.log(`📊 Fetched metrics: ${progress.completed}/${progress.total}`)
            }
          },
          { skipMarketCap: true } // Skip CoinGecko calls - market cap not needed for alerts
        )

        // Update cache with boundary timestamp
        lastKlinesUpdate = lastBoundaryTimestamp
        cachedKlinesMetrics.clear()
        metricsArray.forEach(metrics => {
          cachedKlinesMetrics.set(metrics.symbol, metrics)
        })

        console.log(`✅ Cached ${metricsArray.length} futures metrics for ${boundaryTime} boundary`)
        
        // Trigger query refetch to:
        // 1. Attach new metrics to coins
        // 2. Trigger alert evaluation effect (dataUpdatedAt changes)
        query.refetch()
      } catch (error) {
        console.warn('Failed to fetch/cache futures metrics in background:', error)
      }
    })()
  }, [query.data, query.dataUpdatedAt, query.refetch])

  // Evaluate alerts when data is successfully fetched
  // IMPORTANT: This effect may run in multiple component instances,
  // so we use module-level guards to ensure alerts are only evaluated once
  useEffect(() => {
    if (!query.data || !alertSettings.enabled || alertRules.length === 0) {
      return
    }

    const coins = query.data
    const now = Date.now()
    
    // Guard: Only evaluate if this is a new data update
    // query.dataUpdatedAt is the timestamp from TanStack Query
    const dataTimestamp = query.dataUpdatedAt || 0
    
    if (dataTimestamp <= lastAlertEvaluationTimestamp) {
      // Already evaluated for this data update
      return
    }
    
    // Guard: Prevent concurrent evaluations
    if (isEvaluatingAlerts) {
      return
    }
    
    // Mark as evaluating and update timestamp
    isEvaluatingAlerts = true
    lastAlertEvaluationTimestamp = dataTimestamp

    // Derive market mode from aggregate momentum (simple heuristic)
    // Average priceChangePercent across top 10 quoteVolume coins
    try {
      const sortedByVolume = [...coins].sort((a, b) => b.quoteVolume - a.quoteVolume)
      const sample = sortedByVolume.slice(0, Math.min(10, sortedByVolume.length))
      const avgMomentum = sample.reduce((sum, c) => sum + c.priceChangePercent, 0) / (sample.length || 1)
      const mode: 'bull' | 'bear' = avgMomentum >= 0 ? 'bull' : 'bear'
      const currentMode = useStore.getState().marketMode
      if (currentMode !== mode) {
        useStore.getState().setMarketMode(mode)
        console.log(`ℹ️ Market mode updated: ${mode} (avgMomentum=${avgMomentum.toFixed(2)}%)`)
      }
    } catch (e) {
      // Non-fatal
      console.warn('Market mode derivation failed', e)
    }

    // Check if we have futures metrics for alerts
    const coinsWithMetrics = coins.filter(c => c.futuresMetrics)
    const coinsWithMarketCap = coins.filter(c => c.futuresMetrics?.marketCap)
    
    if (coinsWithMetrics.length === 0) {
      console.log('⏳ Waiting for futures metrics to be fetched for alert evaluation')
      return
    }

    console.log(`📊 Alert evaluation: ${coinsWithMetrics.length}/${coins.length} coins with metrics (${coinsWithMarketCap.length} with market cap)`)

    // Filter to enabled rules only
    const enabledRules = alertRules.filter((rule) => rule.enabled)

    if (enabledRules.length === 0) {
      console.log('ℹ️ No enabled alert rules')
      return
    }

    console.log(`📋 Evaluating ${enabledRules.length} enabled alert rules...`)

    try {
      // Evaluate all rules against current coins
      const triggeredAlerts = evaluateAlertRules(coins, enabledRules, useStore.getState().marketMode)
      
      if (triggeredAlerts.length > 0) {
        console.log(`🔔 ${triggeredAlerts.length} alert(s) triggered`)
      }

      // Process each triggered alert
      for (const triggeredAlert of triggeredAlerts) {
        const { symbol } = triggeredAlert

        // Check cooldown to prevent spam
        const lastAlertTime = recentAlerts.current.get(symbol) || 0
        const cooldownMs = alertSettings.alertCooldown * 1000

        if (now - lastAlertTime < cooldownMs) {
          continue // Skip if in cooldown period
        }

        // Update cooldown tracker immediately to prevent batch duplicates
        recentAlerts.current.set(symbol, now)

        // Check max alerts per symbol
        const symbolAlertCount = Array.from(recentAlerts.current.entries()).filter(
          ([sym]) => sym === symbol
        ).length

        if (symbolAlertCount >= alertSettings.maxAlertsPerSymbol) {
          continue // Skip if reached max alerts for this symbol
        }

        // Create alert object
        const alert: Alert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          symbol,
          type: triggeredAlert.type,
          severity: triggeredAlert.severity,
          title: triggeredAlert.title,
          message: triggeredAlert.message,
          value: triggeredAlert.value,
          threshold: triggeredAlert.threshold,
          timeframe: triggeredAlert.timeframe,
          timestamp: now,
          read: false,
          dismissed: false,
        }

        // Find coin data for history
        const coin = coins.find(c => c.symbol === symbol)
        
        // Add to store (will trigger notification and save to history)
        addAlert(alert)
        
        // Save to alert history if we have coin data
        if (coin) {
          const addAlertToHistory = useStore.getState().addAlertToHistory
          addAlertToHistory(alert, coin)
        }

        // Map alert severity for notifications
        const notificationSeverity: 'info' | 'warning' | 'critical' = 
          alert.severity === 'critical' ? 'critical' :
          alert.severity === 'high' ? 'warning' : 'info'

        // Play sound notification if enabled
        if (alertSettings.soundEnabled) {
          audioNotificationService.playAlert(notificationSeverity)
        }

        // Show browser notification if enabled and permitted
        if (alertSettings.browserNotificationEnabled) {
          const permission = getNotificationPermission()
          if (permission === 'granted') {
            showCryptoAlertNotification({
              symbol: alert.symbol,
              title: alert.title,
              message: alert.message,
              severity: notificationSeverity,
              onClick: () => {
                // Focus window when notification clicked
                window.focus()
              },
            })
          }
        }

        // Send webhooks if enabled
        if (alertSettings.webhookEnabled) {
          // Use new multi-webhook system if webhooks configured
          if (alertSettings.webhooks && alertSettings.webhooks.length > 0) {
            sendToWebhooks(alertSettings.webhooks, alert).then((results) => {
              results.forEach((result, webhookId) => {
                if (result.success) {
                  console.log(`✅ Webhook ${webhookId} delivered (${result.attempts} attempts)`)
                } else {
                  console.error(`❌ Webhook ${webhookId} failed: ${result.error}`)
                }
              })
            }).catch((error) => {
              console.error('Webhook delivery error:', error)
            })
          }
          // Backwards compatibility: Legacy Discord webhook
          else if (alertSettings.discordWebhookUrl) {
            sendDiscordWebhook(alertSettings.discordWebhookUrl, alert).catch((error) => {
              console.error('Discord webhook delivery failed:', error)
            })
          }
        }

        // Cooldown already updated above after initial check
      }
    } catch (error) {
      console.error('Failed to evaluate alerts:', error)
    } finally {
      // Reset evaluation lock
      isEvaluatingAlerts = false
    }
  }, [query.data, query.dataUpdatedAt, alertRules, alertSettings, addAlert])

  return query
}

/**
 * Invalidate klines cache (useful for testing or forcing refresh)
 * Exported for use in components if needed
 */
export function invalidateKlinesCache(): void {
  lastKlinesUpdate = 0
  cachedKlinesMetrics.clear()
  console.log('🗑️ Klines cache invalidated')
}

/**
 * Get klines cache statistics (for debugging/monitoring)
 */
export function getKlinesCacheStats() {
  const now = Date.now()
  const currentDate = new Date(now)
  const currentMinute = currentDate.getMinutes()
  
  // Calculate next 5-minute boundary
  const nextBoundaryMinute = Math.ceil((currentMinute + 1) / 5) * 5
  const nextBoundary = new Date(currentDate)
  nextBoundary.setMinutes(nextBoundaryMinute, 0, 0)
  const timeUntilNextBoundary = nextBoundary.getTime() - now
  
  // Calculate last 5-minute boundary  
  const lastBoundaryMinute = Math.floor(currentMinute / 5) * 5
  const lastBoundary = new Date(currentDate)
  lastBoundary.setMinutes(lastBoundaryMinute, 0, 0)
  const lastBoundaryTimestamp = lastBoundary.getTime()
  
  const timeSinceUpdate = now - lastKlinesUpdate
  const isFetchedForCurrentBoundary = lastKlinesUpdate >= lastBoundaryTimestamp
  
  return {
    lastUpdate: lastKlinesUpdate,
    lastUpdateDate: new Date(lastKlinesUpdate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    cacheSize: cachedKlinesMetrics.size,
    cacheDurationMs: KLINES_CACHE_DURATION,
    timeSinceUpdateMs: timeSinceUpdate,
    timeUntilNextBoundaryMs: timeUntilNextBoundary,
    nextBoundaryTime: nextBoundary.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    isFetchedForCurrentBoundary,
    isExpired: !isFetchedForCurrentBoundary,
  }
}

/**
 * Get market statistics
 */
export function useMarketStats() {
  const { data: coins, isLoading } = useMarketData()

  if (isLoading || !coins) {
    return { isLoading, stats: null }
  }

  const bullishCoins = coins.filter((c) => c.priceChangePercent > 0)
  const bearishCoins = coins.filter((c) => c.priceChangePercent < 0)
  const neutralCoins = coins.filter((c) => c.priceChangePercent === 0)

  const totalCoins = coins.length
  const bullishCount = bullishCoins.length
  const bearishCount = bearishCoins.length
  const neutralCount = neutralCoins.length

  return {
    isLoading: false,
    stats: {
      totalCoins,
      bullishCount,
      bearishCount,
      neutralCount,
      bullishPercent: (bullishCount / totalCoins) * 100,
      bearishPercent: (bearishCount / totalCoins) * 100,
      neutralPercent: (neutralCount / totalCoins) * 100,
      sentiment:
        bullishCount > bearishCount
          ? ('bullish' as const)
          : bearishCount > bullishCount
            ? ('bearish' as const)
            : ('neutral' as const),
    },
  }
}

/**
 * Get klines cache statistics for debugging
 * Exposed to window for console access
 */
export function getKlinesFetchInfo() {
  const now = Date.now()
  const lastFetchDate = lastKlinesUpdate > 0 ? new Date(lastKlinesUpdate) : null
  const timeSinceLastFetch = lastKlinesUpdate > 0 ? now - lastKlinesUpdate : null
  
  const currentDate = new Date(now)
  const currentMinute = currentDate.getMinutes()
  const lastBoundaryMinute = Math.floor(currentMinute / 5) * 5
  const lastBoundary = new Date(currentDate)
  lastBoundary.setMinutes(lastBoundaryMinute, 0, 0)
  
  const nextBoundaryMinute = (lastBoundaryMinute + 5) % 60
  const nextBoundary = new Date(currentDate)
  nextBoundary.setMinutes(nextBoundaryMinute, 0, 0)
  if (nextBoundaryMinute < lastBoundaryMinute) {
    nextBoundary.setHours(nextBoundary.getHours() + 1)
  }
  const timeUntilNextBoundary = nextBoundary.getTime() - now
  
  return {
    currentTime: currentDate.toLocaleString(),
    lastFetchTime: lastFetchDate?.toLocaleString() || 'Never',
    timeSinceLastFetchMs: timeSinceLastFetch,
    timeSinceLastFetchMinutes: timeSinceLastFetch ? Math.floor(timeSinceLastFetch / 60000) : null,
    cachedSymbolsCount: cachedKlinesMetrics.size,
    currentBoundary: lastBoundary.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    nextBoundary: nextBoundary.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    timeUntilNextBoundarySeconds: Math.floor(timeUntilNextBoundary / 1000),
    shouldFetchNow: lastKlinesUpdate < lastBoundary.getTime(),
  }
}

// Expose to window for debugging in console
if (typeof window !== 'undefined') {
  (window as any).getKlinesFetchInfo = getKlinesFetchInfo
}
