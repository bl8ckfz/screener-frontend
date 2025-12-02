import type { CoinAlertStats } from '@/types/alertHistory'
import { AlertBadges } from './AlertBadges'
import { EmptyAlertHistory } from './EmptyAlertHistory'
import { formatNumber } from '@/utils/format'
import { Button } from '@/components/ui'

interface AlertHistoryTableProps {
  stats: CoinAlertStats[]
  onCoinClick: (symbol: string) => void
  onClearHistory: () => void
}

/**
 * Alert History Table - displays coins sorted by alert count
 */
export function AlertHistoryTable({ stats, onCoinClick, onClearHistory }: AlertHistoryTableProps) {
  if (stats.length === 0) {
    return <EmptyAlertHistory />
  }

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                Symbol
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">
                Price
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">
                24h Change
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">
                Total Alerts
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                Alert Types
              </th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">
                Last Alert
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => (
              <tr
                key={stat.symbol}
                onClick={() => onCoinClick(stat.symbol)}
                className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors"
              >
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
                  <AlertBadges alertTypes={stat.alertTypes} maxVisible={3} />
                </td>

                {/* Last Alert Time */}
                <td className="py-3 px-4 text-right text-xs text-gray-400">
                  {formatTimeAgo(stat.lastAlertTimestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="text-sm text-gray-500 text-center py-2">
        Total: {stats.reduce((sum, stat) => sum + stat.totalAlerts, 0)} alerts across {stats.length} coins
      </div>
    </div>
  )
}
