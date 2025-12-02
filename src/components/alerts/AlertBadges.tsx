import type { AlertType } from '@/types/alert'

interface AlertBadgesProps {
  alertTypes: Set<AlertType>
  maxVisible?: number
}

/**
 * Display alert type badges with colors matching alert severity
 * Shows first N badges, then "+X more" if there are additional types
 */
export function AlertBadges({ alertTypes, maxVisible = 3 }: AlertBadgesProps) {
  const types = Array.from(alertTypes)
  const visibleTypes = types.slice(0, maxVisible)
  const remainingCount = Math.max(0, types.length - maxVisible)

  const getAlertBadgeColor = (type: AlertType): string => {
    // Bullish alerts - green
    if (['price_pump', 'pioneer_bull', '5m_big_bull', '15m_big_bull', 'bottom_hunter'].includes(type)) {
      return 'bg-green-500/20 text-green-400 border-green-500/50'
    }
    
    // Bearish alerts - red/orange
    if (['price_dump', 'pioneer_bear', '5m_big_bear', '15m_big_bear', 'top_hunter'].includes(type)) {
      return 'bg-red-500/20 text-red-400 border-red-500/50'
    }
    
    // Neutral alerts - blue/purple
    return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
  }

  const getAlertLabel = (type: AlertType): string => {
    const labels: Record<AlertType, string> = {
      price_pump: 'Pump',
      price_dump: 'Dump',
      volume_spike: 'Vol↑',
      volume_drop: 'Vol↓',
      vcp_signal: 'VCP',
      fibonacci_break: 'Fib',
      trend_reversal: 'Trend',
      pioneer_bull: 'Pioneer🐂',
      pioneer_bear: 'Pioneer🐻',
      '5m_big_bull': '5m🐂',
      '5m_big_bear': '5m🐻',
      '15m_big_bull': '15m🐂',
      '15m_big_bear': '15m🐻',
      bottom_hunter: 'Bottom',
      top_hunter: 'Top',
      custom: 'Custom',
    }
    return labels[type] || type
  }

  if (types.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1">
      {visibleTypes.map((type) => (
        <span
          key={type}
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getAlertBadgeColor(type)}`}
        >
          {getAlertLabel(type)}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-gray-700/50 text-gray-400 border-gray-600">
          +{remainingCount} more
        </span>
      )}
    </div>
  )
}
