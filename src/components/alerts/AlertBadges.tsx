import type { CombinedAlertType } from '@/types/alert'
import { FUTURES_ALERT_LABELS } from '@/types/alert'
import { useStore } from '@/hooks/useStore'
import { resolveAlertColor } from '@/types/alertColors'

interface AlertBadgesProps {
  alertTypes: Set<CombinedAlertType>
  maxVisible?: number
  latestAlertType?: CombinedAlertType // Highlight this alert as the most recent
}

/**
 * Display alert type badges with colors matching alert severity
 * Shows first N badges, then "+X more" if there are additional types
 */
export function AlertBadges({ alertTypes, maxVisible = 3, latestAlertType }: AlertBadgesProps) {
  const alertColors = useStore((state) => state.alertColors)
  const types = Array.from(alertTypes)
  const visibleTypes = types.slice(0, maxVisible)
  const remainingCount = Math.max(0, types.length - maxVisible)

  const getAlertBadge = (type: CombinedAlertType, isLatest: boolean): { 
    text: string
    bgColor: string
    textColor: string
    isBullish: boolean
    shouldHighlight: boolean
  } => {
    const cleanType = type.replace(/^futures_/, '').replace(/^5m_/, '5_').replace(/^15m_/, '15_')
    const isBullish = cleanType.includes('bull') || cleanType.includes('bottom_hunter') || cleanType === 'whale_accumulation'
    
    // Normalize type for color lookup (ensure futures_ prefix)
    const normalizedType = type.startsWith('futures_') ? type : `futures_${cleanType}`
    
    // Get base color from store (user-configurable), fallback to bull/bear default
    const baseColor = resolveAlertColor(alertColors, normalizedType, isBullish ? '#22c55e' : '#ef4444')
    
    // Determine badge text
    let text = ''
    if (cleanType === 'pioneer_bull' || cleanType === 'pioneer_bear') {
      text = 'SC'
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
    } else if (cleanType === 'bottom_hunter_v2') {
      text = 'B2'
    } else if (cleanType === 'top_hunter_v2') {
      text = 'T2'
    } else if (cleanType === 'big_bull_60_v2' || cleanType === 'big_bear_60_v2') {
      text = '62'
    } else if (cleanType === 'whale_detector') {
      text = '🐋'
    } else if (cleanType === 'whale_accumulation') {
      text = '🐋'
    } else if (cleanType === 'whale_distribution') {
      text = '🐋'
    } else {
      // Fallback for legacy/other types
      text = '?'
    }
    
    // Light backgrounds need dark text
    const isLightBg = baseColor === '#a7f3d0' || baseColor === '#fce7f3'
    const textColor = isLightBg ? '#000' : '#fff'
    
    return { 
      text, 
      bgColor: baseColor, 
      textColor,
      isBullish,
      shouldHighlight: isLatest
    }
  }

  const getAlertLabel = (type: CombinedAlertType): string => {
    // Futures alerts only - remove prefix for display
    if (type.startsWith('futures_')) {
      const futuresLabels = FUTURES_ALERT_LABELS as Record<string, string>
      return futuresLabels[type] || type
    }
    // Fallback for any non-futures types
    return type
  }

  if (types.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleTypes.map((type) => {
        const badge = getAlertBadge(type, latestAlertType === type)
        return (
          <div
            key={type}
            className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-all ${
              badge.shouldHighlight ? 'ring-2 ring-white/50 scale-110' : ''
            }`}
            style={{ 
              backgroundColor: badge.bgColor,
              color: badge.textColor
            }}
            title={getAlertLabel(type)}
          >
            <span className="flex items-center gap-0.5">
              {badge.text}
              <span className="text-[8px]">{badge.isBullish ? '▲' : '▼'}</span>
            </span>
          </div>
        )
      })}
      {remainingCount > 0 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-700/50 text-gray-400">
          +{remainingCount}
        </span>
      )}
    </div>
  )
}
