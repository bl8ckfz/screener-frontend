import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStore } from './useStore'
import { BinanceApiClient } from '@/services/binanceApi'
import { processTickersForPair } from '@/services/dataProcessor'
import { applyTechnicalIndicators } from '@/utils/indicators'
import { USE_MOCK_DATA, getMockDataWithVariations } from '@/services/mockData'
import { evaluateAlertRules } from '@/services/alertEngine'
import { showCryptoAlertNotification, getNotificationPermission } from '@/services/notification'
import { audioNotificationService } from '@/services/audioNotification'
import { sendDiscordWebhook, sendToWebhooks } from '@/services/webhookService'
import type { Coin } from '@/types/coin'
import type { Alert } from '@/types/alert'
import type { FuturesMetrics } from '@/types/api'

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
 * @param wsMetricsMap - WebSocket streaming metrics from useFuturesStreaming
 * @param wsGetTickerData - Function to get live ticker data from WebSocket
 */
export function useMarketData(wsMetricsMap?: Map<string, any>, wsGetTickerData?: () => any[]) {
  
  // Watchlist filtering
  const currentWatchlistId = useStore((state) => state.currentWatchlistId)
  const watchlists = useStore((state) => state.watchlists)
  
  // Alert system integration
  const alertRules = useStore((state) => state.alertRules)
  const alertSettings = useStore((state) => state.alertSettings)
  const addAlert = useStore((state) => state.addAlert)
  
  // Track recent alerts to prevent spam (symbol -> last alert timestamp)
  const recentAlerts = useRef<Map<string, number>>(new Map())

  // Track if we've loaded WebSocket data
  const hasRefetchedForWebSocket = useRef(false)

  // Store previous coins data outside query
  const previousCoinsRef = useRef<Coin[]>([])

  // Query for market data
  const query = useQuery({
    queryKey: ['marketData', 'USDT', currentWatchlistId],
    queryFn: async (): Promise<Coin[]> => {
      // ALWAYS use WebSocket ticker data (no REST API calls!)
      let tickers
      
      if (USE_MOCK_DATA) {
        console.log('Using mock data with variations for alert testing')
        tickers = getMockDataWithVariations()
      } else if (wsGetTickerData) {
        // Use WebSocket ticker data (no API call!)
        tickers = wsGetTickerData()
        if (tickers && tickers.length > 0) {
          console.log(`✅ Using ${tickers.length} tickers from WebSocket stream`)
          
          // Warn if we don't have all symbols yet (ticker stream still populating)
          // Note: We'll still show partial data, it will update as more tickers arrive
          if (import.meta.env.DEV) {
            // Get expected count from second parameter if available
            // This is a bit of a hack since wsGetTickerData doesn't know about tracked count
            // In practice, the ticker data will quickly populate to full count
          }
        } else {
          // WebSocket not ready yet - return empty array, will populate when ready
          console.log('⏳ WebSocket not ready yet, waiting for ticker data...')
          tickers = []
        }
      } else {
        // No WebSocket available - return empty, WebSocket will be initialized soon
        console.log('⏳ Waiting for WebSocket initialization...')
        tickers = []
      }

      // Parse to numeric values - use futures parser for WebSocket data
      const processedTickers = BinanceApiClient.parseFuturesTickerBatch(tickers)

      // Convert to Coin objects (all are USDT pairs now)
      let coins = processTickersForPair(processedTickers)

      // Apply technical indicators (VCP, Fibonacci, etc.)
      coins = applyTechnicalIndicators(coins)

      // Attach WebSocket futures metrics (real-time)
      // Falls back to cached klines if WebSocket not available
      coins = coins.map(coin => {
        const metrics = wsMetricsMap?.get(coin.fullSymbol) || cachedKlinesMetrics.get(coin.fullSymbol)
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
    staleTime: Infinity, // Never consider data stale when using WebSocket
    // Disable automatic refetching when WebSocket is providing live data
    // Only refetch manually on mount or when explicitly needed
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  // Refetch when WebSocket ticker data becomes available, and keep refetching
  // until we have data for all symbols (ticker stream populates gradually)
  useEffect(() => {
    if (!wsGetTickerData) return

    const tickers = wsGetTickerData()
    if (tickers && tickers.length > 0) {
      if (!hasRefetchedForWebSocket.current) {
        console.log('🔄 WebSocket ticker data ready, loading market data...')
        hasRefetchedForWebSocket.current = true
        query.refetch()
        
        // Track last seen count to detect new symbols
        let lastSeenCount = tickers.length
        console.log(`🔍 Starting progressive polling with ${lastSeenCount} initial tickers...`)
        
        // If we don't have all symbols yet, refetch every 2 seconds until we do
        // This handles the case where ticker stream is still populating
        const intervalId = setInterval(() => {
          const currentTickers = wsGetTickerData()
          if (currentTickers && currentTickers.length > lastSeenCount) {
            console.log(`🔄 New symbols available (${currentTickers.length}), refreshing...`)
            lastSeenCount = currentTickers.length
            query.refetch()
          } else if (import.meta.env.DEV) {
            console.log(`🔍 Poll: Still ${currentTickers?.length || 0} tickers (no change)`)
          }
        }, 2000) // Check every 2 seconds
        
        // Cleanup after 30 seconds (by then, all tickers should be loaded)
        const cleanupTimeout = setTimeout(() => {
          clearInterval(intervalId)
          console.log('⏹️  Stopped polling for new symbols (30s timeout)')
        }, 30000)
        
        // Store cleanup functions for unmount
        return () => {
          clearInterval(intervalId)
          clearTimeout(cleanupTimeout)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsGetTickerData]) // Only depend on wsGetTickerData, not query

  // DISABLED: Fetch klines data in background (non-blocking)
  // Reason: Binance rate limits are too strict for klines fetching
  // Even with 200ms delays, still getting 418 errors
  // TODO: Re-enable when we have a backend proxy or better rate limit strategy
  /*
  useEffect(() => {
    if (!query.data) {
      return
    }

    // Fetch klines asynchronously (doesn't block UI)
    ;(async () => {
      try {
        // Get available Futures symbols (will use cache after first fetch)
        const futuresSymbols = await futuresApi.fetchAllFuturesSymbols()

        // Only fetch metrics for coins that have futures contracts
        const symbols = query.data
          .map(coin => coin.fullSymbol)
          .filter(symbol => futuresSymbols.includes(symbol))
        
        if (symbols.length === 0) {
          console.log('No matching futures symbols found for current coins')
          return
        }

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

        const boundaryTime = lastBoundary.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        const lastFetchedTime = lastKlinesUpdate > 0 
          ? new Date(lastKlinesUpdate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : 'never'
        console.log(`🔄 Fetching fresh klines data for ${boundaryTime} boundary (last fetch: ${lastFetchedTime})`)
        console.log(`📊 Filtering to ${symbols.length} futures symbols (from ${query.data.length} total coins)`)
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
  */

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

    const marketMode = useStore.getState().marketMode
    console.log(`📋 Evaluating ${enabledRules.length} enabled alert rules (market mode: ${marketMode})...`)
    
    // Debug: Log sample of metrics
    const sampleCoin = coinsWithMetrics[0]
    if (sampleCoin?.futuresMetrics) {
      console.log(`🔍 Sample metrics for ${sampleCoin.symbol}:`, {
        change_5m: sampleCoin.futuresMetrics.change_5m?.toFixed(2) + '%',
        change_15m: sampleCoin.futuresMetrics.change_15m?.toFixed(2) + '%',
        change_1h: sampleCoin.futuresMetrics.change_1h?.toFixed(2) + '%',
        volume_5m: '$' + (sampleCoin.futuresMetrics.volume_5m / 1000).toFixed(0) + 'K',
        volume_15m: '$' + (sampleCoin.futuresMetrics.volume_15m / 1000).toFixed(0) + 'K',
      })
    }

    try {
      // Evaluate all rules against current coins
      const triggeredAlerts = evaluateAlertRules(coins, enabledRules, marketMode)
      
      console.log(`✅ Alert evaluation complete: ${triggeredAlerts.length} alert(s) triggered`)
      
      if (triggeredAlerts.length > 0) {
        console.log(`🔔 Triggered alerts:`, triggeredAlerts.map(a => `${a.symbol} (${a.type})`))
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

  // Also evaluate alerts when WebSocket metrics update
  // This ensures alerts work even when query data isn't refetching
  // NOTE: We DON'T refetch query data - just re-attach metrics and evaluate
  useEffect(() => {
    if (!wsMetricsMap || wsMetricsMap.size === 0) {
      return
    }
    
    if (!query.data) {
      return
    }
    
    if (!alertSettings.enabled) {
      return
    }
    
    if (alertRules.length === 0) {
      return
    }
    
    const now = Date.now()
    
    // Throttle to max once per 5 seconds to avoid spam
    if (now - lastAlertEvaluationTimestamp < 5000) {
      return
    }
    
    console.log('🔄 WebSocket metrics updated, evaluating alerts with fresh data')
    
    // Re-attach WebSocket metrics to existing coins
    const coins = query.data.map(coin => {
      const metrics = wsMetricsMap.get(coin.fullSymbol)
      return metrics ? { ...coin, futuresMetrics: metrics } : coin
    })
    
    // Guard: Update timestamp
    isEvaluatingAlerts = true
    lastAlertEvaluationTimestamp = now
    
    try {
      // Update market mode
      const sortedByVolume = [...coins].sort((a, b) => b.quoteVolume - a.quoteVolume)
      const sample = sortedByVolume.slice(0, Math.min(10, sortedByVolume.length))
      const avgMomentum = sample.reduce((sum, c) => sum + c.priceChangePercent, 0) / (sample.length || 1)
      const marketMode: 'bull' | 'bear' = avgMomentum >= 0 ? 'bull' : 'bear'
      
      const coinsWithMetrics = coins.filter(c => c.futuresMetrics)
      console.log(`📊 WebSocket alert evaluation: ${coinsWithMetrics.length}/${coins.length} coins with metrics (market: ${marketMode})`)
      
      if (coinsWithMetrics.length === 0) {
        return
      }
      
      // Evaluate alerts
      const triggeredAlerts = evaluateAlertRules(coins, alertRules.filter(r => r.enabled), marketMode)
      
      console.log(`✅ WebSocket alert evaluation complete: ${triggeredAlerts.length} alert(s) triggered`)
      
      if (triggeredAlerts.length > 0) {
        console.log(`🔔 Triggered alerts:`, triggeredAlerts.map(a => `${a.symbol} (${a.type})`))
      }
      
      // Process triggered alerts (same logic as main effect)
      for (const triggeredAlert of triggeredAlerts) {
        const { symbol } = triggeredAlert
        
        // Check cooldown
        const lastAlertTime = recentAlerts.current.get(symbol) || 0
        const cooldownMs = alertSettings.alertCooldown * 1000
        
        if (now - lastAlertTime < cooldownMs) {
          continue
        }
        
        recentAlerts.current.set(symbol, now)
        
        // Create and add alert
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
        
        const coin = coins.find(c => c.symbol === symbol)
        addAlert(alert)
        
        if (coin) {
          const addAlertToHistory = useStore.getState().addAlertToHistory
          addAlertToHistory(alert, coin)
        }
        
        // Notifications (map alert severity to notification severity)
        const notificationSeverity: 'info' | 'warning' | 'critical' = 
          alert.severity === 'high' ? 'critical' :
          alert.severity === 'medium' ? 'warning' : 'info'
        
        if (alertSettings.soundEnabled) {
          audioNotificationService.playAlert(notificationSeverity)
        }
        
        if (alertSettings.browserNotificationEnabled) {
          const permission = getNotificationPermission()
          if (permission === 'granted') {
            showCryptoAlertNotification({
              symbol: alert.symbol,
              title: alert.title,
              message: alert.message,
              severity: notificationSeverity,
              onClick: () => window.focus(),
            })
          }
        }
        
        if (alertSettings.webhookEnabled && alertSettings.webhooks && alertSettings.webhooks.length > 0) {
          sendToWebhooks(alertSettings.webhooks, alert).then((results) => {
            results.forEach((result, webhookId) => {
              if (result.success) {
                console.log(`✅ Webhook ${webhookId} delivered (${result.attempts} attempts)`)
              } else {
                console.error(`❌ Webhook ${webhookId} failed: ${result.error}`)
              }
            })
          }).catch(console.error)
        }
      }
    } catch (error) {
      console.error('Failed to evaluate WebSocket alerts:', error)
    } finally {
      isEvaluatingAlerts = false
    }
  }, [wsMetricsMap, query.data, alertSettings, alertRules, addAlert])

  // Periodic alert evaluation to catch metrics that arrive during throttle period
  useEffect(() => {
    if (!wsMetricsMap || wsMetricsMap.size === 0) {
      return
    }
    
    if (!alertSettings.enabled || alertRules.length === 0) {
      return
    }

    // Run evaluation every 5 seconds
    const intervalId = setInterval(() => {
      if (isEvaluatingAlerts || !query.data) {
        return
      }

      const now = Date.now()
      
      // Don't run if we just evaluated
      if (now - lastAlertEvaluationTimestamp < 5000) {
        return
      }

      console.log('⏰ Periodic alert evaluation (timer-based)')
      
      // Re-attach WebSocket metrics to existing coins
      const coins = query.data.map(coin => {
        const metrics = wsMetricsMap.get(coin.fullSymbol)
        return metrics ? { ...coin, futuresMetrics: metrics } : coin
      })
      
      isEvaluatingAlerts = true
      lastAlertEvaluationTimestamp = now
      
      try {
        // Update market mode
        const sortedByVolume = [...coins].sort((a, b) => b.quoteVolume - a.quoteVolume)
        const sample = sortedByVolume.slice(0, Math.min(10, sortedByVolume.length))
        const avgMomentum = sample.reduce((sum, c) => sum + c.priceChangePercent, 0) / (sample.length || 1)
        const marketMode: 'bull' | 'bear' = avgMomentum >= 0 ? 'bull' : 'bear'
        
        const coinsWithMetrics = coins.filter(c => c.futuresMetrics)
        console.log(`📊 Periodic alert evaluation: ${coinsWithMetrics.length}/${coins.length} coins with metrics (market: ${marketMode})`)
        
        if (coinsWithMetrics.length === 0) {
          return
        }
        
        // Evaluate alerts
        const triggeredAlerts = evaluateAlertRules(coins, alertRules.filter(r => r.enabled), marketMode)
        
        console.log(`✅ Periodic evaluation complete: ${triggeredAlerts.length} alert(s) triggered`)
        
        if (triggeredAlerts.length > 0) {
          console.log(`🔔 Triggered alerts:`, triggeredAlerts.map(a => `${a.symbol} (${a.type})`))
          
          // Process each alert
          for (const alert of triggeredAlerts) {
            // Add to history
            addAlert(alert)
            
            // Play sound notification
            if (alertSettings.soundEnabled) {
              const notificationSeverity = alert.type.includes('critical') ? 'critical' : alert.type.includes('warning') ? 'warning' : 'info'
              audioNotificationService.playAlert(notificationSeverity)
            }
            
            // Show browser notification
            if (alertSettings.browserNotificationEnabled) {
              const permission = getNotificationPermission()
              if (permission === 'granted') {
                const notificationSeverity = alert.type.includes('critical') ? 'critical' : alert.type.includes('warning') ? 'warning' : 'info'
                showCryptoAlertNotification({
                  symbol: alert.symbol,
                  title: alert.title,
                  message: alert.message,
                  severity: notificationSeverity,
                  onClick: () => {
                    window.focus()
                  },
                })
              }
            }
            
            // Discord webhook
            if (alertSettings.discordWebhookUrl) {
              sendDiscordWebhook(alertSettings.discordWebhookUrl, alert).catch((error) => {
                console.error('Discord webhook delivery failed:', error)
              })
            }
            
            // Custom webhooks
            if (alertSettings.webhookEnabled && alertSettings.webhooks && alertSettings.webhooks.length > 0) {
              sendToWebhooks(alertSettings.webhooks, alert).then((results) => {
                results.forEach((result, webhookId) => {
                  if (result.success) {
                    console.log(`✅ Webhook ${webhookId} delivered (${result.attempts} attempts)`)
                  } else {
                    console.error(`❌ Webhook ${webhookId} failed: ${result.error}`)
                  }
                })
              }).catch(console.error)
            }
          }
        }
      } catch (error) {
        console.error('Failed to evaluate periodic alerts:', error)
      } finally {
        isEvaluatingAlerts = false
      }
    }, 5000) // Every 5 seconds

    return () => clearInterval(intervalId)
  }, [wsMetricsMap, query.data, alertSettings, alertRules, addAlert])

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
