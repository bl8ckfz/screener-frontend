import type { CombinedAlertType } from '@/types/alert'
import { FUTURES_ALERT_LABELS } from '@/types/alert'
import { useStore } from '@/hooks/useStore'
import { resolveAlertColor, isBullishAlertType } from '@/types/alertColors'

interface AlertBadgesProps {
  alertTypes: Set<CombinedAlertType>
  maxVisible?: number
  latestAlertType?: CombinedAlertType // Highlight this alert as the most recent
  /**
   * Badges shown on their OWN LINE beneath the alert types, squared rather
   * than round, and not counted against maxVisible.
   *
   * All three follow from these being persistent state rather than events. A
   * Dojo plan is in play for weeks and stays worth seeing the whole time,
   * whereas the round badges above are a record that something fired and then
   * turned over. Sharing a line and a shape invited the two to be read as the
   * same kind of thing, and sharing the cap let a busy coin's momentum alerts
   * push the plan out of view entirely.
   */
  pinned?: PinnedBadge[]
}

/** A chip on the Dojo line: below the alert types, outside their cap. */
export interface PinnedBadge {
  key: string
  /** Emoji, matching the marks used in the chat renderers. */
  mark: string
  /** What happened, in words: "Waiting", "In trade", "Stop taken". */
  label: string
  /** Which plan, when a coin carries more than one: "1W Short". */
  detail?: string
  /** Tailwind text and border classes carrying the state's colour. */
  tone: string
  title: string
  /**
   * Draws attention without competing with latestAlertType's ring: used for a
   * plan that is actually in a trade rather than still waiting for price.
   */
  emphasised?: boolean
  /** This is the plan currently open on the chart. */
  active?: boolean
  onClick?: () => void
}

/**
 * Display alert type badges with colors matching alert severity
 * Shows first N badges, then "+X more" if there are additional types
 */
export function AlertBadges({ alertTypes, maxVisible = 3, latestAlertType, pinned }: AlertBadgesProps) {
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
    const isBullish = isBullishAlertType(cleanType)
    
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
      text = 'BR'
    } else if (cleanType === 'top_hunter') {
      text = 'TR'
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
    } else if (cleanType === 'surge_42') {
      text = '42'
    } else if (cleanType === 'knife_catcher') {
      text = '🔪'
    } else if (cleanType === 'capitulation_catcher') {
      text = '🩸'
    } else if (cleanType.startsWith('dojo_filled_')) {
      // The resting limit was reached. Strongest of the three Dojo events, and
      // the badge matches the ✅ used in Discord.
      text = '✅'
    } else if (cleanType.startsWith('dojo_near_')) {
      // Price has arrived at an armed zone. There is no timeframe to show —
      // an arrival is the same event whichever timeframe armed the zone — so
      // the badge marks the event itself, matching the 🎯 used in Discord.
      text = '🎯'
    } else if (cleanType.startsWith('dojo_otz_')) {
      // Show the timeframe: the direction is already carried by the colour,
      // and which timeframe a zone sits on is what distinguishes them.
      text = cleanType.endsWith('_1w') ? '1W' : cleanType.endsWith('_5d') ? '5D' : '1D'
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

  if (types.length === 0 && !pinned?.length) {
    return null
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Alert types: a stream of things that fired, capped and turning over. */}
      {types.length > 0 && (
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
      )}

      {/* The Dojo line: its own row, and read as words rather than as a code.
          
          Not a style preference. The round badges above are a record that
          something fired: a stream, capped, turning over. These are a plan,
          which is in play for weeks. Sharing a line invited the two to be read
          as the same kind of thing, and sharing the cap let a busy coin's
          momentum alerts crowd the plan out of view entirely. */}
      {pinned && pinned.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {pinned.map((p) => (
            <div
              key={p.key}
              role={p.onClick ? 'button' : undefined}
              tabIndex={p.onClick ? 0 : undefined}
              onClick={p.onClick ? (e) => { e.stopPropagation(); p.onClick?.() } : undefined}
              onKeyDown={
                p.onClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        p.onClick?.()
                      }
                    }
                  : undefined
              }
              className={`rounded border bg-gray-800/60 px-1.5 py-0.5 text-[10px] font-medium leading-none transition ${p.tone} ${
                p.emphasised ? 'ring-1 ring-emerald-300/50' : ''
              } ${p.active ? 'bg-gray-700/80 ring-1 ring-accent' : ''} ${
                p.onClick ? 'cursor-pointer hover:bg-gray-700/60' : ''
              }`}
              title={p.title}
            >
              {p.mark && <span aria-hidden>{p.mark} </span>}
              {p.label}
              {p.detail && <span className="text-gray-500"> · {p.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
