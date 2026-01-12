import { useState, useRef, useEffect, useMemo } from 'react'
import { debug } from '@/utils/debug'
import { memoryProfiler } from '@/utils/memoryProfiler'
import { useMarketData } from '@/hooks/useMarketData'
import { useFuturesStreaming } from '@/hooks/useFuturesStreaming'
import { useStore } from '@/hooks/useStore'
import { useKeyboardShortcuts, useAlertStats } from '@/hooks'
import { supabase } from '@/config'
import { alertHistoryService } from '@/services'
import { ALERT_HISTORY_CONFIG } from '@/types'
import { Layout } from '@/components/layout'
import { ChartSection, CoinTable } from '@/components/coin'
import { MobileCoinDrawer } from '@/components/coin/MobileCoinDrawer'
import { MarketSummary } from '@/components/market'
import { SearchBar } from '@/components/controls'
import { ShortcutHelp, LiveStatusBadge } from '@/components/ui'
import { StorageMigration } from '@/components/StorageMigration'
import { AlertNotificationContainer, AlertHistoryTable } from '@/components/alerts'
import { SettingsModal } from '@/components/settings'
import { FEATURE_FLAGS } from '@/config'
import type { FuturesTickerData } from '@/types/api'

function App() {
  // WebSocket streaming for futures data (real-time)
  const {
    isInitialized,
    tickersReady, // true when initial REST ticker data is loaded
    backfillProgress: _backfillProgress, // NEW: 0-100% background loading progress - available for loading indicator
    backfillComplete: _backfillComplete, // NEW: true when historical data loaded - available for feature gating
    error: wsError,
    warmupStatus,
    metricsMap,
    getTickerData,
    lastUpdate,
  } = useFuturesStreaming()
  
  // Pass WebSocket metrics and ticker data to market data
  const { data: coins, isLoading } = useMarketData(metricsMap, getTickerData, tickersReady, lastUpdate)
  
  // Alert history state
  const clearAlertHistory = useStore((state) => state.clearAlertHistory)
  const sentimentFilter = useStore((state) => state.sentimentFilter)
  const alertStats = useAlertStats(coins || [])
  
  // Auth state
  const setUser = useStore((state) => state.setUser)
  const setSession = useStore((state) => state.setSession)
  const syncFromCloud = useStore((state) => state.syncFromCloud)
  const user = useStore((state) => state.user)
  
  // Initialize auth state on mount
  useEffect(() => {
    // Get initial session from Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Only update if session exists or if current user is null
      // This prevents overwriting persisted auth state with null on initial load
      if (session || !user) {
        setSession(session)
        setUser(session?.user ?? null)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      debug.log('🔐 Auth state change:', event, session?.user?.email)
      setSession(session)
      setUser(session?.user ?? null)
      
      // Auto-sync on sign in
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          await syncFromCloud()
        } catch (error) {
          console.error('Auto-sync on sign in failed:', error)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [setUser, setSession, syncFromCloud, user])
  
  // Setup real-time sync when user is authenticated
  useEffect(() => {
    if (!user?.id) return
    
    debug.log('🔄 Setting up realtime sync for user:', user.id)
    
    const setupSync = async () => {
      const { setupRealtimeSync } = await import('@/services/syncService')
      
      const cleanup = setupRealtimeSync(user.id, {
        onWatchlistChange: (newWatchlistSymbols: string[]) => {
          debug.log('🔄 Watchlist updated from cloud')
          useStore.setState({ watchlistSymbols: newWatchlistSymbols })
        },
        onAlertRuleChange: (newRules) => {
          debug.log('🔄 Alert rules updated from cloud')
          useStore.setState({ alertRules: newRules })
        },
        onWebhookChange: (newWebhooks) => {
          debug.log('🔄 Webhooks updated from cloud')
          const currentSettings = useStore.getState().alertSettings
          useStore.setState({
            alertSettings: {
              ...currentSettings,
              webhooks: newWebhooks,
            },
          })
        },
      })
      
      return cleanup
    }
    
    let cleanup: (() => void) | undefined
    setupSync().then((fn) => { cleanup = fn })
    
    return () => {
      debug.log('🔌 Cleaning up realtime sync')
      cleanup?.()
    }
  }, [user?.id])
  
  // Alert history cleanup interval
  useEffect(() => {
    const interval = setInterval(() => {
      const removedCount = alertHistoryService.cleanupOldAlerts()
      if (removedCount > 0) {
        debug.log(`🧹 Cleaned up ${removedCount} old alerts`)
      }
    }, ALERT_HISTORY_CONFIG.CLEANUP_INTERVAL_MS)
    
    return () => clearInterval(interval)
  }, [])
  
  // Alert system state
  // Alert rule management moved to SettingsModal

  // Local state for UI interactions
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAlert, setSelectedAlert] = useState<any>(null)
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'coins' | 'alerts'>('coins')
  const [isMobile, setIsMobile] = useState(false)
  const liveTicker: FuturesTickerData | undefined = useMemo(() => {
    if (!selectedAlert?.coin || !getTickerData) return undefined
    const tickers = getTickerData()
    const symbol = selectedAlert.coin.fullSymbol || selectedAlert.coin.symbol
    return tickers?.find((t) => t.symbol === symbol)
  }, [getTickerData, selectedAlert?.coin])
  
  // Ref for search input
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Track viewport size for mobile-specific UI
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])
  
  // Filter coins by sentiment and search query
  const filteredCoins = useMemo(() => {
    if (!coins) return []
    
    let filtered = coins
    
    // Apply sentiment filter
    if (sentimentFilter !== 'all') {
      filtered = filtered.filter((coin) => {
        switch (sentimentFilter) {
          case 'bullish':
            return coin.priceChangePercent > 0
          case 'bearish':
            return coin.priceChangePercent < 0
          case 'neutral':
            return coin.priceChangePercent === 0
          default:
            return true
        }
      })
    }
    
    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((coin) =>
        coin.symbol.toLowerCase().includes(query) ||
        coin.fullSymbol.toLowerCase().includes(query)
      )
    }
    
    return filtered
  }, [coins, sentimentFilter, searchQuery])

  // Filter alert stats when searching in the Alerts tab
  const filteredAlertStats = useMemo(() => {
    if (!searchQuery.trim()) return alertStats

    const query = searchQuery.toLowerCase()

    return alertStats.filter((stat) => {
      const matchesSymbol = stat.symbol.toLowerCase().includes(query)
      const matchesType = Array.from(stat.alertTypes || []).some((type) =>
        type.toLowerCase().includes(query)
      )
      return matchesSymbol || matchesType
    })
  }, [alertStats, searchQuery])

  const mobileSheetEnabled = FEATURE_FLAGS.mobileCardView && isMobile

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'Escape',
      description: 'Close settings or clear selection',
      callback: () => {
        if (isSettingsOpen) {
          setIsSettingsOpen(false)
        } else if (selectedAlert) {
          setSelectedAlert(null)
        } else if (searchQuery) {
          setSearchQuery('')
        }
      },
    },
    {
      key: ',',
      ctrl: true,
      description: 'Open settings',
      callback: () => {
        setIsSettingsOpen(true)
      },
      preventDefault: true,
    },
    {
      key: 'k',
      ctrl: true,
      description: 'Focus search bar',
      callback: () => {
        searchInputRef.current?.focus()
      },
    },
    {
      key: '?',
      description: 'Show keyboard shortcuts',
      callback: () => {
        setShowShortcutHelp(true)
      },
      preventDefault: true,
    },
  ])
  
  // Handle alert click - set selected coin and alert
  const handleAlertClick = (symbol: string) => {
    const coin = coins?.find((c) => c.symbol === symbol)
    if (coin) {
      // Find the alert stats for this coin
      const alertStat = alertStats.find((stat) => stat.symbol === symbol)
      setSelectedAlert({ coin, alertStat })
    }
  }

  // Handle coin table row click
  const handleCoinClick = (coin: any) => {
    const alertStat = alertStats.find((stat) => stat.symbol === coin.symbol)
    setSelectedAlert({ coin, alertStat })
  }

  return (
    <>
      {/* Handle localStorage → IndexedDB migration on first load */}
      <StorageMigration />
      
      <Layout
        title="Screener"
        subtitle="Real-time USDT market analysis"
        onOpenSettings={() => setIsSettingsOpen(true)}
      >
        {/* Compact Market Summary Bar */}
        <div className="mb-4">
          <div className="bg-gray-700/40 backdrop-blur-sm rounded-lg px-4 py-2 border border-gray-600">
            <div className="flex items-center justify-between">
              <MarketSummary coins={coins} isLoading={isLoading} />
              <div className="flex items-center space-x-4">
                <LiveStatusBadge
                  connected={isInitialized}
                  lastUpdate={lastUpdate}
                  warmupStatus={warmupStatus}
                />
                {wsError && (
                  <div className="text-xs text-error-text bg-error-bg border border-error-border rounded px-2 py-1">
                    WS Error: {wsError.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout: Alert History | Chart + Coin Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column - Tabbed View (Coins / Alerts) */}
          <div className="lg:col-span-5 space-y-3">
            {/* Search Bar (sticky on mobile) */}
            <div
              className={
                mobileSheetEnabled
                  ? 'sticky top-[68px] z-30 bg-black/90 backdrop-blur-md border-b border-gray-800 py-2'
                  : ''
              }
            >
              <SearchBar
                ref={searchInputRef}
                onSearch={setSearchQuery}
                placeholder={
                  activeTab === 'alerts'
                    ? 'Search alerts by symbol or type...'
                    : 'Search coins...'
                }
              />
            </div>

            {/* Tabbed Content */}
            <div
              className={
                mobileSheetEnabled
                  ? 'sticky top-[124px] z-20 bg-gray-800 rounded-lg overflow-hidden border border-gray-700'
                  : 'bg-gray-800 rounded-lg overflow-hidden border border-gray-700'
              }
            >
              {/* Tab Buttons */}
              <div className="flex items-center border-b border-gray-700 bg-gray-800">
                <button
                  onClick={() => setActiveTab('coins')}
                  className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
                    activeTab === 'coins'
                      ? 'bg-gray-700 text-white border-b-2 border-accent'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>📊 Market Coins</span>
                    <span className="text-xs opacity-75">({coins?.length || 0})</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('alerts')}
                  className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
                    activeTab === 'alerts'
                      ? 'bg-gray-700 text-white border-b-2 border-accent'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>🔔 Alert History</span>
                    <span className="text-xs opacity-75">({alertStats.length})</span>
                  </div>
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'coins' ? (
                <CoinTable
                  coins={filteredCoins}
                  onCoinClick={handleCoinClick}
                  isLoading={isLoading}
                />
              ) : (
                <AlertHistoryTable
                  stats={filteredAlertStats}
                  selectedSymbol={selectedAlert?.coin?.symbol}
                  onAlertClick={handleAlertClick}
                  onClearHistory={() => {
                    if (confirm('Clear all alert history? This cannot be undone.')) {
                      clearAlertHistory()
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Right Column - Chart Only */}
          <div className={`lg:col-span-7 ${mobileSheetEnabled ? 'hidden md:block' : ''}`}>
            {/* Chart Section */}
            <ChartSection 
              selectedCoin={selectedAlert?.coin || null}
              onClose={() => setSelectedAlert(null)}
              liveTicker={liveTicker}
            />
          </div>
        </div>

        {/* Mobile Chart Drawer */}
        {mobileSheetEnabled && selectedAlert?.coin && (
          <MobileCoinDrawer
            open={!!selectedAlert?.coin}
            selectedCoin={selectedAlert.coin}
            onClose={() => setSelectedAlert(null)}
            liveTicker={liveTicker}
          />
        )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Keyboard Shortcuts Help */}
      <ShortcutHelp
        isOpen={showShortcutHelp}
        onClose={() => setShowShortcutHelp(false)}
        shortcuts={[
          { key: 'Escape', description: 'Close settings or clear selection', callback: () => {} },
          { key: ',', ctrl: true, description: 'Open settings', callback: () => {} },
          { key: 'k', ctrl: true, description: 'Focus search bar', callback: () => {} },
          { key: '?', description: 'Show keyboard shortcuts', callback: () => {} },
        ]}
      />
      
      {/* Alert Notifications (renders outside layout in top-right) */}
      <AlertNotificationContainer />
      
      {/* Memory Stats (dev only) */}
      {import.meta.env.DEV && <MemoryStats />}
    </Layout>
    </>
  )
}

// Development-only memory stats display
function MemoryStats() {
  const [stats, setStats] = useState<ReturnType<typeof memoryProfiler.getStats>>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(memoryProfiler.getStats())
    }, 10000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [])

  if (!stats) return null

  const isHighGrowth = stats.growthMB > 30
  const isHighUtilization = stats.utilizationPct > 80

  return (
    <div className="fixed bottom-2 left-2 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs font-mono z-50 opacity-75 hover:opacity-100 transition-opacity">
      <div className="flex gap-3 text-gray-400">
        <span>Memory: {stats.currentMB.toFixed(1)}MB</span>
        <span className={isHighGrowth ? 'text-yellow-400' : ''}>
          {stats.growthMB > 0 ? '+' : ''}{stats.growthMB.toFixed(1)}MB
        </span>
        <span className={isHighUtilization ? 'text-orange-400' : ''}>
          {stats.utilizationPct.toFixed(0)}%
        </span>
      </div>
    </div>
  )
}

export default App
