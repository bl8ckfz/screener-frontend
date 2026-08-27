import { Timeframe } from './coin'

/**
 * Futures alert types (the ONLY alert types we use)
 * Based on Binance Futures API data with kline intervals
 */
export type FuturesAlertType =
  | 'futures_big_bull_60' // Surge 60 Bull (strong upward momentum)
  | 'futures_big_bear_60' // Surge 60 Bear (strong downward momentum)
  | 'futures_pioneer_bull' // Scout Bull (early bullish trend detection)
  | 'futures_pioneer_bear' // Scout Bear (early bearish trend detection)
  | 'futures_5_big_bull' // Surge 5 Bull (short-term bullish spike)
  | 'futures_5_big_bear' // Surge 5 Bear (short-term bearish spike)
  | 'futures_15_big_bull' // Surge 15 Bull (medium-term bullish spike)
  | 'futures_15_big_bear' // Surge 15 Bear (medium-term bearish spike)
  | 'futures_bottom_hunter' // Bottom Raid (potential bottom reversal)
  | 'futures_top_hunter' // Top Raid (potential top reversal)
  // V2 optimized rules
  | 'futures_bottom_hunter_v2' // Bottom Raid V2 (deeper + RSI oversold)
  | 'futures_top_hunter_v2' // Top Raid V2 (deeper + RSI overbought)
  | 'futures_big_bull_60_v2' // Surge 60 Bull V2 (daily floor + BTC-relative)
  | 'futures_big_bear_60_v2' // Surge 60 Bear V2 (daily floor + BTC-relative)
  // Whale detection
  | 'futures_whale_detector' // Whale Detector (volume anomaly, no price move)
  | 'futures_whale_accumulation' // Whale Accu (volume anomaly, bullish context)
  | 'futures_whale_distribution' // Whale Dist (volume anomaly, bearish context)
  // V4 long-bias contrarian (research v4)
  | 'futures_surge_42' // Surge 42 (capitulation drop after recent failed bounce, long-bias 1d)
  // Catcher family (research holdout-validated capitulation longs)
  | 'futures_knife_catcher' // Knife Catcher (deep capitulation flush after failed bounce, long-bias 1d)
  | 'futures_capitulation_catcher' // Capitulation Catcher complement (deep-drawdown capitulation, no bounce, long-bias 1d)
  // Dojo confluence zones (SMC: FVG-validated Optimal Trade Zone on high timeframes).
  // These alert on a ZONE BECOMING ARMED, not on price entering it — the entry
  // is a resting limit at fib 0.705, so the actionable moment is when the zone
  // forms. Price tapping the zone is left to a TradingView alert on the
  // published Pine indicator.
  | 'futures_dojo_otz_long_1d' // Dojo OTZ Long 1D
  | 'futures_dojo_otz_short_1d' // Dojo OTZ Short 1D
  | 'futures_dojo_otz_long_5d' // Dojo OTZ Long 5D
  | 'futures_dojo_otz_short_5d' // Dojo OTZ Short 5D
  | 'futures_dojo_otz_long_1w' // Dojo OTZ Long 1W
  | 'futures_dojo_otz_short_1w' // Dojo OTZ Short 1W
  // The complement of the six above: price has ARRIVED at a zone one of them
  // armed. No timeframe in the type — an arrival is the same event whichever
  // timeframe armed the zone, so it travels in the alert metadata instead.
  | 'futures_dojo_near_long' // Dojo Zone Entered (Long)
  | 'futures_dojo_near_short' // Dojo Zone Entered (Short)
  // Price reached the resting limit at fib 0.705. The entry sits inside the
  // zone, so this supersedes the near_* alert rather than adding to it.
  | 'futures_dojo_filled_long' // Dojo Entry Filled (Long)
  | 'futures_dojo_filled_short' // Dojo Entry Filled (Short)

/**
 * Legacy alert types (DEPRECATED - kept for backwards compatibility only)
 * DO NOT USE - these are not implemented and will be removed
 */
export type AlertType =
  | 'price_pump'
  | 'price_dump'
  | 'volume_spike'
  | 'volume_drop'
  | 'vcp_signal'
  | 'fibonacci_break'
  | 'trend_reversal'
  | 'pioneer_bull'
  | 'pioneer_bear'
  | '5m_big_bull'
  | '5m_big_bear'
  | '15m_big_bull'
  | '15m_big_bear'
  | 'bottom_hunter'
  | 'top_hunter'
  | 'custom'

/**
 * Combined alert type (use FuturesAlertType for new code)
 */
export type CombinedAlertType = AlertType | FuturesAlertType

/**
 * Alert severity levels
 */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Alert trigger condition
 */
export interface AlertCondition {
  type: CombinedAlertType
  threshold: number // e.g., 5 for 5% price change
  timeframe?: Timeframe // Optional timeframe for the condition
  comparison: 'greater_than' | 'less_than' | 'equals'
}

/**
 * Futures alert trigger condition
 * Used specifically for futures alerts with different data structure
 */
export interface FuturesAlertCondition {
  type: FuturesAlertType
  enabled: boolean
  // Futures-specific thresholds (optional overrides)
  priceChangeThreshold?: number // e.g., 2 for 2% change on 15m
  volumeThreshold?: number // e.g., 400000 for 400k USDT
  marketCapMin?: number // e.g., 23000000 for 23M
  marketCapMax?: number // e.g., 2500000000 for 2.5B
}

/**
 * Alert notification
 */
export interface Alert {
  id: string
  symbol: string
  type: CombinedAlertType
  severity: AlertSeverity
  title: string
  message: string
  value: number // The value that triggered the alert
  threshold: number // The threshold that was crossed
  timeframe?: Timeframe
  timestamp: number
  read: boolean
  dismissed: boolean
  source?: 'main' | 'watchlist' // Track alert source for separate history/webhooks
  watchlistId?: string // ID of the watchlist that triggered this alert (if source is watchlist)
  // Futures-specific data (optional)
  futuresData?: {
    change_5m?: number
    change_15m?: number
    change_1h?: number
    change_8h?: number
    change_1d?: number
    volume_15m?: number
    volume_1h?: number
    marketCap?: number | null
    coinGeckoId?: string | null
  }
}

/**
 * Alert rule (user-configured)
 */
export interface AlertRule {
  id: string
  name: string
  enabled: boolean
  symbols: string[] // Empty array means all symbols
  conditions: AlertCondition[]
  severity: AlertSeverity
  notificationEnabled: boolean
  soundEnabled: boolean
  webhookEnabled?: boolean // Per-rule webhook override (if undefined, uses global setting)
  createdAt: number
  lastTriggered?: number
}

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  id: string
  name: string
  type: 'discord' | 'telegram'
  url: string
  enabled: boolean
  createdAt: number
}

/**
 * Webhook delivery status
 */
export interface WebhookDelivery {
  id: string
  webhookId: string
  alertId: string
  status: 'pending' | 'success' | 'failed' | 'retrying'
  attempts: number
  lastAttempt: number
  error?: string
}

/**
 * Alert settings
 */
export interface AlertSettings {
  enabled: boolean
  soundEnabled: boolean
  notificationEnabled: boolean // In-app toast notifications
  browserNotificationEnabled: boolean // Browser desktop notifications
  webhookEnabled: boolean // Global webhook toggle
  discordWebhookUrl: string // Legacy: Primary Discord webhook (backwards compatibility)
  telegramBotToken: string // Telegram bot token
  telegramChatId: string // Telegram chat/channel ID
  webhooks: WebhookConfig[] // Multiple webhook configurations for main alerts
  watchlistWebhooks: WebhookConfig[] // Separate webhook configurations for watchlist alerts
  maxAlertsPerSymbol: number // Prevent spam
  alertCooldown: number // Seconds between alerts for same symbol
  autoDismissAfter: number // Auto-dismiss alerts after N seconds (0 = never)
}

/**
 * Alert history item
 */
export interface AlertHistoryItem extends Alert {
  acknowledgedAt?: number
  acknowledgedBy?: string
}

/**
 * Futures alert configuration
 * Enables/disables individual futures alert types and sets global thresholds
 */
export interface FuturesAlertConfig {
  enabled: boolean // Master switch for all futures alerts
  alerts: {
    [K in FuturesAlertType]: {
      enabled: boolean
      severity: AlertSeverity
    }
  }
  // Global thresholds (can be overridden per alert)
  globalThresholds: {
    priceChange_15m: number // Default: 1% (e.g., 1.0 means > 1%)
    priceChange_1d: number // Default: 15% (e.g., 15.0 means < 15%)
    volume_15m: number // Default: 400000 (400k USDT)
    volume_1h: number // Default: 1000000 (1M USDT)
    marketCapMin: number // Default: 23000000 (23M USD)
    marketCapMax: number // Default: 2500000000 (2.5B USD)
  }
  // Notification settings specific to futures alerts
  notificationEnabled: boolean
  soundEnabled: boolean
  webhookEnabled: boolean
}

/**
 * Alert statistics
 */
export interface AlertStats {
  total: number
  unread: number
  byType: Record<CombinedAlertType, number>
  bySeverity: Record<AlertSeverity, number>
  last24h: number
  mostActiveSymbol: string
}

/**
 * Legacy alert rule presets from fast.html
 * These replicate the original alert logic for backward compatibility
 */
export interface LegacyAlertPreset {
  type: AlertType
  name: string
  description: string
  conditions: {
    priceRatios?: Record<string, { min?: number; max?: number }> // e.g., { '1m/3m': { min: 1.01 } }
    volumeDeltas?: Record<string, { min?: number }> // e.g., { '5m': { min: 100000 } }
    volumeRatios?: Record<string, { min?: number }> // e.g., { 'current/1m': { min: 1.04 } }
    trendConditions?: string[] // Complex conditions like "price ascending across timeframes"
  }
  severity: AlertSeverity
  marketMode?: 'bull' | 'bear' | 'both' // Some alerts only trigger in bull/bear markets
}

/**
 * Predefined legacy alert presets
 */
export const LEGACY_ALERT_PRESETS: LegacyAlertPreset[] = [
  {
    type: 'pioneer_bull',
    name: 'Scout Bull',
    description: 'Strong bullish momentum: price > +1% vs 5m & 15m, accelerating vs prev close, volume ratio confirms',
    conditions: {
      priceRatios: {
        'current/3m': { min: 1.01 },
        'current/15m': { min: 1.01 },
      },
      volumeRatios: {
        '2*current/5m_vs_current/15m': { min: 1 }, // semantic placeholder for 2*vol/vol5m > vol/vol15m
      },
      trendConditions: ['3*(price/5m) > price/prevClose', 'accelerating_momentum'],
    },
    severity: 'critical',
    marketMode: 'bull',
  },
  {
    type: 'pioneer_bear',
    name: 'Scout Bear',
    description: 'Strong bearish momentum: price < -1% vs 5m & 15m, accelerating decline vs prev close, volume ratio confirms',
    conditions: {
      priceRatios: {
        '5m/current': { min: 1.01 }, // inverted ratio form
        '15m/current': { min: 1.01 },
      },
      volumeRatios: {
        '2*current/5m_vs_current/15m': { min: 1 },
      },
      trendConditions: ['3*(5m/current) > prevClose/current', 'accelerating_momentum'],
    },
    severity: 'critical',
    marketMode: 'bear',
  },
  {
    type: '5m_big_bull',
    name: 'Surge 5 Bull',
    description: '5-minute significant volume and price increase',
    conditions: {
      priceRatios: {
        'current/3m': { min: 1.006 },
      },
      volumeDeltas: {
        '3m_delta': { min: 100000 },
        '5m_delta': { min: 50000 },
      },
      trendConditions: [
        'price: 3m < 1m < current',
        'volume: 3m < 1m < 5m < current',
      ],
    },
    severity: 'high',
    marketMode: 'bull',
  },
  {
    type: '5m_big_bear',
    name: 'Surge 5 Bear',
    description: '5-minute significant volume and price decrease',
    conditions: {
      priceRatios: {
        'current/3m': { max: 0.994 }, // < 2-1.006
      },
      volumeDeltas: {
        '3m_delta': { min: 100000 },
        '5m_delta': { min: 50000 },
      },
      trendConditions: [
        'price: 3m > 1m > current',
        'volume: 3m < 1m < 5m < current',
      ],
    },
    severity: 'high',
    marketMode: 'bear',
  },
  {
    type: '15m_big_bull',
    name: 'Surge 15 Bull',
    description: '15-minute significant volume and price increase',
    conditions: {
      priceRatios: {
        'current/15m': { min: 1.01 },
        'current/3m': { min: 1 },
        '3m/15m': { min: 1 },
      },
      volumeDeltas: {
        '15m_delta': { min: 400000 },
        '3m_delta': { min: 100000 },
      },
      trendConditions: [
        'price: 15m < 3m < current',
        'volume: 15m < 3m < 5m < current',
      ],
    },
    severity: 'high',
    marketMode: 'bull',
  },
  {
    type: '15m_big_bear',
    name: 'Surge 15 Bear',
    description: '15-minute significant volume and price decrease',
    conditions: {
      priceRatios: {
        'current/15m': { max: 0.99 },
        'current/3m': { max: 1 },
        '3m/15m': { max: 1 },
      },
      volumeDeltas: {
        '15m_delta': { min: 400000 },
        '3m_delta': { min: 100000 },
      },
      trendConditions: [
        'price: 15m > 3m > current',
        'volume: 15m < 3m < 5m < current',
      ],
    },
    severity: 'high',
    marketMode: 'bear',
  },
  {
    type: 'bottom_hunter',
    name: 'Bottom Raid',
    description: 'Potential bottom reversal - price declining but showing support',
    conditions: {
      priceRatios: {
        'current/15m': { max: 0.994 }, // < 2-1.006
        'current/3m': { max: 0.995 }, // < 2-1.005
        'current/1m': { min: 1.004 },
      },
      volumeRatios: {
        'current/5m': { min: 1 },
        '5m/3m': { min: 1 },
      },
      trendConditions: ['price_declining_then_reversing', 'volume_increasing'],
    },
    severity: 'medium',
    marketMode: 'both',
  },
  {
    type: 'top_hunter',
    name: 'Top Raid',
    description: 'Potential top reversal - price rising but losing momentum',
    conditions: {
      priceRatios: {
        'current/15m': { min: 1.006 },
        'current/3m': { min: 1.005 },
        'current/1m': { min: 0.996 }, // > 2-1.004
      },
      volumeRatios: {
        'current/5m': { min: 1 },
        '5m/3m': { min: 1 },
      },
      trendConditions: ['price_rising_then_slowing', 'volume_increasing'],
    },
    severity: 'medium',
    marketMode: 'both',
  },
]

/**
 * Futures alert preset interface
 * Used for creating alert rules from predefined futures alert types
 */
export interface FuturesAlertPreset {
  type: FuturesAlertType
  name: string
  description: string
  severity: AlertSeverity
  marketMode: 'bull' | 'bear' | 'both'
}

/**
 * Predefined futures alert presets
 * These use the new Futures API data with multi-timeframe analysis
 */
export const FUTURES_ALERT_PRESETS: FuturesAlertPreset[] = [
  {
    type: 'futures_big_bull_60',
    name: 'Surge 60 Bull',
    description: 'Sustained bullish momentum: 1h > 1.6%, progressive validation across 8h/1d, strong volume acceleration',
    severity: 'critical',
    marketMode: 'bull',
  },
  {
    type: 'futures_big_bear_60',
    name: 'Surge 60 Bear',
    description: 'Sustained bearish momentum: 1h < -1.6%, progressive downtrend across 8h/1d, strong volume',
    severity: 'critical',
    marketMode: 'bear',
  },
  {
    type: 'futures_pioneer_bull',
    name: 'Scout Bull',
    description: 'Early bullish detection: 5m/15m > 1%, accelerating momentum with volume confirmation',
    severity: 'critical',
    marketMode: 'bull',
  },
  {
    type: 'futures_pioneer_bear',
    name: 'Scout Bear',
    description: 'Early bearish detection: 5m/15m < -1%, accelerating downward momentum with volume',
    severity: 'critical',
    marketMode: 'bear',
  },
  {
    type: 'futures_5_big_bull',
    name: 'Surge 5 Bull',
    description: 'Explosive 5m move: progressive validation across 5m/15m/1h with strong volume acceleration',
    severity: 'high',
    marketMode: 'bull',
  },
  {
    type: 'futures_5_big_bear',
    name: 'Surge 5 Bear',
    description: 'Explosive 5m drop: progressive downward momentum with strong volume acceleration',
    severity: 'high',
    marketMode: 'bear',
  },
  {
    type: 'futures_15_big_bull',
    name: 'Surge 15 Bull',
    description: 'Strong 15m uptrend: progressive validation across 15m/1h/8h with volume confirmation',
    severity: 'high',
    marketMode: 'bull',
  },
  {
    type: 'futures_15_big_bear',
    name: 'Surge 15 Bear',
    description: 'Strong 15m downtrend: progressive downward momentum across timeframes',
    severity: 'high',
    marketMode: 'bear',
  },
  {
    type: 'futures_bottom_hunter',
    name: 'Bottom Raid',
    description: 'Bottom reversal: 1h/15m declining but 5m reversing upward with volume spike',
    severity: 'medium',
    marketMode: 'both',
  },
  {
    type: 'futures_top_hunter',
    name: 'Top Raid',
    description: 'Top reversal: 1h/15m rallying but 5m reversing downward with volume spike',
    severity: 'medium',
    marketMode: 'both',
  },
  // V2 Optimized Rules
  {
    type: 'futures_bottom_hunter_v2',
    name: 'Bottom Raid V2',
    description: 'Improved: deeper thresholds (-1.5%/-1.0%/+0.7%) + RSI < 35 oversold',
    severity: 'medium',
    marketMode: 'both',
  },
  {
    type: 'futures_top_hunter_v2',
    name: 'Top Raid V2',
    description: 'Improved: deeper thresholds (+1.5%/+1.0%/-0.7%) + RSI > 65 overbought',
    severity: 'medium',
    marketMode: 'both',
  },
  {
    type: 'futures_big_bull_60_v2',
    name: 'Surge 60 Bull V2',
    description: 'Improved: daily must be positive + outperforms BTC by 0.5%',
    severity: 'critical',
    marketMode: 'bull',
  },
  {
    type: 'futures_big_bear_60_v2',
    name: 'Surge 60 Bear V2',
    description: 'Improved: daily must be negative + underperforms BTC by 0.5%',
    severity: 'critical',
    marketMode: 'bear',
  },
  // Whale Detection
  {
    type: 'futures_whale_detector',
    name: 'Whale Detector',
    description: '5x average volume anomaly with < 0.3% price impact — potential accumulation/distribution',
    severity: 'high',
    marketMode: 'both',
  },
  {
    type: 'futures_whale_accumulation',
    name: 'Whale Accu',
    description: 'Whale volume anomaly with bullish context (15m trend positive or RSI > 50)',
    severity: 'high',
    marketMode: 'bull',
  },
  {
    type: 'futures_whale_distribution',
    name: 'Whale Dist',
    description: 'Whale volume anomaly with bearish context (15m trend negative or RSI < 50)',
    severity: 'high',
    marketMode: 'bear',
  },
  // V4 long-bias contrarian
  {
    type: 'futures_surge_42',
    name: 'Surge 42',
    description: 'Long entry on capitulation drop after recent failed bounce. Same predicate shape as Scout Bear (sharp 5m drop) but read as a 1-day mean-reversion long. Requires Bottom Raid within last 12h and excludes the asset_14d ∈ [-10%,-5%] regime. Excludes XMRUSDT.',
    severity: 'critical',
    marketMode: 'bull',
  },
  // Catcher family (holdout-validated capitulation longs, 1-day horizon)
  {
    type: 'futures_knife_catcher',
    name: 'Knife Catcher',
    description: 'Deep capitulation flush long: sharp accelerating 5m/15m drop on volume, Bottom Raid within 12h, and depth gate (1h < -5% or 1d < -3%). Shallow flushes are skipped. Holdout: +3.3–3.8%/episode over 50 unseen symbols. Fires on closed 1m candles only.',
    severity: 'critical',
    marketMode: 'bull',
  },
  {
    type: 'futures_capitulation_catcher',
    name: 'Capitulation Catcher',
    description: 'Complement leg: capitulation drop inside an established deep drawdown (14d < -20%) with NO bounce attempt in the last 12h — disjoint from Knife Catcher by construction. Holdout: +2.21%/episode, 46/48 symbols positive. Fires on closed 1m candles only.',
    severity: 'critical',
    marketMode: 'bull',
  },
  // ── Dojo confluence zones ────────────────────────────────────────
  // Unlike every rule above, these do NOT fire on a price move. They fire
  // once a day when a zone becomes ARMED: an FVG-validated fib 0.62–0.79
  // band with higher-timeframe fibonacci confluence and agreeing market
  // structure, which price has not yet traded into. The entry is a resting
  // limit at fib 0.705. To be told the moment price taps the zone, set a
  // TradingView alert on the Dojo Fib Confluence indicator.
  {
    type: 'futures_dojo_otz_long_1w',
    name: 'Dojo OTZ Long 1W',
    description: 'Weekly discount zone (fib 0.62–0.79) validated by a live fair value gap, with monthly fibonacci confluence and bullish structure. Rarest of the set. Entry rests at fib 0.705; alert fires when the zone forms, not when price arrives.',
    severity: 'critical',
    marketMode: 'bull',
  },
  {
    type: 'futures_dojo_otz_short_1w',
    name: 'Dojo OTZ Short 1W',
    description: 'Weekly premium zone (fib 0.62–0.79) validated by a live fair value gap, with monthly fibonacci confluence and bearish structure. Rarest of the set. Entry rests at fib 0.705; alert fires when the zone forms, not when price arrives.',
    severity: 'critical',
    marketMode: 'bear',
  },
  {
    type: 'futures_dojo_otz_long_5d',
    name: 'Dojo OTZ Long 5D',
    description: '5-day discount zone validated by a live fair value gap, with weekly/monthly fibonacci confluence and bullish structure. Note: 5D bars use a fixed epoch anchor and will not line up with a TradingView 5D chart.',
    severity: 'high',
    marketMode: 'bull',
  },
  {
    type: 'futures_dojo_otz_short_5d',
    name: 'Dojo OTZ Short 5D',
    description: '5-day premium zone validated by a live fair value gap, with weekly/monthly fibonacci confluence and bearish structure. Note: 5D bars use a fixed epoch anchor and will not line up with a TradingView 5D chart.',
    severity: 'high',
    marketMode: 'bear',
  },
  {
    type: 'futures_dojo_otz_long_1d',
    name: 'Dojo OTZ Long 1D',
    description: 'Daily discount zone validated by a live fair value gap, with weekly/monthly fibonacci confluence and bullish structure. Most frequent of the set. Entry rests at fib 0.705.',
    severity: 'high',
    marketMode: 'bull',
  },
  {
    type: 'futures_dojo_otz_short_1d',
    name: 'Dojo OTZ Short 1D',
    description: 'Daily premium zone validated by a live fair value gap, with weekly/monthly fibonacci confluence and bearish structure. Most frequent of the set. Entry rests at fib 0.705.',
    severity: 'high',
    marketMode: 'bear',
  },
  // ── Dojo zone entered ────────────────────────────────────────────
  // The follow-up to the six rules above. Those say a zone is worth an order;
  // these say price has reached it. Checked continuously against the live
  // price rather than once a day, and capped at one alert per zone per 12
  // hours — price can sit inside a band for a long time.
  {
    type: 'futures_dojo_near_long',
    name: 'Dojo Zone Entered (Long)',
    description: 'Price has traded into a previously armed Dojo discount zone, so the resting limit at fib 0.705 is now in play. The alert names the timeframe that armed the zone. At most one per zone every 12 hours.',
    severity: 'critical',
    marketMode: 'bull',
  },
  {
    type: 'futures_dojo_near_short',
    name: 'Dojo Zone Entered (Short)',
    description: 'Price has traded into a previously armed Dojo premium zone, so the resting limit at fib 0.705 is now in play. The alert names the timeframe that armed the zone. At most one per zone every 12 hours.',
    severity: 'critical',
    marketMode: 'bear',
  },
  // ── Dojo entry filled ────────────────────────────────────────────
  // The strongest of the three: price reached the limit itself. Fires once per
  // zone — deduplicated by the fill being recorded, not by a cooldown — and
  // suppresses the zone-entered alert for the same event.
  {
    type: 'futures_dojo_filled_long',
    name: 'Dojo Entry Filled (Long)',
    description: 'Price reached the resting limit at fib 0.705 of a Dojo discount zone. An order placed when the zone armed would now be filled; work from the stop and targets in the alert. Fires once per zone.',
    severity: 'critical',
    marketMode: 'bull',
  },
  {
    type: 'futures_dojo_filled_short',
    name: 'Dojo Entry Filled (Short)',
    description: 'Price reached the resting limit at fib 0.705 of a Dojo premium zone. An order placed when the zone armed would now be filled; work from the stop and targets in the alert. Fires once per zone.',
    severity: 'critical',
    marketMode: 'bear',
  },
]

/**
 * Futures alert type labels for UI display
 */
export const FUTURES_ALERT_LABELS: Record<FuturesAlertType, string> = {
  futures_big_bull_60: 'Surge 60 Bull',
  futures_big_bear_60: 'Surge 60 Bear',
  futures_pioneer_bull: 'Scout Bull',
  futures_pioneer_bear: 'Scout Bear',
  futures_5_big_bull: 'Surge 5 Bull',
  futures_5_big_bear: 'Surge 5 Bear',
  futures_15_big_bull: 'Surge 15 Bull',
  futures_15_big_bear: 'Surge 15 Bear',
  futures_bottom_hunter: 'Bottom Raid',
  futures_top_hunter: 'Top Raid',
  // V2 optimized
  futures_bottom_hunter_v2: '🟢 Bottom Raid V2',
  futures_top_hunter_v2: '🔴 Top Raid V2',
  futures_big_bull_60_v2: '🟢 Surge 60 Bull V2',
  futures_big_bear_60_v2: '🔴 Surge 60 Bear V2',
  // Whale
  futures_whale_detector: '🐋 Whale Detector',
  futures_whale_accumulation: '🐋⬆️ Whale Accu',
  futures_whale_distribution: '🐋⬇️ Whale Dist',
  // V4 long-bias contrarian
  futures_surge_42: '⚡ Surge 42',
  // Catcher family
  futures_knife_catcher: '🔪 Knife Catcher',
  futures_capitulation_catcher: '🩸 Capitulation Catcher',
  // Dojo confluence zones
  futures_dojo_otz_long_1d: '🥋🟢 Dojo OTZ Long 1D',
  futures_dojo_otz_short_1d: '🥋🔴 Dojo OTZ Short 1D',
  futures_dojo_otz_long_5d: '🥋🟢 Dojo OTZ Long 5D',
  futures_dojo_otz_short_5d: '🥋🔴 Dojo OTZ Short 5D',
  futures_dojo_otz_long_1w: '🥋🟢 Dojo OTZ Long 1W',
  futures_dojo_otz_short_1w: '🥋🔴 Dojo OTZ Short 1W',
  futures_dojo_near_long: '🎯🟢 Dojo Zone Entered (Long)',
  futures_dojo_near_short: '🎯🔴 Dojo Zone Entered (Short)',
  futures_dojo_filled_long: '✅🟢 Dojo Entry Filled (Long)',
  futures_dojo_filled_short: '✅🔴 Dojo Entry Filled (Short)',
}

/**
 * Default futures alert configuration
 */
export const DEFAULT_FUTURES_ALERT_CONFIG: FuturesAlertConfig = {
  enabled: false, // Disabled by default until user enables
  alerts: {
    futures_big_bull_60: { enabled: true, severity: 'critical' },
    futures_big_bear_60: { enabled: true, severity: 'critical' },
    futures_pioneer_bull: { enabled: true, severity: 'critical' },
    futures_pioneer_bear: { enabled: true, severity: 'critical' },
    futures_5_big_bull: { enabled: true, severity: 'high' },
    futures_5_big_bear: { enabled: true, severity: 'high' },
    futures_15_big_bull: { enabled: true, severity: 'high' },
    futures_15_big_bear: { enabled: true, severity: 'high' },
    futures_bottom_hunter: { enabled: true, severity: 'medium' },
    futures_top_hunter: { enabled: true, severity: 'medium' },
    // V2 optimized (enabled by default)
    futures_bottom_hunter_v2: { enabled: true, severity: 'medium' },
    futures_top_hunter_v2: { enabled: true, severity: 'medium' },
    futures_big_bull_60_v2: { enabled: true, severity: 'critical' },
    futures_big_bear_60_v2: { enabled: true, severity: 'critical' },
    // Whale (directional enabled, generic disabled)
    futures_whale_detector: { enabled: false, severity: 'high' },
    futures_whale_accumulation: { enabled: true, severity: 'high' },
    futures_whale_distribution: { enabled: true, severity: 'high' },
    // V4 long-bias contrarian — disabled by default; opt in via toggle
    futures_surge_42: { enabled: false, severity: 'critical' },
    // Catcher family — disabled by default; opt in via toggle
    futures_knife_catcher: { enabled: false, severity: 'critical' },
    futures_capitulation_catcher: { enabled: false, severity: 'critical' },
    // Dojo confluence zones. Only the 1W pair is enabled by default, matching
    // migration 019 — they are the rarest, since on a weekly chart the sole
    // higher-timeframe slot is 1M and a score of 2 demands a monthly fib AND
    // a live FVG on the same price.
    futures_dojo_otz_long_1w: { enabled: true, severity: 'critical' },
    futures_dojo_otz_short_1w: { enabled: true, severity: 'critical' },
    futures_dojo_otz_long_5d: { enabled: false, severity: 'high' },
    futures_dojo_otz_short_5d: { enabled: false, severity: 'high' },
    futures_dojo_otz_long_1d: { enabled: false, severity: 'high' },
    futures_dojo_otz_short_1d: { enabled: false, severity: 'high' },
    futures_dojo_near_long: { enabled: true, severity: 'critical' },
    futures_dojo_near_short: { enabled: true, severity: 'critical' },
    futures_dojo_filled_long: { enabled: true, severity: 'critical' },
    futures_dojo_filled_short: { enabled: true, severity: 'critical' },
  },
  globalThresholds: {
    priceChange_15m: 1.0, // 1%
    priceChange_1d: 15.0, // 15%
    volume_15m: 400000, // 400k USDT
    volume_1h: 1000000, // 1M USDT
    marketCapMin: 23000000, // 23M USD
    marketCapMax: 2500000000, // 2.5B USD
  },
  notificationEnabled: true,
  soundEnabled: true,
  webhookEnabled: false,
}
