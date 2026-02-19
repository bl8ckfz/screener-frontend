import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CurrencyPair, Coin, CoinSort } from '@/types/coin'
import type { ScreeningListId } from '@/types/screener'
import type { AppConfig } from '@/types/config'
import { DEFAULT_CONFIG, STORAGE_KEYS } from '@/types/config'
import type { AlertRule, AlertSettings, Alert } from '@/types/alert'
import { createIndexedDBStorage } from '@/services/storage'
import { alertHistory } from '@/services/alertHistory'
import { alertHistoryService } from '@/services/alertHistoryService'

import { watchlistService } from '@/services/watchlistService'
import { authService } from '@/services/authService'
import type { Webhook } from '@/services/webhookService'

interface AppState {
  // Current selections
  currentPair: CurrencyPair
  currentList: ScreeningListId
  currentPage: number
  
  // Market mode (derived from aggregate momentum)
  marketMode: 'bull' | 'bear'

  // Coin data
  coins: Coin[]
  filteredCoins: Coin[]
  isLoading: boolean
  error: string | null
  lastUpdated: number | null

  // Sorting
  sort: CoinSort
  alertHistorySort: {
    field: 'symbol' | 'price' | 'change' | 'alerts' | 'lastAlert'
    direction: 'asc' | 'desc'
  }

  // Sentiment filter
  sentimentFilter: 'all' | 'bullish' | 'neutral' | 'bearish'

  // Settings
  config: AppConfig
  autoRefresh: boolean
  refreshInterval: number
  theme: 'dark' | 'light'

  // UI State
  leftSidebarCollapsed: boolean
  rightSidebarCollapsed: boolean
  // Alert system
  alertRules: AlertRule[]
  alertSettings: AlertSettings
  activeAlerts: Alert[]

  // Alert history
  alertHistoryRefresh: number // Trigger for useAlertStats to recompute
  addAlertToHistory: (alert: Alert, coin: Coin) => void
  clearAlertHistory: () => void

  // View state
  activeView: 'coins' | 'alerts'
  setActiveView: (view: 'coins' | 'alerts') => void

  // Watchlist (simplified - single default watchlist)
  watchlistSymbols: string[]

  // Webhooks
  webhooks: Webhook[]

  // Actions
  setCurrentPair: (pair: CurrencyPair) => void
  setCurrentList: (list: ScreeningListId) => void
  setCurrentPage: (page: number) => void
  setCoins: (coins: Coin[]) => void
  setFilteredCoins: (coins: Coin[]) => void
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setLastUpdated: (timestamp: number) => void
  setSort: (sort: CoinSort) => void
  setAlertHistorySort: (sort: { field: 'symbol' | 'price' | 'change' | 'alerts' | 'lastAlert'; direction: 'asc' | 'desc' }) => void
  setSentimentFilter: (filter: 'all' | 'bullish' | 'neutral' | 'bearish') => void
  setMarketMode: (mode: 'bull' | 'bear') => void
  setAutoRefresh: (enabled: boolean) => void
  setRefreshInterval: (interval: number) => void
  updateConfig: (config: Partial<AppConfig>) => void
  setTheme: (theme: 'dark' | 'light') => void
  setLeftSidebarCollapsed: (collapsed: boolean) => void
  setRightSidebarCollapsed: (collapsed: boolean) => void
  // Alert actions
  addAlertRule: (rule: AlertRule) => void
  updateAlertRule: (ruleId: string, updates: Partial<AlertRule>) => void
  deleteAlertRule: (ruleId: string) => void
  toggleAlertRule: (ruleId: string, enabled: boolean) => void
  updateAlertSettings: (settings: Partial<AlertSettings>) => void
  addAlert: (alert: Alert) => void
  dismissAlert: (alertId: string) => void
  clearAlerts: () => void
  
  // Watchlist actions
  toggleWatchlist: (symbol: string) => void
  setWatchlistSymbols: (symbols: string[]) => void
  setAlertRules: (rules: AlertRule[]) => void
  
  // Webhook actions
  setWebhooks: (webhooks: Webhook[]) => void
  addWebhook: (webhook: Webhook) => void
  updateWebhook: (id: string, updates: Partial<Webhook>) => void
  deleteWebhook: (id: string) => void
  toggleWebhook: (id: string, enabled: boolean) => void
  
  reset: () => void
}

const initialState = {
  currentPair: DEFAULT_CONFIG.data.currentPair,
  currentList: DEFAULT_CONFIG.data.currentList,
  currentPage: 1,
  marketMode: 'bull',
  sentimentFilter: 'all' as 'all' | 'bullish' | 'neutral' | 'bearish',
  coins: [],
  filteredCoins: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  sort: {
    field: 'priceChangePercent' as const,
    direction: 'desc' as const,
  },
  alertHistorySort: {
    field: 'alerts' as const,
    direction: 'desc' as const,
  },
  config: DEFAULT_CONFIG,
  autoRefresh: DEFAULT_CONFIG.refresh.enabled,
  refreshInterval: DEFAULT_CONFIG.refresh.interval,
  theme: 'dark' as const,
  leftSidebarCollapsed: false,
  rightSidebarCollapsed: false,
  // Alert system defaults
  alertRules: [] as AlertRule[],
  alertSettings: {
    enabled: true,
    soundEnabled: false,
    notificationEnabled: false, // Disabled by default (can cover UI on small screens)
    browserNotificationEnabled: false, // Requires user permission
    webhookEnabled: false,
    discordWebhookUrl: '', // Legacy field for backwards compatibility
    telegramBotToken: '',
    telegramChatId: '',
    webhooks: [],
    watchlistWebhooks: [], // Separate webhooks for watchlist alerts
    maxAlertsPerSymbol: 5,
    alertCooldown: 60, // 1 minute between alerts for same symbol
    autoDismissAfter: 30, // Auto-dismiss after 30 seconds
  } as AlertSettings,
  activeAlerts: [] as Alert[],
  
  // Alert history defaults
  alertHistoryRefresh: Date.now(),
  activeView: 'coins' as const,
  
  // Watchlist defaults (simplified - single array)
  watchlistSymbols: [] as string[],
  
  // Webhook defaults
  webhooks: [] as Webhook[],
  
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,
      marketMode: initialState.marketMode as 'bull' | 'bear',

      setCurrentPair: (pair) =>
        set({ currentPair: pair, currentPage: 1, coins: [], filteredCoins: [] }),

      setCurrentList: (list) =>
        set({ currentList: list, currentPage: 1 }),

      setCurrentPage: (page) =>
        set({ currentPage: page }),

      setCoins: (coins) =>
        set({ coins, lastUpdated: Date.now() }),

      setFilteredCoins: (filteredCoins) =>
        set({ filteredCoins }),

      setIsLoading: (isLoading) =>
        set({ isLoading }),

      setError: (error) =>
        set({ error }),

      setLastUpdated: (lastUpdated) =>
        set({ lastUpdated }),

      setSort: (sort) =>
        set({ sort }),

      setAlertHistorySort: (alertHistorySort) =>
        set({ alertHistorySort }),

      setSentimentFilter: (sentimentFilter) =>
        set({ sentimentFilter }),

      setMarketMode: (marketMode) =>
        set({ marketMode }),

      setAutoRefresh: (autoRefresh) =>
        set({ autoRefresh }),

      setRefreshInterval: (refreshInterval) =>
        set({ refreshInterval }),

      updateConfig: (configUpdate) =>
        set((state) => ({
          config: { ...state.config, ...configUpdate },
        })),

      setTheme: (theme) =>
        set({ theme }),

      setLeftSidebarCollapsed: (leftSidebarCollapsed) =>
        set({ leftSidebarCollapsed }),

      setRightSidebarCollapsed: (rightSidebarCollapsed) =>
        set({ rightSidebarCollapsed }),

      // Alert actions
      addAlertRule: (rule) =>
        set((state) => ({
          alertRules: [...state.alertRules, rule],
        })),

      updateAlertRule: (ruleId, updates) =>
        set((state) => ({
          alertRules: state.alertRules.map((rule) =>
            rule.id === ruleId ? { ...rule, ...updates } : rule
          ),
        })),

      deleteAlertRule: (ruleId) =>
        set((state) => ({
          alertRules: state.alertRules.filter((rule) => rule.id !== ruleId),
        })),

      toggleAlertRule: (ruleId, enabled) =>
        set((state) => ({
          alertRules: state.alertRules.map((rule) =>
            rule.id === ruleId ? { ...rule, enabled } : rule
          ),
        })),

      updateAlertSettings: (settings) =>
        set((state) => ({
          alertSettings: { ...state.alertSettings, ...settings },
        })),

      // Alert history actions
      addAlertToHistory: (alert, coin) => {
        alertHistoryService.addAlert(alert, coin)
        // Trigger refresh for useAlertStats
        set({ alertHistoryRefresh: Date.now() })
      },

      clearAlertHistory: () => {
        alertHistoryService.clearHistory()
        // Trigger refresh
        set({ alertHistoryRefresh: Date.now() })
      },

      // View toggle
      setActiveView: (view) => set({ activeView: view }),

      addAlert: (alert) => {
        // Save to backend history asynchronously (no-op - backend handles this)
        alertHistory.addToHistory(alert).catch((err) =>
          console.error('Failed to save alert to history:', err)
        )
        
        // Also add to local alert history service for immediate UI display
        set((state) => {
          const coin = state.coins.find((c: Coin) => c.symbol === alert.symbol)
          if (coin) {
            alertHistoryService.addAlert(alert, coin)
            // Return updated state with refresh trigger
            return {
              activeAlerts: [...state.activeAlerts, alert],
              alertHistoryRefresh: Date.now(),
            }
          }
          
          return {
            activeAlerts: [...state.activeAlerts, alert],
          }
        })
      },

      dismissAlert: (alertId) =>
        set((state) => ({
          activeAlerts: state.activeAlerts.filter((alert) => alert.id !== alertId),
        })),

      clearAlerts: () => {
        set({ activeAlerts: [] })
        // Also clear historical snapshot data
        if ((window as any).__clearMarketHistory) {
          (window as any).__clearMarketHistory()
        }
      },

      // Watchlist actions (simplified)
      toggleWatchlist: (symbol) =>
        set((state) => {
          const isInWatchlist = state.watchlistSymbols.includes(symbol)
          const newWatchlistSymbols = isInWatchlist
            ? state.watchlistSymbols.filter((s) => s !== symbol)
            : [...state.watchlistSymbols, symbol]
          
          // Sync to backend if authenticated
          if (authService.isAuthenticated()) {
            if (isInWatchlist) {
              watchlistService.removeSymbol(symbol).catch((err) =>
                console.error('Failed to remove symbol from backend:', err)
              )
            } else {
              watchlistService.addSymbol(symbol).catch((err) => {
                console.error('Failed to add symbol to backend:', err)
                // Revert local state on error
                set((state) => ({
                  watchlistSymbols: state.watchlistSymbols.filter((s) => s !== symbol),
                }))
              })
            }
          }
          
          return { watchlistSymbols: newWatchlistSymbols }
        }),

      setWatchlistSymbols: (watchlistSymbols) =>
        set({ watchlistSymbols }),

      setAlertRules: (alertRules) =>
        set({ alertRules }),

      // Webhook actions
      setWebhooks: (webhooks) =>
        set({ webhooks }),

      addWebhook: (webhook) =>
        set((state) => ({
          webhooks: [...state.webhooks, webhook],
        })),

      updateWebhook: (id, updates) =>
        set((state) => ({
          webhooks: state.webhooks.map((webhook) =>
            webhook.id === id ? { ...webhook, ...updates } : webhook
          ),
        })),

      deleteWebhook: (id) =>
        set((state) => ({
          webhooks: state.webhooks.filter((webhook) => webhook.id !== id),
        })),

      toggleWebhook: (id, enabled) =>
        set((state) => ({
          webhooks: state.webhooks.map((webhook) =>
            webhook.id === id ? { ...webhook, is_enabled: enabled } : webhook
          ),
        })),

      reset: () =>
        set(initialState as Partial<AppState>),
    }),
    {
      name: STORAGE_KEYS.USER_PREFERENCES,
      storage: createJSONStorage(() => createIndexedDBStorage()),
      partialize: (state) => ({
        currentPair: state.currentPair,
        currentList: state.currentList,
        sort: state.sort,
        alertHistorySort: state.alertHistorySort,
        sentimentFilter: state.sentimentFilter,
        config: state.config,
        autoRefresh: state.autoRefresh,
        refreshInterval: state.refreshInterval,
        theme: state.theme,
        leftSidebarCollapsed: state.leftSidebarCollapsed,
        rightSidebarCollapsed: state.rightSidebarCollapsed,
        alertRules: state.alertRules,
        alertSettings: state.alertSettings,
        watchlistSymbols: state.watchlistSymbols, // Simplified watchlist
        webhooks: state.webhooks, // Persist webhooks
        activeView: state.activeView,
      }),
    }
  )
)
