import { useMemo } from 'react'
import type { CoinAlertStats } from '@/types/alertHistory'
import { AlertBadges } from './AlertBadges'
import { dojoChips } from './dojoPlanBadges'
import { useLiveDojoSetups } from '@/hooks/useLiveDojoSetups'
import { EmptyAlertHistory } from './EmptyAlertHistory'
import { formatNumber } from '@/utils/format'
import { WatchlistStar } from '@/components/coin/WatchlistStar'
import { useStore } from '@/hooks/useStore'
import { FEATURE_FLAGS } from '@/config'

interface AlertHistoryTableProps {
  stats: CoinAlertStats[]
  selectedSymbol?: string
  onAlertClick: (symbol: string, alert: CoinAlertStats) => void
  /**
   * Opens the exact Dojo plan an alert refers to.
   *
   * Separate from onAlertClick because the two mean different things. A row
   * click selects a COIN; this selects a PLAN, and the row it sits in cannot
   * identify one — the table aggregates by symbol, and a symbol routinely
   * carries two zones.
   */
  onOpenDojoSetup?: (setupId: string) => void
  /** The plan currently open, so its chip reads as selected. */
  activeSetupId?: string | null
}

type SortField = 'symbol' | 'price' | 'change' | 'alerts' | 'lastAlert'

export function AlertHistoryTable({
  stats,
  selectedSymbol,
  onAlertClick,
  onOpenDojoSetup,
  activeSetupId,
}: AlertHistoryTableProps) {
  // Which coins have a plan IN PLAY, from dojo_setups rather than from the
  // alert stream. The badges below are alert types, read over 48 hours from a
  // table kept for seven days; a Dojo plan outlives both, so once its armed
  // alert ages out nothing in the row says the coin has a plan at all.
  const { bySymbol: livePlans } = useLiveDojoSetups()

  const watchlistSymbols = useStore((state) => state.watchlistSymbols)
  const alertHistorySort = useStore((state) => state.alertHistorySort)
  const setAlertHistorySort = useStore((state) => state.setAlertHistorySort)
  
  const { field: sortField, direction: sortDirection } = alertHistorySort

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setAlertHistorySort({ field, direction: sortDirection === 'asc' ? 'desc' : 'asc' })
    } else {
      setAlertHistorySort({ field, direction: field === 'symbol' ? 'asc' : 'desc' })
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

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const renderCard = (stat: CoinAlertStats) => (
    <button
      key={stat.symbol}
      onClick={() => onAlertClick(stat.symbol, stat)}
      className={`w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-left shadow-sm transition hover:border-accent/60 hover:shadow-lg ${
        selectedSymbol === stat.symbol ? 'ring-1 ring-accent' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <WatchlistStar symbol={stat.symbol} />
          <div>
            <div className="font-mono text-sm font-semibold text-white">{stat.symbol}</div>
            <AlertBadges
              alertTypes={stat.alertTypes}
              maxVisible={4}
              latestAlertType={stat.alerts[0]?.alertType}
              pinned={dojoChips(livePlans.get(stat.symbol), stat.alerts, onOpenDojoSetup, activeSetupId)}
            />
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm text-gray-100">{stat.currentPrice < 1 ? stat.currentPrice.toFixed(6) : formatNumber(stat.currentPrice)}</div>
          <div className={`font-mono text-xs font-semibold ${stat.priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {stat.priceChange >= 0 ? '+' : ''}
            {stat.priceChange.toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
        {stat.totalAlerts > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-1 font-semibold text-accent">
            {stat.totalAlerts}
            <span className="text-[10px] uppercase text-accent/70">alerts</span>
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-gray-700/40 px-2 py-1 font-semibold text-gray-400"
            title="No alerts in the last 48 hours. This coin is listed because it has a Dojo plan in play."
          >
            <span className="text-[10px] uppercase">plan only</span>
          </span>
        )}
        <span>{stat.lastAlertTimestamp > 0 ? formatTimeAgo(stat.lastAlertTimestamp) : ''}</span>
      </div>
    </button>
  )
  
  // Split stats into watchlist and main sections, then sort each independently
  const { watchlistStats, mainStats } = useMemo(() => {
    const watchlist: CoinAlertStats[] = []
    const main: CoinAlertStats[] = []
    
    stats.forEach((stat) => {
      if (watchlistSymbols.includes(stat.symbol)) {
        watchlist.push(stat)
      } else {
        main.push(stat)
      }
    })
    
    return { 
      watchlistStats: sortStats(watchlist), 
      mainStats: sortStats(main) 
    }
  }, [stats, watchlistSymbols, sortField, sortDirection])

  if (stats.length === 0) {
    return <EmptyAlertHistory />
  }

  const sortChips: { field: SortField; label: string }[] = [
    { field: 'alerts', label: 'Alerts' },
    { field: 'lastAlert', label: 'Latest' },
    { field: 'price', label: 'Price' },
    { field: 'change', label: 'Change' },
    { field: 'symbol', label: 'A-Z' },
  ]

  const showCards = FEATURE_FLAGS.mobileCardView

  const cardContent = showCards ? (
    <div className="space-y-2 md:hidden">
      <div className="flex items-center justify-between px-1 text-sm text-gray-300">
        <span className="font-semibold">Alert History</span>
      </div>

      {/* Mobile sort chips */}
      <div className="flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-hide">
        {sortChips.map(({ field, label }) => {
          const isActive = sortField === field
          return (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={`flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-accent/20 text-accent'
                  : 'bg-gray-700/60 text-gray-400 hover:text-gray-200'
              }`}
            >
              {label}
              {isActive && (
                <span className="text-[10px]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              )}
            </button>
          )
        })}
      </div>

      {watchlistStats.map((stat) => renderCard(stat))}

      {watchlistStats.length > 0 && mainStats.length > 0 && (
        <div className="flex items-center gap-2 px-1 py-1 text-xs text-accent/70">
          <span className="h-px flex-1 bg-accent/30" />
          <span>Other Alerts</span>
          <span className="h-px flex-1 bg-accent/30" />
        </div>
      )}

      {mainStats.map((stat) => renderCard(stat))}

      {watchlistStats.length === 0 && mainStats.length === 0 && (
        <div className="py-8 text-center text-gray-500">No alerts yet</div>
      )}
    </div>
  ) : null

  const tableContent = (
    <div className={showCards ? 'hidden overflow-x-auto md:block' : 'overflow-x-auto'}>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-900 sticky top-0 z-10">
          <tr className="border-b border-gray-700">
            <th className="px-3 py-3 text-center text-sm font-semibold text-gray-400 whitespace-nowrap w-16 bg-gray-900">
              ⭐
            </th>
            <th 
              onClick={() => handleSort('symbol')}
              className="px-3 py-3 text-left text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none whitespace-nowrap bg-gray-900"
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
              className="px-3 py-3 text-right text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none whitespace-nowrap bg-gray-900"
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
              className="px-3 py-3 text-right text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none whitespace-nowrap bg-gray-900"
            >
              <div className="flex items-center justify-end gap-1">
                Change %
                {sortField === 'change' && (
                  <span className="text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </div>
            </th>
            <th 
              onClick={() => handleSort('alerts')}
              className="px-3 py-3 text-center text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none whitespace-nowrap bg-gray-900"
            >
              <div className="flex items-center justify-center gap-1">
                Alerts
                {sortField === 'alerts' && (
                  <span className="text-accent">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </div>
            </th>
            <th className="px-3 py-3 text-left text-sm font-semibold text-gray-400 whitespace-nowrap bg-gray-900">
              Types
            </th>
            <th 
              onClick={() => handleSort('lastAlert')}
              className="px-3 py-3 text-right text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors select-none whitespace-nowrap bg-gray-900"
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
          {/* Watchlist alerts */}
          {watchlistStats.map((stat) => (
            <tr
              key={stat.symbol}
              className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors cursor-pointer text-sm ${
                selectedSymbol === stat.symbol ? 'bg-blue-800/40' : ''
              }`}
              onClick={() => onAlertClick(stat.symbol, stat)}
            >
              <td className="py-1.5 px-2 w-10">
                <div className="flex items-center justify-center">
                  <WatchlistStar symbol={stat.symbol} />
                </div>
              </td>
              <td className="py-1.5 px-2">
                <span className="font-mono font-semibold text-white text-sm">{stat.symbol}</span>
              </td>
              <td className="py-1.5 px-2 text-right font-mono text-xs text-gray-200">
                {stat.currentPrice < 0.0001
                  ? stat.currentPrice.toFixed(8)
                  : stat.currentPrice < 1
                  ? stat.currentPrice.toFixed(6)
                  : formatNumber(stat.currentPrice)}
              </td>
              <td className="py-1.5 px-2 text-right font-mono text-xs font-semibold">
                <span className={stat.priceChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {stat.priceChange >= 0 ? '+' : ''}
                  {stat.priceChange.toFixed(1)}%
                </span>
              </td>
              <td className="py-1.5 px-2 text-center">
                {/* Zero is truthful and needs saying differently: the row is
                    here for a Dojo plan, not because something fired. A "0"
                    reads as a count nobody asked for. */}
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                    stat.totalAlerts > 0
                      ? 'bg-accent/20 text-accent'
                      : 'bg-gray-700/40 text-gray-500'
                  }`}
                  title={
                    stat.totalAlerts > 0
                      ? undefined
                      : 'No alerts in the last 48 hours. This coin is listed because it has a Dojo plan in play.'
                  }
                >
                  {stat.totalAlerts > 0 ? stat.totalAlerts : '–'}
                </span>
              </td>
              <td className="py-1.5 px-2">
                <AlertBadges 
                  alertTypes={stat.alertTypes} 
                  maxVisible={4}
                  latestAlertType={stat.alerts[0]?.alertType}
                  pinned={dojoChips(livePlans.get(stat.symbol), stat.alerts, onOpenDojoSetup, activeSetupId)}
                />
              </td>
              <td className="py-1.5 px-2 text-right text-[10px] text-gray-400">
                {formatTimeAgo(stat.lastAlertTimestamp)}
              </td>
            </tr>
          ))}
          
          {/* Visual separator */}
          {watchlistStats.length > 0 && mainStats.length > 0 && (
            <tr>
              <td colSpan={8} className="px-0 py-0">
                <div className="border-t-2 border-accent/30 relative">
                  <div className="absolute left-0 right-0 top-0 flex items-center justify-center">
                    <span className="bg-gray-800 px-3 py-0.5 text-xs text-accent/60 -mt-2.5 rounded-full border border-accent/30">
                      Other Alerts
                    </span>
                  </div>
                </div>
              </td>
            </tr>
          )}
          
          {/* Other alerts */}
          {mainStats.map((stat) => (
            <tr
              key={stat.symbol}
              className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors cursor-pointer text-sm ${
                selectedSymbol === stat.symbol ? 'bg-blue-800/40' : ''
              }`}
              onClick={() => onAlertClick(stat.symbol, stat)}
            >
              <td className="py-1.5 px-2 w-10">
                <div className="flex items-center justify-center">
                  <WatchlistStar symbol={stat.symbol} />
                </div>
              </td>
              <td className="py-1.5 px-2">
                <span className="font-mono font-semibold text-white text-sm">{stat.symbol}</span>
              </td>
              <td className="py-1.5 px-2 text-right font-mono text-xs text-gray-200">
                {stat.currentPrice < 0.0001
                  ? stat.currentPrice.toFixed(8)
                  : stat.currentPrice < 1
                  ? stat.currentPrice.toFixed(6)
                  : formatNumber(stat.currentPrice)}
              </td>
              <td className="py-1.5 px-2 text-right font-mono text-xs font-semibold">
                <span className={stat.priceChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {stat.priceChange >= 0 ? '+' : ''}
                  {stat.priceChange.toFixed(1)}%
                </span>
              </td>
              <td className="py-1.5 px-2 text-center">
                {/* Zero is truthful and needs saying differently: the row is
                    here for a Dojo plan, not because something fired. A "0"
                    reads as a count nobody asked for. */}
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                    stat.totalAlerts > 0
                      ? 'bg-accent/20 text-accent'
                      : 'bg-gray-700/40 text-gray-500'
                  }`}
                  title={
                    stat.totalAlerts > 0
                      ? undefined
                      : 'No alerts in the last 48 hours. This coin is listed because it has a Dojo plan in play.'
                  }
                >
                  {stat.totalAlerts > 0 ? stat.totalAlerts : '–'}
                </span>
              </td>
              <td className="py-1.5 px-2">
                <AlertBadges 
                  alertTypes={stat.alertTypes} 
                  maxVisible={4}
                  latestAlertType={stat.alerts[0]?.alertType}
                  pinned={dojoChips(livePlans.get(stat.symbol), stat.alerts, onOpenDojoSetup, activeSetupId)}
                />
              </td>
              <td className="py-1.5 px-2 text-right text-[10px] text-gray-400">
                {formatTimeAgo(stat.lastAlertTimestamp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <>
      {cardContent}
      {tableContent}
    </>
  )
}
