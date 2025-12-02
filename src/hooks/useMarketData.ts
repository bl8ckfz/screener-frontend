import { useEffect, useState, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useStore } from './useStore'
import { binanceApi, BinanceApiClient } from '@/services/binanceApi'
import { processTickersForPair } from '@/services/dataProcessor'
import { applyTechnicalIndicators } from '@/utils/indicators'
import { timeframeService } from '@/services/timeframeService'
import { USE_MOCK_DATA, getMockDataWithVariations } from '@/services/mockData'
import { isTabVisible, onVisibilityChange } from '@/utils/performance'
import { evaluateAlertRules } from '@/services/alertEngine'
import { showCryptoAlertNotification, getNotificationPermission } from '@/services/notification'
import { audioNotificationService } from '@/services/audioNotification'
import { sendDiscordWebhook, sendToWebhooks } from '@/services/webhookService'
import type { Coin } from '@/types/coin'
import type { Alert } from '@/types/alert'

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

  // Store previous coins data outside query for history preservation
  const previousCoinsRef = useRef<Coin[]>([])

  // Function to clear historical snapshot data
  const clearHistoricalData = useCallback(() => {
    console.log('🗑️ Clearing historical snapshot data')
    previousCoinsRef.current = []
    timeframeService.reset()
  }, [])

  // Expose clear function to store actions
  useEffect(() => {
    // Add clear function to window for store to access
    ;(window as any).__clearMarketHistory = clearHistoricalData
    return () => {
      delete (window as any).__clearMarketHistory
    }
  }, [clearHistoricalData])

  // Query for market data
  const query = useQuery({
    queryKey: ['marketData', 'USDT', currentWatchlistId],
    queryFn: async (): Promise<Coin[]> => {
      // Use mock data if enabled, otherwise fetch from Binance API
      let tickers
      if (USE_MOCK_DATA) {
        console.log('Using mock data with variations for alert testing')
        tickers = getMockDataWithVariations()
      } else {
        try {
          tickers = await binanceApi.fetch24hrTickers()
        } catch (error) {
          console.warn(
            'Failed to fetch from Binance API, falling back to mock data:',
            error
          )
          tickers = getMockDataWithVariations()
        }
      }

      // Parse to numeric values
      const processedTickers = BinanceApiClient.parseTickerBatch(tickers)

      // Convert to Coin objects (all are USDT pairs now)
      let coins = processTickersForPair(processedTickers)

      // CRITICAL: Preserve history from previous fetch
      const previousCoins = previousCoinsRef.current
      if (previousCoins && previousCoins.length > 0) {
        coins = coins.map(coin => {
          const previousCoin = previousCoins.find((prev: Coin) => prev.symbol === coin.symbol)
          if (previousCoin?.history && Object.keys(previousCoin.history).length > 0) {
            // Preserve existing history and deltas
            return { ...coin, history: previousCoin.history, deltas: previousCoin.deltas }
          }
          return coin
        })
      }

      // Apply technical indicators (VCP, Fibonacci, etc.)
      coins = applyTechnicalIndicators(coins)

      // Update timeframe snapshots
      coins = timeframeService.updateSnapshots(coins)

      // Filter by watchlist if one is selected
      if (currentWatchlistId) {
        const selectedWatchlist = watchlists.find((wl) => wl.id === currentWatchlistId)
        if (selectedWatchlist) {
          coins = coins.filter((coin) => selectedWatchlist.symbols.includes(coin.symbol))
        }
      }

      // Save coins for next fetch to preserve history
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

  // Evaluate alerts when data is successfully fetched
  useEffect(() => {
    if (!query.data || !alertSettings.enabled || alertRules.length === 0) {
      return
    }

    const coins = query.data
    const now = Date.now()

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

    // Check if we have sufficient historical data for alerts
    const sampleCoin = coins[0]
    const has1m = !!sampleCoin?.history?.['1m']
    const has5m = !!sampleCoin?.history?.['5m']
    const has15m = !!sampleCoin?.history?.['15m']
    const hasMinimumHistory = has1m && has5m && has15m
    
    if (!hasMinimumHistory) {
      return
    }

    // Filter to enabled rules only
    
    const enabledRules = alertRules.filter((rule) => rule.enabled)

    if (enabledRules.length === 0) {
      return
    }

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

        // Update cooldown tracker
        recentAlerts.current.set(symbol, now)
      }
    } catch (error) {
      console.error('Failed to evaluate alerts:', error)
    }
  }, [query.data, alertRules, alertSettings, addAlert])

  return query
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
