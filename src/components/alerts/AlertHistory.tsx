import { useState, useEffect, useMemo, useRef } from 'react'
import { AlertHistoryItem, CombinedAlertType, AlertSeverity } from '@/types/alert'
import { alertHistory } from '@/services/alertHistory'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatNumber } from '@/utils/format'

type TimeFilter = '1h' | '24h' | '7d' | '30d' | 'all'
type SortField = 'timestamp' | 'symbol' | 'type' | 'severity'
type SortDirection = 'asc' | 'desc'
type SourceTab = 'all' | 'main' | 'watchlist'

/**
 * AlertHistory - Browse and manage alert history
 * 
 * Features:
 * - Display all past alerts with details
 * - Separate tabs for main and watchlist alerts
 * - Filter by time range, symbol, type, severity
 * - Sort by timestamp, symbol, type, severity
 * - Search by symbol or message
 * - Export to CSV/JSON
 * - Acknowledge/clear functionality
 * - Statistics dashboard
 */
export function AlertHistory() {
  const [history, setHistory] = useState<AlertHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24h')
  const [sourceTab, setSourceTab] = useState<SourceTab>('all')
  const [typeFilter, setTypeFilter] = useState<CombinedAlertType | 'all'>('all')
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all')
  const [sortField, setSortField] = useState<SortField>('timestamp')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const didLoadRef = useRef(false)

  // Load history on mount (guarded for React Strict Mode)
  useEffect(() => {
    if (didLoadRef.current) return
    didLoadRef.current = true
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setIsLoading(true)
    try {
      const data = await alertHistory.getHistory()
      setHistory(data)
    } catch (error) {
      console.error('Failed to load alert history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const stats = useMemo(() => {
    if (history.length === 0) return null

    const now = Date.now()
    const last24hCutoff = now - 24 * 60 * 60 * 1000
    const lastWeekCutoff = now - 7 * 24 * 60 * 60 * 1000

    const totalsBySymbol: Record<string, number> = {}
    let last24h = 0
    let lastWeek = 0

    history.forEach((alert) => {
      totalsBySymbol[alert.symbol] = (totalsBySymbol[alert.symbol] || 0) + 1
      if (alert.timestamp >= last24hCutoff) last24h += 1
      if (alert.timestamp >= lastWeekCutoff) lastWeek += 1
    })

    const mostActiveSymbol = Object.entries(totalsBySymbol).reduce(
      (best, [symbol, count]) => (count > best.count ? { symbol, count } : best),
      { symbol: '', count: 0 }
    ).symbol

    return {
      total: history.length,
      last24h,
      lastWeek,
      mostActiveSymbol: mostActiveSymbol || null,
    }
  }, [history])

  // Filter and sort history
  const filteredHistory = useMemo(() => {
    let filtered = [...history]

    // Source tab filter
    if (sourceTab !== 'all') {
      filtered = filtered.filter((item) => {
        if (sourceTab === 'main') {
          return !item.source || item.source === 'main'
        }
        return item.source === 'watchlist'
      })
    }

    // Time filter
    if (timeFilter !== 'all') {
      const now = Date.now()
      const timeRanges: Record<TimeFilter, number> = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        'all': 0,
      }
      const cutoff = now - timeRanges[timeFilter]
      filtered = filtered.filter((item) => item.timestamp >= cutoff)
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((item) => item.type === typeFilter)
    }

    // Severity filter
    if (severityFilter !== 'all') {
      filtered = filtered.filter((item) => item.severity === severityFilter)
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (item) =>
          item.symbol.toLowerCase().includes(query) ||
          item.message.toLowerCase().includes(query) ||
          item.title.toLowerCase().includes(query)
      )
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = a[sortField]
      let bVal: any = b[sortField]

      if (sortField === 'timestamp') {
        aVal = a.timestamp
        bVal = b.timestamp
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [history, timeFilter, sourceTab, typeFilter, severityFilter, searchQuery, sortField, sortDirection])

  const handleExportCSV = async () => {
    try {
      const csv = await alertHistory.exportHistoryAsCSV()
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `alert-history-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export CSV:', error)
    }
  }

  const handleExportJSON = async () => {
    try {
      const json = await alertHistory.exportHistory()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `alert-history-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export JSON:', error)
    }
  }

  const handleClearHistory = async () => {
    if (confirm('Are you sure you want to clear all alert history?')) {
      await alertHistory.clearHistory()
      await loadHistory()
    }
  }

  const handleClearOld = async (days: number) => {
    if (confirm(`Clear alerts older than ${days} days?`)) {
      await alertHistory.clearOldHistory(days)
      await loadHistory()
    }
  }

  const getSeverityColor = (severity: AlertSeverity): string => {
    const colors = {
      low: 'bg-blue-500/20 text-blue-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      high: 'bg-orange-500/20 text-orange-400',
      critical: 'bg-red-500/20 text-red-400',
    }
    return colors[severity]
  }

  // Match colors from AlertTimelineChart and TradingChart
  const ALERT_TYPE_COLORS: Record<string, string> = {
    // Bullish
    futures_big_bull_60: '#14532d',
    futures_pioneer_bull: '#a7f3d0',
    futures_5_big_bull: '#84cc16',
    futures_15_big_bull: '#16a34a',
    futures_bottom_hunter: '#a855f7', // purple hunters
    
    // Bearish
    futures_big_bear_60: '#7f1d1d',
    futures_pioneer_bear: '#fce7f3',
    futures_5_big_bear: '#f87171',
    futures_15_big_bear: '#dc2626',
    futures_top_hunter: '#a855f7', // purple hunters
  }

  const getAlertBadge = (type: CombinedAlertType): { text: string; color: string; bgColor: string } => {
    const cleanType = type.replace(/^futures_/, '')
    const isBullish = cleanType.includes('bull') || cleanType === 'bottom_hunter'
    
    // Get color from mapping, fallback to bull/bear default
    const color = ALERT_TYPE_COLORS[type] || (isBullish ? '#22c55e' : '#ef4444')
    
    // Determine badge text
    let text = ''
    if (cleanType === 'pioneer_bull' || cleanType === 'pioneer_bear') {
      text = 'P'
    } else if (cleanType === '5_big_bull' || cleanType === '5_big_bear') {
      text = '5'
    } else if (cleanType === '15_big_bull' || cleanType === '15_big_bear') {
      text = '15'
    } else if (cleanType === 'big_bull_60' || cleanType === 'big_bear_60') {
      text = '60'
    } else if (cleanType === 'bottom_hunter') {
      text = 'BH'
    } else if (cleanType === 'top_hunter') {
      text = 'TH'
    } else {
      // Fallback for legacy/other types
      text = '?'
    }
    
    return { text, color, bgColor: color }
  }

  const getAlertDisplayName = (type: CombinedAlertType): string => {
    const cleanType = type.replace(/^futures_/, '')
    const names: Record<string, string> = {
      big_bull_60: '60 Big Bull',
      big_bear_60: '60 Big Bear',
      pioneer_bull: 'Pioneer Bull',
      pioneer_bear: 'Pioneer Bear',
      '5_big_bull': '5 Big Bull',
      '5_big_bear': '5 Big Bear',
      '15_big_bull': '15 Big Bull',
      '15_big_bear': '15 Big Bear',
      bottom_hunter: 'Bottom Hunter',
      top_hunter: 'Top Hunter',
    }
    return names[cleanType] || cleanType.split('_').map(w => 
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ')
  }

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">Loading alert history...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Alert History</h3>
          {stats && (
            <div className="mt-2 flex gap-4 text-sm text-gray-400">
              <span>Total: {stats.total}</span>
              <span>Last 24h: {stats.last24h}</span>
              <span>This week: {stats.lastWeek}</span>
              {stats.mostActiveSymbol && (
                <span>Most active: {stats.mostActiveSymbol}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportCSV} variant="secondary" size="sm">
            Export CSV
          </Button>
          <Button onClick={handleExportJSON} variant="secondary" size="sm">
            Export JSON
          </Button>
          <Button
            onClick={handleClearHistory}
            variant="secondary"
            size="sm"
            className="text-red-400 hover:text-red-300"
          >
            Clear All
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Source Tabs */}
        <div className="flex gap-2 border-b border-gray-700">
          <button
            onClick={() => setSourceTab('all')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              sourceTab === 'all'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            All Alerts
          </button>
          <button
            onClick={() => setSourceTab('main')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              sourceTab === 'main'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Main Alerts
          </button>
          <button
            onClick={() => setSourceTab('watchlist')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              sourceTab === 'watchlist'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Watchlist Alerts
          </button>
        </div>

        {/* Filter Grid */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Search */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">Search</label>
          <Input
            type="text"
            placeholder="Symbol or message..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Time Range */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">Time Range</label>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>

        {/* Type Filter */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">Alert Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as CombinedAlertType | 'all')}
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Types</option>
            <optgroup label="Futures Alerts">
              <option value="futures_big_bull_60">60 Big Bull</option>
              <option value="futures_big_bear_60">60 Big Bear</option>
              <option value="futures_pioneer_bull">Pioneer Bull (Futures)</option>
              <option value="futures_pioneer_bear">Pioneer Bear (Futures)</option>
              <option value="futures_5_big_bull">5 Big Bull (Futures)</option>
              <option value="futures_5_big_bear">5 Big Bear (Futures)</option>
              <option value="futures_15_big_bull">15 Big Bull (Futures)</option>
              <option value="futures_15_big_bear">15 Big Bear (Futures)</option>
              <option value="futures_bottom_hunter">Bottom Hunter (Futures)</option>
              <option value="futures_top_hunter">Top Hunter (Futures)</option>
            </optgroup>
            <optgroup label="Legacy Alerts">
              <option value="pioneer_bull">Pioneer Bull (Legacy)</option>
              <option value="pioneer_bear">Pioneer Bear (Legacy)</option>
              <option value="5m_big_bull">5m Big Bull (Legacy)</option>
              <option value="5m_big_bear">5m Big Bear (Legacy)</option>
              <option value="15m_big_bull">15m Big Bull (Legacy)</option>
              <option value="15m_big_bear">15m Big Bear (Legacy)</option>
              <option value="bottom_hunter">Bottom Hunter (Legacy)</option>
              <option value="top_hunter">Top Hunter (Legacy)</option>
              <option value="price_pump">Price Pump</option>
              <option value="price_dump">Price Dump</option>
              <option value="volume_spike">Volume Spike</option>
              <option value="volume_drop">Volume Drop</option>
            </optgroup>
          </select>
        </div>

        {/* Severity Filter */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">Severity</label>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | 'all')}
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-400">Sort by:</span>
        <button
          onClick={() => {
            setSortField('timestamp')
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
          }}
          className={`rounded px-2 py-1 ${
            sortField === 'timestamp'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-gray-400 hover:bg-gray-700'
          }`}
        >
          Time {sortField === 'timestamp' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => {
            setSortField('symbol')
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
          }}
          className={`rounded px-2 py-1 ${
            sortField === 'symbol'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-gray-400 hover:bg-gray-700'
          }`}
        >
          Symbol {sortField === 'symbol' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => {
            setSortField('severity')
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
          }}
          className={`rounded px-2 py-1 ${
            sortField === 'severity'
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-gray-400 hover:bg-gray-700'
          }`}
        >
          Severity {sortField === 'severity' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <div className="ml-auto text-gray-400">
          Showing {filteredHistory.length} of {history.length} alerts
        </div>
      </div>

      {/* Alert List */}
      {filteredHistory.length === 0 ? (
        <EmptyState
          title="No alerts found"
          description="Try adjusting your filters or time range"
        />
      ) : (
        <div className="space-y-2">
          {filteredHistory.map((alert) => {
            const badge = getAlertBadge(alert.type)
            const isBullish = alert.type.includes('bull') || alert.type === 'futures_bottom_hunter'
            
            return (
            <div
              key={alert.id}
              className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 transition-colors hover:border-gray-600 hover:bg-gray-800"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {/* Circular badge with symbol */}
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold"
                      style={{ 
                        backgroundColor: badge.bgColor,
                        color: badge.color.includes('f3d0') || badge.color.includes('fce7f3') ? '#000' : '#fff'
                      }}
                      title={getAlertDisplayName(alert.type)}
                    >
                      <span className="flex items-center gap-0.5">
                        {badge.text}
                        {isBullish ? '▲' : '▼'}
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-blue-400">
                      {alert.symbol}
                    </span>
                    <Badge className={getSeverityColor(alert.severity)}>
                      {alert.severity}
                    </Badge>
                    {alert.timeframe && (
                      <Badge className="bg-gray-700 text-gray-300">
                        {alert.timeframe}
                      </Badge>
                    )}
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(alert.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-white">{alert.title}</p>
                  <p className="mt-1 text-sm text-gray-400">{alert.message}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      Value: <span className="text-gray-300">{formatNumber(alert.value)}</span>
                    </span>
                    <span>
                      Threshold: <span className="text-gray-300">{formatNumber(alert.threshold)}</span>
                    </span>
                    {alert.acknowledgedAt && (
                      <span className="text-green-400">
                        ✓ Acknowledged {formatTimestamp(alert.acknowledgedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <h4 className="mb-3 text-sm font-medium text-white">Quick Actions</h4>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => handleClearOld(7)}
            variant="secondary"
            size="sm"
          >
            Clear 7+ days old
          </Button>
          <Button
            onClick={() => handleClearOld(30)}
            variant="secondary"
            size="sm"
          >
            Clear 30+ days old
          </Button>
          <Button
            onClick={() => {
              loadHistory()
            }}
            variant="secondary"
            size="sm"
          >
            Refresh
          </Button>
        </div>
      </div>
    </div>
  )
}
