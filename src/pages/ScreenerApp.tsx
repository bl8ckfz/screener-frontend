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
import { useAlertRules } from '@/hooks/useAlertRules'
import { alertHistoryService } from '@/services'
import { ALERT_HISTORY_CONFIG } from '@/types'
import { Layout } from '@/components/layout'
import { ChartSection, CoinTable } from '@/components/coin'
import { MobileCoinDrawer } from '@/components/coin/MobileCoinDrawer'
import { MarketSummary } from '@/components/market'
import { SearchBar } from '@/components/controls'
import { ShortcutHelp, BackendStatus } from '@/components/ui'
import { StorageMigration } from '@/components/StorageMigration'
import { AlertHistoryTable } from '@/components/alerts'
import { useSelectedDojoSetup } from '@/hooks/useSelectedDojoSetup'
import { useAuth } from '@/hooks/useAuth'
import { SettingsModal } from '@/components/settings'
import { FEATURE_FLAGS } from '@/config'
import { DojoSetupsTable } from '@/components/dojo/DojoSetupsTable'
import { coinFromDojoSetup } from '@/types/dojo'
import type { DojoSetup } from '@/types/dojo'
import type { Coin } from '@/types/coin'
import type { CoinAlertStats } from '@/types/alertHistory'

/**
 * The coin the right-hand chart is showing, and its alert activity.
 *
 * alertStat is optional on purpose: a Dojo zone can outlive its symbol's place
 * in the tracked universe, so a plan may well be selected for a coin that has
 * fired no alerts in the retained window.
 */
interface SelectedAlert {
  coin: Coin
  alertStat?: CoinAlertStats
}

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
  const sentimentFilter = useStore((state) => state.sentimentFilter)
  const alertStats = useAlertStats(coins || [])
  
  // Auto-hide header config
  const autoHideHeader = useStore((state) => state.config.display.autoHideHeader)
  
  // Per-user rule toggles (backend sync)
  const { isRuleEnabled } = useAlertRules()

  // Backend WebSocket alerts
  const addAlert = useStore((state) => state.addAlert)
  const { isConnected: backendWsConnected } = useBackendAlerts({
    enabled: true,
    autoConnect: true,
    isRuleEnabled,
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
  // Typed rather than `any`, because an updater callback over an `any` state
  // gives its parameter an implicit any and fails the strict build.
  const [selectedAlert, setSelectedAlert] = useState<SelectedAlert | null>(null)
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'coins' | 'alerts' | 'dojo'>('coins')
  // The open Dojo plan. Held by a hook rather than useState because it also
  // lives in the URL (so a refresh keeps it) and can be opened by id alone
  // (which is all an alert carries).
  const { isAuthenticated } = useAuth()
  const dojoSelection = useSelectedDojoSetup(isAuthenticated)
  const selectedDojoSetup = dojoSelection.setup
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
    // Clearing is right HERE and only here: this is the row click, which is
    // about the coin. A Dojo alert inside that row has its own handler below
    // and must not be routed through this one, or opening a plan would be
    // immediately undone.
    dojoSelection.clear()
    const coin = coins?.find((c) => c.symbol === symbol)
    if (coin) {
      const alertStat = alertStats.find((stat) => stat.symbol === symbol)
      setSelectedAlert({ coin, alertStat })
    }
  }

  // Handle a Dojo zone being selected.
  //
  // dojo_setups stores the full perp symbol (1000FLOKIUSDT) while coins are
  // keyed on the base (1000FLOKI), which is the same mismatch the alert tab
  // has — so it reuses the same normalisation rather than inventing another.
  const handleDojoSetupSelect = (setup: DojoSetup) => {
    dojoSelection.select(setup)
    const base = setup.symbol.replace(/(USDT|FDUSD|TRY)$/, '')
    // A zone outlives the coin list. dojo_setups holds a symbol until it fills
    // or resolves, which can be weeks, while coins is the top ~200 by 24h
    // volume — so a symbol that drops out loses nothing but its row here.
    // Falling back to a placeholder keeps the chart working, because
    // /api/klines proxies any Binance symbol rather than only tracked ones.
    // Previously this branch simply did nothing and the panel kept showing
    // whichever coin was selected before, with no indication why.
    const coin =
      coins?.find((c) => c.symbol === base || c.fullSymbol === setup.symbol) ??
      coinFromDojoSetup(setup, livePrices[setup.symbol])
    const alertStat = alertStats.find((stat) => stat.symbol === coin.symbol)
    setSelectedAlert({ coin, alertStat })
  }

  // Open the exact plan a Dojo alert refers to.
  //
  // THIS IS THE CONNECTION THAT WAS MISSING. The backend has always sent a
  // setup_id on its Dojo alerts; both alert transforms dropped it, and the
  // row click then cleared any zone overlay — so an alert reading "price
  // entered the zone" opened a chart with no zone on it, and the user had to
  // find the row by hand in another tab.
  //
  // Only the id is known here, so the plan is fetched by id. It deliberately
  // does NOT fall back to another setup on the same symbol: a symbol
  // routinely carries a long and a short on different timeframes, and the
  // substitute would be a different thesis with different levels.
  const handleOpenDojoSetup = (setupId: string) => {
    dojoSelection.selectById(setupId)
  }

  // Once the plan resolves, bring the chart with it. Split from the click
  // because the row arrives asynchronously when opened by id, and the chart
  // needs the symbol the plan names rather than the one the alert row sat in.
  useEffect(() => {
    const setup = dojoSelection.setup
    if (!setup) return

    const base = setup.symbol.replace(/(USDT|FDUSD|TRY)$/, '')
    const coin =
      coins?.find((c) => c.symbol === base || c.fullSymbol === setup.symbol) ??
      coinFromDojoSetup(setup, livePrices[setup.symbol])

    // Only when it actually changes. The plan resolving must not re-set an
    // identical selection, or the chart would remount on every poll.
    setSelectedAlert((prev) =>
      prev?.coin?.fullSymbol === coin.fullSymbol && prev?.coin?.symbol === coin.symbol
        ? prev
        : { coin, alertStat: alertStats.find((stat) => stat.symbol === coin.symbol) }
    )
    // alertStats changes every poll and must not re-run this; the plan and the
    // coin list are what decide which coin to show.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dojoSelection.setup?.id, coins])

  // Handle coin table row click
  const handleCoinClick = (coin: any) => {
    dojoSelection.clear()
    const alertStat = alertStats.find((stat) => stat.symbol === coin.symbol)
    setSelectedAlert({ coin, alertStat })
  }

  // Live price per full symbol (BTCUSDT), which is how dojo_setups keys its
  // rows. Without this the Dojo table's "To entry" column measures from the
  // close when the zone armed and never moves again.
  const livePrices = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of coins ?? []) {
      if (c.fullSymbol && c.lastPrice > 0) m[c.fullSymbol] = c.lastPrice
    }
    return m
  }, [coins])

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
        title="Coin Sniffer"
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
                    : activeTab === 'dojo'
                      ? 'Search zones by symbol...'
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
                <button
                  onClick={() => setActiveTab('dojo')}
                  className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
                    activeTab === 'dojo'
                      ? 'bg-gray-700 text-white border-b-2 border-accent'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>🥋 Dojo Zones</span>
                  </div>
                </button>
              </div>

              {/* Tab Content */}
              <div className="overflow-y-auto scrollbar-hide flex-1 min-h-0">
                {activeTab === 'coins' && (
                  <CoinTable
                    coins={filteredCoins}
                    onCoinClick={handleCoinClick}
                    isLoading={isLoading}
                  />
                )}
                {activeTab === 'alerts' && (
                  <AlertHistoryTable
                    stats={filteredAlertStats}
                    selectedSymbol={selectedAlert?.coin?.symbol}
                    onAlertClick={handleAlertClick}
                    onOpenDojoSetup={handleOpenDojoSetup}
                    activeSetupId={dojoSelection.setupId}
                  />
                )}
                {activeTab === 'dojo' && (
                  <DojoSetupsTable
                    onSetupSelect={handleDojoSetupSelect}
                    // The ID rather than the loaded row, so a plan opened from
                    // an alert highlights its row immediately instead of only
                    // once the fetch lands.
                    selectedId={dojoSelection.setupId}
                    livePrices={livePrices}
                    searchQuery={searchQuery}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Chart */}
          <div className={`lg:col-span-7 ${mobileSheetEnabled ? 'hidden md:block' : ''}`}>
            {/* A plan that could not be found is SAID, never substituted.
                Showing another zone on the same symbol would be a different
                thesis with different levels, presented as the one that was
                asked for. */}
            {dojoSelection.isMissing && (
              <div className="mb-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                <p className="font-semibold">That plan is no longer available.</p>
                <p className="mt-1 text-amber-200/80">
                  The alert refers to a setup that is not in the current records. Nothing
                  else is shown in its place, because another zone on the same symbol
                  would be a different trade with different levels.
                </p>
                <button
                  type="button"
                  onClick={() => dojoSelection.clear()}
                  className="mt-2 rounded border border-amber-400/40 px-2 py-1 text-xs font-medium hover:bg-amber-500/20"
                >
                  Dismiss
                </button>
              </div>
            )}
            <ChartSection 
              selectedCoin={liveCoin}
              dojoSetup={selectedDojoSetup}
              onClose={() => setSelectedAlert(null)}
            />
          </div>
        </div>

        {/* Mobile Chart Drawer */}
        {mobileSheetEnabled && liveCoin && (
          <MobileCoinDrawer
            open={!!liveCoin}
            selectedCoin={liveCoin}
            dojoSetup={selectedDojoSetup}
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
