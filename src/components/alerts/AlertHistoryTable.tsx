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

  const sortedStats = useMemo(() => {
    const sorted = [...stats].sort((a, b) => {
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

    return sorted
  }, [stats, sortField, sortDirection])
  
  // Split stats into watchlist and main sections
  const { watchlistStats, mainStats } = useMemo(() => {
    if (!currentWatchlist) {
      return { watchlistStats: [], mainStats: sortedStats }
    }
    
    const watchlist: CoinAlertStats[] = []
    const main: CoinAlertStats[] = []
    
    sortedStats.forEach((stat) => {
      if (currentWatchlist.symbols.includes(stat.symbol)) {
        watchlist.push(stat)
      } else {
        main.push(stat)
      }
    })
    
    return { watchlistStats: watchlist, mainStats: main }
  }, [sortedStats, currentWatchlist])

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }
  
  // Render table rows for a section
  const renderRows = (statsToRender: CoinAlertStats[]) => (
    statsToRender.map((stat) => (
      <tr
        key={stat.symbol}
        className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer ${
          selectedSymbol === stat.symbol ? 'bg-blue-900/30' : ''
        }`}
        onClick={() => onAlertClick(stat.symbol, stat)}
      >
        {/* Watchlist Star */}
        <td className="py-3 px-3 w-16" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center">
            <WatchlistBadge symbol={stat.symbol} />
          </div>
        </td>

        {/* Symbol */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-white">
              {stat.symbol}
            </span>
            <span className="text-xs text-gray-500">USDT</span>
          </div>
        </td>

        {/* Current Price */}
        <td className="py-3 px-4 text-right font-mono text-sm text-gray-200">
          {stat.currentPrice < 0.0001
            ? stat.currentPrice.toFixed(8)
            : stat.currentPrice < 1
            ? stat.currentPrice.toFixed(6)
            : formatNumber(stat.currentPrice)}
        </td>

        {/* 24h Change */}
        <td className="py-3 px-4 text-right font-mono text-sm font-semibold">
          <span
            className={
              stat.priceChange >= 0
                ? 'text-green-400'
                : 'text-red-400'
            }
          >
            {stat.priceChange >= 0 ? '+' : ''}
            {stat.priceChange.toFixed(2)}%
          </span>
        </td>

        {/* Total Alerts */}
        <td className="py-3 px-4 text-center">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-accent/20 text-accent font-bold text-sm">
            {stat.totalAlerts}
          </span>
        </td>

        {/* Alert Type Badges */}
        <td className="py-3 px-4">
          <AlertBadges 
            alertTypes={stat.alertTypes} 
            maxVisible={3}
            latestAlertType={stat.alerts[0]?.alertType}
          />
        </td>

        {/* Last Alert Time */}
        <td className="py-3 px-4 text-right text-xs text-gray-400">
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
    <div className="space-y-4">
      {/* Header with Clear button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            Alert History
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Showing {stats.length} coins with alerts in the last 24 hours
          </p>
        </div>
        <Button
          onClick={onClearHistory}
          variant="secondary"
          size="sm"
        >
          🗑️ Clear History
        </Button>
      </div>

      {/* Watchlist Alerts Section */}
      {watchlistStats.length > 0 && (
        <div className="bg-green-900/10 border-l-4 border-green-500 rounded-r-lg overflow-hidden">
          <div className="sticky top-0 bg-gray-900 px-4 py-3 flex items-center justify-between border-b border-green-500/30">
            <Badge variant="success" size="md">
              ⭐ Watchlist Alerts ({watchlistStats.length})
            </Badge>
            <button
              onClick={() => setWatchlistCollapsed(!watchlistCollapsed)}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              {watchlistCollapsed ? 'Expand ▼' : 'Collapse ▲'}
            </button>
          </div>
          {!watchlistCollapsed && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-center py-3 px-3 text-sm font-semibold text-gray-400 w-16">
                      ⭐
                    </th>
                    <th 
                      onClick={() => handleSort('symbol')}
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none"
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
          <div className="h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-gray-900 px-4 text-xs text-gray-500 uppercase tracking-wider">
              All Other Alerts
            </div>
          </div>
        </div>
      )}

      {/* Main Alerts Section */}
      {mainStats.length > 0 && (
        <div className="bg-blue-900/10 border-l-4 border-blue-500 rounded-r-lg overflow-hidden">
          <div className="sticky top-0 bg-gray-900 px-4 py-3 flex items-center justify-between border-b border-blue-500/30">
            <Badge variant="info" size="md">
              📊 All Alerts ({mainStats.length})
            </Badge>
            <button
              onClick={() => setMainCollapsed(!mainCollapsed)}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              {mainCollapsed ? 'Expand ▼' : 'Collapse ▲'}
            </button>
          </div>
          {!mainCollapsed && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-center py-3 px-3 text-sm font-semibold text-gray-400 w-16">
                      ⭐
                    </th>
                    <th 
                      onClick={() => handleSort('symbol')}
                      className="text-left py-3 px-4 text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none"
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
                  {renderRows(mainStats)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Summary Footer */}
      <div className="text-sm text-gray-500 text-center py-2">
        Total: {sortedStats.reduce((sum, stat) => sum + stat.totalAlerts, 0)} alerts across {sortedStats.length} coins
        {watchlistStats.length > 0 && (
          <span className="ml-2 text-green-400">
            ({watchlistStats.length} watchlist)
          </span>
        )}
      </div>
    </div>
  )
}
