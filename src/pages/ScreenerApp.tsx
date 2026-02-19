/**
 * Screener App
 * 
 * Main authenticated application view.
 * Extracted from App.tsx — contains all screener functionality.
 * Only accessible behind ProtectedRoute.
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { debug } from '@/utils/debug'
import { memoryProfiler } from '@/utils/memoryProfiler'
import { useStore } from '@/hooks/useStore'
import { useKeyboardShortcuts, useAlertStats, useBackendAlerts, useBackendData } from '@/hooks'
import { alertHistoryService } from '@/services'
import { ALERT_HISTORY_CONFIG } from '@/types'
import { Layout } from '@/components/layout'
import { ChartSection, CoinTable } from '@/components/coin'
import { MobileCoinDrawer } from '@/components/coin/MobileCoinDrawer'
import { MarketSummary } from '@/components/market'
import { SearchBar } from '@/components/controls'
import { ShortcutHelp, BackendStatus } from '@/components/ui'
import { StorageMigration } from '@/components/StorageMigration'
import { AlertNotificationContainer, AlertHistoryTable } from '@/components/alerts'
import { SettingsModal } from '@/components/settings'
import { FEATURE_FLAGS } from '@/config'

export function ScreenerApp() {
  // Backend data polling (every 5 seconds)
  const { data: coins, isLoading, error } = useBackendData()
  
  useEffect(() => {
    console.log('🚀 [ScreenerApp] Using BACKEND API')
    console.log('📊 Backend:', import.meta.env.VITE_BACKEND_API_URL)
  }, [])
  
  useEffect(() => {
    if (error) {
      console.error('❌ Backend data error:', error)
    }
  }, [error])
  
  // Alert history state
  const clearAlertHistory = useStore((state) => state.clearAlertHistory)
  const sentimentFilter = useStore((state) => state.sentimentFilter)
  const alertStats = useAlertStats(coins || [])
  
  // Auto-hide header config
  const autoHideHeader = useStore((state) => state.config.display.autoHideHeader)
  
  // Backend WebSocket alerts
  const addAlert = useStore((state) => state.addAlert)
  const { isConnected: backendWsConnected } = useBackendAlerts({
    enabled: true,
    autoConnect: true,
    onAlert: (alert) => {
      debug.log('🚨 Backend alert (WebSocket):', alert.symbol, alert.type)
      addAlert(alert)
    }
  })
  
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

  // Local state for UI interactions
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAlert, setSelectedAlert] = useState<any>(null)
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'coins' | 'alerts'>('coins')
  const [isMobile, setIsMobile] = useState(false)
  
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
  
  // Handle alert click
  const handleAlertClick = (symbol: string) => {
    const coin = coins?.find((c) => c.symbol === symbol)
    if (coin) {
      const alertStat = alertStats.find((stat) => stat.symbol === symbol)
      setSelectedAlert({ coin, alertStat })
    }
  }

  // Handle coin table row click
  const handleCoinClick = (coin: any) => {
    const alertStat = alertStats.find((stat) => stat.symbol === coin.symbol)
    setSelectedAlert({ coin, alertStat })
  }

  // Get live coin data for selected coin
  const liveCoin = useMemo(() => {
    if (!selectedAlert?.coin || !coins) return selectedAlert?.coin || null
    const updated = coins.find(c => c.symbol === selectedAlert.coin.symbol)
    return updated || selectedAlert.coin
  }, [selectedAlert?.coin, coins])

  return (
    <>
      <StorageMigration />
      
      <Layout
        title="Screener"
        subtitle="Real-time USDT market analysis"
        onOpenSettings={() => setIsSettingsOpen(true)}
        autoHideHeader={autoHideHeader}
      >
        {/* Market Summary Bar */}
        <div className="mb-4">
          <div className="bg-gray-700/40 backdrop-blur-sm rounded-lg px-2 md:px-4 py-1.5 md:py-2 border border-gray-600 overflow-hidden">
            <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-2 w-full max-w-full">
              <MarketSummary coins={coins ?? undefined} isLoading={isLoading} />
              <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
                <BackendStatus wsConnected={backendWsConnected} />
                {error && (
                  <div className="text-[10px] md:text-xs text-error-text bg-error-bg border border-error-border rounded px-1.5 md:px-2 py-0.5 md:py-1 truncate max-w-[150px] md:max-w-none">
                    Backend Error: {error instanceof Error ? error.message : 'Unknown error'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column - Tabbed View */}
          <div className="lg:col-span-5 space-y-3">
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

            <div
              className={
                mobileSheetEnabled
                  ? 'sticky top-[124px] z-20 bg-gray-800 rounded-lg border border-gray-700 flex flex-col'
                  : 'bg-gray-800 rounded-lg border border-gray-700 flex flex-col'
              }
              style={{ maxHeight: 'calc(100vh - 140px)' }}
            >
              {/* Tab Buttons */}
              <div className="flex items-center border-b border-gray-700 bg-gray-800 flex-shrink-0">
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
              <div className="overflow-y-auto scrollbar-hide flex-1 min-h-0">
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
          </div>

          {/* Right Column - Chart */}
          <div className={`lg:col-span-7 ${mobileSheetEnabled ? 'hidden md:block' : ''}`}>
            <ChartSection 
              selectedCoin={liveCoin}
              onClose={() => setSelectedAlert(null)}
            />
          </div>
        </div>

        {/* Mobile Chart Drawer */}
        {mobileSheetEnabled && liveCoin && (
          <MobileCoinDrawer
            open={!!liveCoin}
            selectedCoin={liveCoin}
            onClose={() => setSelectedAlert(null)}
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
        
        {/* Alert Notifications */}
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
    }, 10000)

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
