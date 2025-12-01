import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { CurrencyPair, Coin, CoinSort } from '@/types/coin'
import type { ScreeningListId, Watchlist } from '@/types/screener'
import type { AppConfig } from '@/types/config'
import { DEFAULT_CONFIG, STORAGE_KEYS } from '@/types/config'
import type { AlertRule, AlertSettings, Alert } from '@/types/alert'
import { createIndexedDBStorage } from '@/services/storage'
import { alertHistory } from '@/services/alertHistory'
import { supabase } from '@/config'
import type { User, Session } from '@supabase/supabase-js'

interface AppState {
  // Current selections
  currentPair: CurrencyPair
  currentList: ScreeningListId
  currentPage: number

  // Coin data
  coins: Coin[]
  filteredCoins: Coin[]
  isLoading: boolean
  error: string | null
  lastUpdated: number | null

  // Sorting
  sort: CoinSort

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

  // Watchlists
  watchlists: Watchlist[]
  currentWatchlistId: string | null

  // Auth
  user: User | null
  session: Session | null
  isAuthenticated: boolean
  isSyncing: boolean

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
  addWatchlist: (watchlist: Omit<Watchlist, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateWatchlist: (watchlistId: string, updates: Partial<Omit<Watchlist, 'id' | 'createdAt'>>) => void
  deleteWatchlist: (watchlistId: string) => void
  setCurrentWatchlist: (watchlistId: string | null) => void
  addToWatchlist: (watchlistId: string, symbol: string) => Promise<void>
  removeFromWatchlist: (watchlistId: string, symbol: string) => Promise<void>
  setWatchlists: (watchlists: Watchlist[]) => void
  setAlertRules: (rules: AlertRule[]) => void
  
  // Auth actions
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  signOut: () => Promise<void>
  syncToCloud: () => Promise<void>
  syncFromCloud: () => Promise<void>
  
  reset: () => void
}

const initialState = {
  currentPair: DEFAULT_CONFIG.data.currentPair,
  currentList: DEFAULT_CONFIG.data.currentList,
  currentPage: 1,
  coins: [],
  filteredCoins: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  sort: {
    field: 'priceChangePercent' as const,
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
    notificationEnabled: true,
    browserNotificationEnabled: false, // Requires user permission
    webhookEnabled: false,
    discordWebhookUrl: '', // Legacy field for backwards compatibility
    telegramBotToken: '',
    telegramChatId: '',
    webhooks: [],
    maxAlertsPerSymbol: 5,
    alertCooldown: 60, // 1 minute between alerts for same symbol
    autoDismissAfter: 30, // Auto-dismiss after 30 seconds
  } as AlertSettings,
  activeAlerts: [] as Alert[],
  
  // Watchlist defaults
  watchlists: [] as Watchlist[],
  currentWatchlistId: null,
  
  // Auth defaults
  user: null,
  session: null,
  isAuthenticated: false,
  isSyncing: false,
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,

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

      addAlert: (alert) => {
        // Save to history asynchronously
        alertHistory.addToHistory(alert).catch((err) =>
          console.error('Failed to save alert to history:', err)
        )
        set((state) => ({
          activeAlerts: [...state.activeAlerts, alert],
        }))
      },

      dismissAlert: (alertId) =>
        set((state) => ({
          activeAlerts: state.activeAlerts.filter((alert) => alert.id !== alertId),
        })),

      clearAlerts: () =>
        set({ activeAlerts: [] }),

      // Watchlist actions
      addWatchlist: (watchlist) => {
        const now = Date.now()
        const newWatchlist: Watchlist = {
          ...watchlist,
          id: `watchlist_${now}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({
          watchlists: [...state.watchlists, newWatchlist],
        }))
      },

      updateWatchlist: (watchlistId, updates) =>
        set((state) => ({
          watchlists: state.watchlists.map((wl) =>
            wl.id === watchlistId
              ? { ...wl, ...updates, updatedAt: Date.now() }
              : wl
          ),
        })),

      deleteWatchlist: (watchlistId) =>
        set((state) => ({
          watchlists: state.watchlists.filter((wl) => wl.id !== watchlistId),
          currentWatchlistId: state.currentWatchlistId === watchlistId ? null : state.currentWatchlistId,
        })),

      setCurrentWatchlist: (watchlistId) =>
        set({ currentWatchlistId: watchlistId }),

      addToWatchlist: async (watchlistId, symbol) => {
        let updatedWatchlist: Watchlist | undefined
        let userId: string | undefined

        set((state) => {
          userId = state.user?.id
          const updatedWatchlists = state.watchlists.map((wl: Watchlist) =>
            wl.id === watchlistId && !wl.symbols.includes(symbol)
              ? { ...wl, symbols: [...wl.symbols, symbol], updatedAt: Date.now() }
              : wl
          )
          updatedWatchlist = updatedWatchlists.find((wl: Watchlist) => wl.id === watchlistId)
          return { watchlists: updatedWatchlists }
        })

        // Sync to cloud if authenticated
        if (userId && updatedWatchlist) {
          const { syncSingleWatchlistToCloud } = await import('@/services/syncService')
          await syncSingleWatchlistToCloud(userId, updatedWatchlist).catch(console.error)
        }
      },

      removeFromWatchlist: async (watchlistId, symbol) => {
        let updatedWatchlist: Watchlist | undefined
        let userId: string | undefined

        set((state) => {
          userId = state.user?.id
          const updatedWatchlists = state.watchlists.map((wl: Watchlist) =>
            wl.id === watchlistId
              ? { ...wl, symbols: wl.symbols.filter((s: string) => s !== symbol), updatedAt: Date.now() }
              : wl
          )
          updatedWatchlist = updatedWatchlists.find((wl: Watchlist) => wl.id === watchlistId)
          return { watchlists: updatedWatchlists }
        })

        // Sync to cloud if authenticated
        if (userId && updatedWatchlist) {
          const { syncSingleWatchlistToCloud } = await import('@/services/syncService')
          await syncSingleWatchlistToCloud(userId, updatedWatchlist).catch(console.error)
        }
      },

      setWatchlists: (watchlists) =>
        set({ watchlists }),

      setAlertRules: (alertRules) =>
        set({ alertRules }),

      // Auth actions
      setUser: (user) =>
        set({ user, isAuthenticated: !!user }),

      setSession: (session) =>
        set({ session }),

      signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null, session: null, isAuthenticated: false })
      },

      syncToCloud: async () => {
        const state = useStore.getState()
        if (!state.user) return

        set({ isSyncing: true })
        try {
          const { pushAllToCloud } = await import('@/services/syncService')
          
          await pushAllToCloud(state.user.id, {
            userSettings: {
              currentPair: state.currentPair,
              currentList: state.currentList,
              refreshInterval: state.refreshInterval,
              sortField: state.sort.field,
              sortDirection: state.sort.direction,
              theme: state.theme,
            },
            alertSettings: state.alertSettings,
            watchlists: state.watchlists,
            alertRules: state.alertRules,
            webhooks: state.alertSettings.webhooks,
          })
          
          console.log('✅ Synced to cloud successfully')
        } catch (error) {
          console.error('❌ Sync to cloud failed:', error)
          throw error
        } finally {
          set({ isSyncing: false })
        }
      },

      syncFromCloud: async () => {
        const state = useStore.getState()
        if (!state.user) return

        set({ isSyncing: true })
        try {
          const { pullAllFromCloud } = await import('@/services/syncService')
          
          const cloudData = await pullAllFromCloud(state.user.id)
          
          // Update store with cloud data
          if (cloudData.userSettings) {
            set({
              currentPair: cloudData.userSettings.currentPair,
              currentList: cloudData.userSettings.currentList,
              refreshInterval: cloudData.userSettings.refreshInterval,
              sort: {
                field: cloudData.userSettings.sortField || 'priceChangePercent',
                direction: cloudData.userSettings.sortDirection || 'desc',
              },
              theme: cloudData.userSettings.theme,
            })
          }
          
          if (cloudData.alertSettings) {
            set({
              alertSettings: {
                ...state.alertSettings,
                ...cloudData.alertSettings,
              },
            })
          }
          
          set({
            watchlists: cloudData.watchlists,
            alertRules: cloudData.alertRules,
            alertSettings: {
              ...state.alertSettings,
              webhooks: cloudData.webhooks,
            },
          })
          
          console.log('✅ Synced from cloud successfully')
        } catch (error) {
          console.error('❌ Sync from cloud failed:', error)
          throw error
        } finally {
          set({ isSyncing: false })
        }
      },

      reset: () =>
        set(initialState),
    }),
    {
      name: STORAGE_KEYS.USER_PREFERENCES,
      storage: createJSONStorage(() => createIndexedDBStorage()),
      partialize: (state) => ({
        currentPair: state.currentPair,
        currentList: state.currentList,
        sort: state.sort,
        config: state.config,
        autoRefresh: state.autoRefresh,
        refreshInterval: state.refreshInterval,
        theme: state.theme,
        leftSidebarCollapsed: state.leftSidebarCollapsed,
        rightSidebarCollapsed: state.rightSidebarCollapsed,
        alertRules: state.alertRules,
        alertSettings: state.alertSettings,
        watchlists: state.watchlists,
        currentWatchlistId: state.currentWatchlistId,
      }),
    }
  )
)
