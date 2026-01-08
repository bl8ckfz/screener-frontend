import { useState, useMemo } from 'react'
import type { CoinAlertStats } from '@/types/alertHistory'
import { AlertBadges } from './AlertBadges'
import { EmptyAlertHistory } from './EmptyAlertHistory'
import { formatNumber } from '@/utils/format'
import { Button, Badge } from '@/components/ui'
import { WatchlistBadge } from '@/components/watchlist/WatchlistBadge'
import { useStore } from '@/hooks/useStore'

interface AlertHistoryTableProps {
  stats: CoinAlertStats[]
  selectedSymbol?: string
  onAlertClick: (symbol: string, alert: CoinAlertStats) => void
  onClearHistory: () => void
}

type SortField = 'symbol' | 'price' | 'change' | 'alerts' | 'lastAlert'
type SortDirection = 'asc' | 'desc'

/**
 * Alert History Table - displays coins sorted by alert count
 * Split into two sections: Watchlist Alerts (top) and Main Alerts (bottom)
 * Phase 8.1.2: Redesign with visual separation
 */
export function AlertHistoryTable({ stats, selectedSymbol, onAlertClick, onClearHistory }: AlertHistoryTableProps) {
  const [sortField, setSortField] = useState<SortField>('alerts')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [watchlistCollapsed, setWatchlistCollapsed] = useState(false)
  const [mainCollapsed, setMainCollapsed] = useState(false)
  
  // Get current watchlist symbols
  const currentWatchlistId = useStore((state) => state.currentWatchlistId)
  const watchlists = useStore((state) => state.watchlists)
  const currentWatchlist = useMemo(() => {
    return watchlists.find((wl) => wl.id === currentWatchlistId)
  }, [watchlists, currentWatchlistId])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'symbol' ? 'asc' : 'desc')
    }
  }

  // Sort function
  const sortStats = (statsToSort: CoinAlertStats[]) => {
    return [...statsToSort].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol)
          break
        case 'price':
          comparison = a.currentPrice - b.currentPrice
          break
        case 'change':
          comparison = a.priceChange - b.priceChange
          break
        case 'alerts':
          comparison = a.totalAlerts - b.totalAlerts
          break
        case 'lastAlert':
          comparison = a.lastAlertTimestamp - b.lastAlertTimestamp
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }
  
  // Split stats into watchlist and main sections, then sort each independently
  const { watchlistStats, mainStats } = useMemo(() => {
    if (!currentWatchlist) {
      return { watchlistStats: [], mainStats: sortStats(stats) }
    }
    
    const watchlist: CoinAlertStats[] = []
    const main: CoinAlertStats[] = []
    
    stats.forEach((stat) => {
      if (currentWatchlist.symbols.includes(stat.symbol)) {
        watchlist.push(stat)
      } else {
        main.push(stat)
      }
    })
    
    return { 
      watchlistStats: sortStats(watchlist), 
      mainStats: sortStats(main) 
    }
  }, [stats, currentWatchlist, sortField, sortDirection])

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }
  
  // Render table rows for a section - COMPACT VERSION
  const renderRows = (statsToRender: CoinAlertStats[]) => (
    statsToRender.map((stat) => (
      <tr
        key={stat.symbol}
        className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors cursor-pointer text-sm ${
          selectedSymbol === stat.symbol ? 'bg-blue-800/40' : ''
        }`}
        onClick={() => onAlertClick(stat.symbol, stat)}
      >
        {/* Watchlist Star */}
        <td className="py-1.5 px-2 w-10" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center">
            <WatchlistBadge symbol={stat.symbol} />
          </div>
        </td>

        {/* Symbol */}
        <td className="py-1.5 px-2">
          <div className="flex items-center gap-1">
            <span className="font-mono font-semibold text-white text-sm">
              {stat.symbol}
            </span>
          </div>
        </td>

        {/* Current Price */}
        <td className="py-1.5 px-2 text-right font-mono text-xs text-gray-200">
          {stat.currentPrice < 0.0001
            ? stat.currentPrice.toFixed(8)
            : stat.currentPrice < 1
            ? stat.currentPrice.toFixed(6)
            : formatNumber(stat.currentPrice)}
        </td>

        {/* 24h Change */}
        <td className="py-1.5 px-2 text-right font-mono text-xs font-semibold">
          <span
            className={
              stat.priceChange >= 0
                ? 'text-green-400'
                : 'text-red-400'
            }
          >
            {stat.priceChange >= 0 ? '+' : ''}
            {stat.priceChange.toFixed(1)}%
          </span>
        </td>

        {/* Total Alerts */}
        <td className="py-1.5 px-2 text-center">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent font-bold text-xs">
            {stat.totalAlerts}
          </span>
        </td>

        {/* Alert Type Badges */}
        <td className="py-1.5 px-2">
          <AlertBadges 
            alertTypes={stat.alertTypes} 
            maxVisible={2}
            latestAlertType={stat.alerts[0]?.alertType}
          />
        </td>

        {/* Last Alert Time */}
        <td className="py-1.5 px-2 text-right text-[10px] text-gray-400">
          {formatTimeAgo(stat.lastAlertTimestamp)}
        </td>
      </tr>
    ))
  )
  
  // Early return AFTER all hooks
  if (stats.length === 0) {
    return <EmptyAlertHistory />
  }

  return (
    <div className="space-y-0">
      {/* Header with Clear button - Matches Chart Section Style */}
      <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 rounded-t-lg">
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-semibold text-white">
            Alert History
          </h2>
          <div className="text-xs text-gray-400">
            {stats.length} coins
          </div>
        </div>
        <Button
          onClick={onClearHistory}
          variant="secondary"
          size="sm"
        >
          🗑️
        </Button>
      </div>

      {/* Watchlist Alerts Section */}
      {watchlistStats.length > 0 && (
        <div className="bg-gray-900/60 border-l-2 border-green-400 rounded-r-lg overflow-hidden">
          <div className="sticky top-0 bg-gray-800/80 backdrop-blur-sm px-3 py-1.5 flex items-center justify-between border-b border-green-400/30">
            <Badge variant="success" size="md">
              ⭐ Watchlist ({watchlistStats.length})
            </Badge>
            <button
              onClick={() => setWatchlistCollapsed(!watchlistCollapsed)}
              className="text-[10px] text-gray-300 hover:text-white transition-colors"
            >
              {watchlistCollapsed ? 'Expand ▼' : 'Collapse ▲'}
            </button>
          </div>
          {!watchlistCollapsed && (
            <div>
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b border-gray-600/50 bg-gray-800/50">
                    <th className="text-center py-1 px-2 text-xs font-semibold text-gray-300 w-10">
                      ⭐
                    </th>
                    <th 
                      onClick={() => handleSort('symbol')}
                      className="text-left py-1 px-2 text-xs font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors select-none"
                    >
                      <div className="flex items-center gap-1">
                        Symbol
                        {sortField === 'symbol' && (
                          <span className="text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('price')}
                      className="text-right py-3 px-4 text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Price
                        {sortField === 'price' && (
                          <span className="text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('change')}
                      className="text-right py-3 px-4 text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        24h Change
                        {sortField === 'change' && (
                          <span className="text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('alerts')}
                      className="text-center py-3 px-4 text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none"
                    >
                      <div className="flex items-center justify-center gap-1">
                        Total Alerts
                        {sortField === 'alerts' && (
                          <span className="text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                      Alert Types
                    </th>
                    <th 
                      onClick={() => handleSort('lastAlert')}
                      className="text-right py-3 px-4 text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Last Alert
                        {sortField === 'lastAlert' && (
                          <span className="text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {renderRows(watchlistStats)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Divider - Only show if both sections have data */}
      {watchlistStats.length > 0 && mainStats.length > 0 && (
        <div className="relative">
          <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-gray-900/95 px-4 text-xs text-gray-500 uppercase tracking-wider">
              All Other Alerts
            </div>
          </div>
        </div>
      )}

      {/* Main Alerts Section */}
      {mainStats.length > 0 && (
        <div className="bg-gray-900/60 border-l-2 border-blue-400 rounded-r-lg overflow-hidden">
          <div className="sticky top-0 bg-gray-800/80 backdrop-blur-sm px-3 py-1.5 flex items-center justify-between border-b border-blue-400/30">
            <Badge variant="info" size="md">
              📊 All Alerts ({mainStats.length})
            </Badge>
            <button
              onClick={() => setMainCollapsed(!mainCollapsed)}
              className="text-[10px] text-gray-300 hover:text-white transition-colors"
            >
              {mainCollapsed ? 'Expand ▼' : 'Collapse ▲'}
            </button>
          </div>
          {!mainCollapsed && (
            <div>
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b border-gray-600/50 bg-gray-800/50">
                    <th className="text-center py-1 px-2 text-xs font-semibold text-gray-300 w-10">
                      ⭐
                    </th>
                    <th 
                      onClick={() => handleSort('symbol')}
                      className="text-left py-1 px-2 text-xs font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors select-none"
                    >
                      <div className="flex items-center gap-1">
                        Symbol
                        {sortField === 'symbol' && (
                          <span className="text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('price')}
                      className="text-right py-1 px-2 text-xs font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Price
                        {sortField === 'price' && (
                          <span className="text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('change')}
                      className="text-right py-1 px-2 text-xs font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        24h
                        {sortField === 'change' && (
                          <span className="text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('alerts')}
                      className="text-center py-1 px-2 text-xs font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors select-none"
                    >
                      <div className="flex items-center justify-center gap-1">
                        #
                        {sortField === 'alerts' && (
                          <span className="text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="text-left py-1 px-2 text-xs font-semibold text-gray-300">
                      Types
                    </th>
                    <th 
                      onClick={() => handleSort('lastAlert')}
                      className="text-right py-1 px-2 text-xs font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Time
                        {sortField === 'lastAlert' && (
                          <span className="text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {renderRows(mainStats)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Summary Footer */}
      <div className="text-sm text-gray-500 text-center py-2">
        Total: {stats.reduce((sum, stat) => sum + stat.totalAlerts, 0)} alerts across {stats.length} coins
        {watchlistStats.length > 0 && (
          <span className="ml-2 text-green-400">
            ({watchlistStats.length} watchlist)
          </span>
        )}
      </div>
    </div>
  )
}
