import { useEffect, useState, useRef } from 'react'
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

      return coins
    },
    staleTime: (refreshInterval * 1000) / 2, // Half of refresh interval
    // Smart polling: only refetch when tab is visible
    refetchInterval: autoRefresh && isVisible ? refreshInterval * 1000 : false,
    refetchOnWindowFocus: autoRefresh,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  // Evaluate alerts when data is successfully fetched
  useEffect(() => {
    if (!query.data || !alertSettings.enabled || alertRules.length === 0) {
      console.log('⚠️ Alert evaluation skipped:', {
        hasData: !!query.data,
        alertsEnabled: alertSettings.enabled,
        ruleCount: alertRules.length,
      })
      return
    }

    const coins = query.data
    const now = Date.now()

    // Filter to enabled rules only
    const enabledRules = alertRules.filter((rule) => rule.enabled)

    if (enabledRules.length === 0) {
      console.log('⚠️ No enabled alert rules')
      return
    }

    console.log(`🔍 Evaluating ${enabledRules.length} alert rules against ${coins.length} coins...`)
    
    // Debug: Log first coin to see what data we have
    if (coins.length > 0) {
      const sampleCoin = coins[0]
      console.log('📊 Sample coin data:', {
        symbol: sampleCoin.symbol,
        lastPrice: sampleCoin.lastPrice,
        priceChange: sampleCoin.priceChangePercent,
        hasHistory: !!sampleCoin.history,
        historyKeys: sampleCoin.history ? Object.keys(sampleCoin.history) : [],
        history1m: sampleCoin.history?.['1m'],
        history3m: sampleCoin.history?.['3m'],
      })
    }

    try {
      // Evaluate all rules against current coins
      const triggeredAlerts = evaluateAlertRules(coins, enabledRules)
      
      console.log(`✅ Alert evaluation complete: ${triggeredAlerts.length} alerts triggered`)

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

        // Add to store (will trigger notification and save to history)
        addAlert(alert)

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

        console.log(`🔔 Alert triggered: ${symbol} - ${alert.title}`)
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
