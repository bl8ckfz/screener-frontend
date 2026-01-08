import { useState, useMemo, useRef, useEffect } from 'react'
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
import { ChartSection, CoinDetailsPanel } from '@/components/coin'
import { MarketSummary } from '@/components/market'
import { SearchBar } from '@/components/controls'
import { ShortcutHelp, LiveStatusBadge } from '@/components/ui'
import { StorageMigration } from '@/components/StorageMigration'
import { AlertNotificationContainer, AlertHistoryTable } from '@/components/alerts'
import { SettingsModal } from '@/components/settings'

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
  
  const currentWatchlistId = useStore((state) => state.currentWatchlistId)
  const watchlists = useStore((state) => state.watchlists)
  
  // Alert history state
  const clearAlertHistory = useStore((state) => state.clearAlertHistory)
  const alertStats = useAlertStats(coins || [])
  
  // Filter alert stats by watchlist
  const filteredAlertStats = useMemo(() => {
    if (!currentWatchlistId) return alertStats
    
    const watchlist = watchlists.find((wl) => wl.id === currentWatchlistId)
    if (!watchlist) return alertStats
    
    return alertStats.filter((stat) => watchlist.symbols.includes(stat.symbol))
  }, [alertStats, currentWatchlistId, watchlists])
  
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
        onWatchlistChange: (newWatchlists) => {
          debug.log('🔄 Watchlists updated from cloud')
          useStore.setState({ watchlists: newWatchlists })
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
  
  // Ref for search input
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  return (
    <>
      {/* Handle localStorage → IndexedDB migration on first load */}
      <StorageMigration />
      
      <Layout
        title="Crypto Screener"
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
          {/* Left Column - Alert History (Wider) */}
          <div className="lg:col-span-5 space-y-3">
            {/* Search Bar */}
            <SearchBar ref={searchInputRef} onSearch={setSearchQuery} />

            {/* Alert History Table - Compact */}
            <div className="bg-gray-900/40 rounded-lg overflow-hidden border border-gray-700">
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
            </div>
          </div>

          {/* Right Column - Chart + Coin Details Below */}
          <div className="lg:col-span-7 space-y-4">
            {/* Chart Section - Fixed Position */}
            <ChartSection 
              selectedCoin={selectedAlert?.coin || null}
              onClose={() => setSelectedAlert(null)}
            />

            {/* Coin Details Below Chart */}
            {selectedAlert?.coin && (
              <div className="bg-gray-900/40 rounded-lg border border-gray-700 p-4">
                <CoinDetailsPanel 
                  coin={selectedAlert.coin}
                  onClose={() => setSelectedAlert(null)}
                />
              </div>
            )}
          </div>
        </div>

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
