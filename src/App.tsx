import { useState, useMemo, useRef, lazy, Suspense, useEffect } from 'react'
import { useMarketData } from '@/hooks/useMarketData'
import { useStore } from '@/hooks/useStore'
import { useKeyboardShortcuts, useAlertStats } from '@/hooks'
import { supabase } from '@/config'
import { alertHistoryService } from '@/services'
import { ALERT_HISTORY_CONFIG } from '@/types'
import { Layout, Sidebar } from '@/components/layout'
import { SmartCoinTable } from '@/components/coin'
import { MarketSummary } from '@/components/market'
import {
  RefreshControl,
  SearchBar,
  ExportButton,
  ViewToggle,
} from '@/components/controls'
// Watchlists removed from UI per new plan
import { ErrorStates, EmptyStates, ShortcutHelp } from '@/components/ui'
import { StorageMigration } from '@/components/StorageMigration'
import { AlertNotificationContainer, AlertConfig, AlertHistoryTable } from '@/components/alerts'
import { sortCoinsByList } from '@/utils'
import { getListById } from '@/types'
import type { Coin } from '@/types/coin'

// Lazy load heavy components
const CoinModal = lazy(() => import('@/components/coin/CoinModal').then(m => ({ default: m.CoinModal })))

function App() {
  const { data: coins, isLoading, error } = useMarketData()
  const currentList = useStore((state) => state.currentList)
  // setCurrentList unused after removing ListSelector
  const leftSidebarCollapsed = useStore((state) => state.leftSidebarCollapsed)
  const rightSidebarCollapsed = useStore((state) => state.rightSidebarCollapsed)
  const setLeftSidebarCollapsed = useStore((state) => state.setLeftSidebarCollapsed)
  const setRightSidebarCollapsed = useStore((state) => state.setRightSidebarCollapsed)
  
  // Alert history state
  const activeView = useStore((state) => state.activeView)
  const setActiveView = useStore((state) => state.setActiveView)
  const clearAlertHistory = useStore((state) => state.clearAlertHistory)
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
      console.log('🔐 Auth state change:', event, session?.user?.email)
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
    
    console.log('🔄 Setting up realtime sync for user:', user.id)
    
    const setupSync = async () => {
      const { setupRealtimeSync } = await import('@/services/syncService')
      
      const cleanup = setupRealtimeSync(user.id, {
        onWatchlistChange: (newWatchlists) => {
          console.log('🔄 Watchlists updated from cloud')
          useStore.setState({ watchlists: newWatchlists })
        },
        onAlertRuleChange: (newRules) => {
          console.log('🔄 Alert rules updated from cloud')
          useStore.setState({ alertRules: newRules })
        },
        onWebhookChange: (newWebhooks) => {
          console.log('🔄 Webhooks updated from cloud')
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
      console.log('🔌 Cleaning up realtime sync')
      cleanup?.()
    }
  }, [user?.id])
  
  // Alert history cleanup interval
  useEffect(() => {
    const interval = setInterval(() => {
      const removedCount = alertHistoryService.cleanupOldAlerts()
      if (removedCount > 0) {
        console.log(`🧹 Cleaned up ${removedCount} old alerts`)
      }
    }, ALERT_HISTORY_CONFIG.CLEANUP_INTERVAL_MS)
    
    return () => clearInterval(interval)
  }, [])
  
  // Alert system state
  const alertRules = useStore((state) => state.alertRules)
  const addAlertRule = useStore((state) => state.addAlertRule)
  const deleteAlertRule = useStore((state) => state.deleteAlertRule)
  const toggleAlertRule = useStore((state) => state.toggleAlertRule)

  // Local state for UI interactions
  const [searchQuery, setSearchQuery] = useState('')
  // Timeframe selection removed per new plan
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null)
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)
  const [selectedRowIndex, setSelectedRowIndex] = useState(0)
  // Alert history dropdown removed; history now shown via dedicated view
  
  // Ref for search input
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Sentiment filter
  const sentimentFilter = useStore((state) => state.sentimentFilter)

  // Filter and sort coins based on search query, sentiment, and selected list
  const filteredCoins = useMemo(() => {
    if (!coins) return []

    // Apply search filter
    let filtered = coins
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = coins.filter(
        (coin) =>
          coin.symbol.toLowerCase().includes(query) ||
          coin.fullSymbol.toLowerCase().includes(query)
      )
    }

    // Apply sentiment filter
    if (sentimentFilter !== 'all') {
      filtered = filtered.filter((coin) => {
        if (sentimentFilter === 'bullish') {
          return coin.priceChangePercent > 0
        } else if (sentimentFilter === 'bearish') {
          return coin.priceChangePercent < 0
        } else { // neutral
          return coin.priceChangePercent === 0
        }
      })

      // Sort by volume when sentiment filter is active
      filtered = [...filtered].sort((a, b) => b.quoteVolume - a.quoteVolume)
    }

    // Apply list-based sorting only if no sentiment filter
    if (sentimentFilter === 'all') {
      const list = getListById(currentList)
      if (list) {
        return sortCoinsByList(filtered, currentList, list.sortField, list.isBull)
      }
    }

    return filtered
  }, [coins, searchQuery, currentList, sentimentFilter])

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'Escape',
      description: 'Close modal or clear search',
      callback: () => {
        if (selectedCoin) {
          setSelectedCoin(null)
        } else if (searchQuery) {
          setSearchQuery('')
        }
      },
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
    {
      key: 'ArrowDown',
      description: 'Navigate to next coin',
      callback: () => {
        if (!selectedCoin && filteredCoins.length > 0) {
          const nextIndex = (selectedRowIndex + 1) % filteredCoins.length
          setSelectedRowIndex(nextIndex)
        }
      },
      enabled: !selectedCoin,
    },
    {
      key: 'ArrowUp',
      description: 'Navigate to previous coin',
      callback: () => {
        if (!selectedCoin && filteredCoins.length > 0) {
          const prevIndex = selectedRowIndex === 0 ? filteredCoins.length - 1 : selectedRowIndex - 1
          setSelectedRowIndex(prevIndex)
        }
      },
      enabled: !selectedCoin,
    },
    {
      key: 'Enter',
      description: 'Open selected coin details',
      callback: () => {
        if (!selectedCoin && filteredCoins[selectedRowIndex]) {
          setSelectedCoin(filteredCoins[selectedRowIndex])
        }
      },
      enabled: !selectedCoin && filteredCoins.length > 0,
    },
  ])

  return (
    <>
      {/* Handle localStorage → IndexedDB migration on first load */}
      <StorageMigration />
      
      <Layout
        title="Crypto Screener"
        subtitle="Real-time USDT market analysis"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Sidebar - Filters & Controls */}
        <div className={`transition-all duration-300 ${leftSidebarCollapsed ? 'self-start lg:col-span-1' : 'lg:col-span-3'}`}>
          <Sidebar
            position="left"
            title="Filters & Controls"
            isCollapsed={leftSidebarCollapsed}
            onToggle={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
          >
            <MarketSummary />
            {/* ListSelector removed per new plan (dropdown under Market Summary) */}
            <RefreshControl />
            {/* TimeframeSelector removed per new plan */}
          </Sidebar>
        </div>

        {/* Main Content - View Toggle + Tables */}
        <div className={`transition-all duration-300 space-y-4 ${
          leftSidebarCollapsed && rightSidebarCollapsed
            ? 'lg:col-span-10'
            : leftSidebarCollapsed || rightSidebarCollapsed
            ? 'lg:col-span-8'
            : 'lg:col-span-6'
        }`}>
          {/* View Toggle */}
          <ViewToggle
            activeView={activeView}
            onViewChange={setActiveView}
            alertCount={alertStats.length}
          />

          {activeView === 'coins' ? (
            <>
              {/* Search Bar */}
              <SearchBar ref={searchInputRef} onSearch={setSearchQuery} />

              {/* Coin Table */}
              <div className="bg-gray-900 rounded-lg overflow-x-auto">
            {/* Header */}
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    Market Data{' '}
                    <span className="text-accent">USDT</span>
                  </h2>
                  {coins && (
                    <span className="text-sm text-gray-400">
                      {filteredCoins.length} of {coins.length} coins
                      {searchQuery && ' (filtered)'}
                    </span>
                  )}
                </div>
                <ExportButton coins={filteredCoins} disabled={isLoading} />
              </div>
            </div>

            {/* Content */}
            <div className="min-h-[600px]">
              {error ? (
                ErrorStates.API()
              ) : isLoading ? (
                <div className="text-center py-12 text-gray-400">
                  Loading coin data...
                </div>
              ) : (
                <>
                  <SmartCoinTable
                    coins={filteredCoins}
                    onCoinClick={setSelectedCoin}
                    selectedRowIndex={selectedRowIndex}
                  />

                  {filteredCoins &&
                    filteredCoins.length === 0 &&
                    searchQuery &&
                    EmptyStates.NoSearchResults(searchQuery, () => setSearchQuery(''))}

                  {filteredCoins &&
                    filteredCoins.length === 0 &&
                    !searchQuery &&
                    coins &&
                    coins.length === 0 &&
                    EmptyStates.NoCoins('USDT')}
                </>
              )}
            </div>
          </div>
            </>
          ) : (
            /* Alert History View */
            <div className="bg-gray-900 rounded-lg overflow-hidden p-6">
              <AlertHistoryTable
                stats={alertStats}
                onCoinClick={(symbol) => {
                  const coin = coins?.find((c) => c.symbol === symbol)
                  if (coin) setSelectedCoin(coin)
                }}
                onClearHistory={() => {
                  if (confirm('Clear all alert history? This cannot be undone.')) {
                    clearAlertHistory()
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Right Sidebar - Alerts */}
        <div className={`transition-all duration-300 ${rightSidebarCollapsed ? 'self-start lg:col-span-1' : 'lg:col-span-3'}`}>
          <Sidebar
            position="right"
            title="Alert Configuration"
            isCollapsed={rightSidebarCollapsed}
            onToggle={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
          >
            {/* Alert Configuration */}
            {!rightSidebarCollapsed && (
              <div className="mt-4 space-y-4">
                <AlertConfig 
                  rules={alertRules}
                  onRuleToggle={toggleAlertRule}
                  onRuleCreate={addAlertRule}
                  onRuleDelete={deleteAlertRule}
                />
                
                {/* Inline alert history dropdown removed per UI cleanup */}
              </div>
            )}
          </Sidebar>
        </div>
      </div>

      {/* Coin Detail Modal */}
      <Suspense fallback={null}>
        <CoinModal
          coin={selectedCoin}
          isOpen={!!selectedCoin}
          onClose={() => setSelectedCoin(null)}
        />
      </Suspense>

      {/* Keyboard Shortcuts Help */}
      <ShortcutHelp
        isOpen={showShortcutHelp}
        onClose={() => setShowShortcutHelp(false)}
        shortcuts={[
          { key: 'Escape', description: 'Close modal or clear search', callback: () => {} },
          { key: 'k', ctrl: true, description: 'Focus search bar', callback: () => {} },
          { key: '?', description: 'Show keyboard shortcuts', callback: () => {} },
          { key: 'ArrowDown', description: 'Navigate to next coin', callback: () => {} },
          { key: 'ArrowUp', description: 'Navigate to previous coin', callback: () => {} },
          { key: 'Enter', description: 'Open selected coin details', callback: () => {} },
        ]}
      />
      
      {/* Alert Notifications (renders outside layout in top-right) */}
      <AlertNotificationContainer />
    </Layout>
    </>
  )
}

export default App
