import { Timeframe } from './coin'

/**
 * Alert type categories
 */
export type AlertType =
  | 'price_pump' // Significant price increase
  | 'price_dump' // Significant price decrease
  | 'volume_spike' // Volume significantly increased
  | 'volume_drop' // Volume significantly decreased
  | 'vcp_signal' // VCP pattern detected
  | 'fibonacci_break' // Price broke Fibonacci level
  | 'trend_reversal' // Trend direction changed
  | 'pioneer_bull' // Legacy: PIONEER BULL ALARM (strong bull signal)
  | 'pioneer_bear' // Legacy: PIONEER BEAR ALARM (strong bear signal)
  | '5m_big_bull' // Legacy: 5m BIG BULL ALARM (5-minute volume spike)
  | '5m_big_bear' // Legacy: 5m BIG BEAR ALARM (5-minute volume drop)
  | '15m_big_bull' // Legacy: 15m BIG BULL ALARM (15-minute volume spike)
  | '15m_big_bear' // Legacy: 15m BIG BEAR ALARM (15-minute volume drop)
  | 'bottom_hunter' // Legacy: BOTTOM HUNTER ALARM (potential bottom reversal)
  | 'top_hunter' // Legacy: TOP HUNTER ALARM (potential top reversal)
  | 'custom' // User-defined custom alert

/**
 * Futures alert types (based on Binance Futures API data)
 * These alerts use kline data from 5m, 15m, 1h, 8h, 1d intervals
 * and market cap data from CoinGecko
 */
export type FuturesAlertType =
  | 'futures_big_bull_60' // 60-minute Big Bull (strong upward momentum)
  | 'futures_big_bear_60' // 60-minute Big Bear (strong downward momentum)
  | 'futures_pioneer_bull' // Pioneer Bull (early bullish trend detection)
  | 'futures_pioneer_bear' // Pioneer Bear (early bearish trend detection)
  | 'futures_5_big_bull' // 5-minute Big Bull (short-term bullish spike)
  | 'futures_5_big_bear' // 5-minute Big Bear (short-term bearish spike)
  | 'futures_15_big_bull' // 15-minute Big Bull (medium-term bullish spike)
  | 'futures_15_big_bear' // 15-minute Big Bear (medium-term bearish spike)
  | 'futures_bottom_hunter' // Bottom Hunter (potential bottom reversal)
  | 'futures_top_hunter' // Top Hunter (potential top reversal)

/**
 * Combined alert type (Spot + Futures)
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
    name: 'Pioneer Bull',
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
    name: 'Pioneer Bear',
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
    name: '5m Big Bull',
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
    name: '5m Big Bear',
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
    name: '15m Big Bull',
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
    name: '15m Big Bear',
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
    name: 'Bottom Hunter',
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
    name: 'Top Hunter',
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
    name: '60 Big Bull',
    description: 'Sustained bullish momentum: 1h > 1.6%, progressive validation across 8h/1d, strong volume acceleration',
    severity: 'critical',
    marketMode: 'bull',
  },
  {
    type: 'futures_big_bear_60',
    name: '60 Big Bear',
    description: 'Sustained bearish momentum: 1h < -1.6%, progressive downtrend across 8h/1d, strong volume',
    severity: 'critical',
    marketMode: 'bear',
  },
  {
    type: 'futures_pioneer_bull',
    name: 'Pioneer Bull',
    description: 'Early bullish detection: 5m/15m > 1%, accelerating momentum with volume confirmation',
    severity: 'critical',
    marketMode: 'bull',
  },
  {
    type: 'futures_pioneer_bear',
    name: 'Pioneer Bear',
    description: 'Early bearish detection: 5m/15m < -1%, accelerating downward momentum with volume',
    severity: 'critical',
    marketMode: 'bear',
  },
  {
    type: 'futures_5_big_bull',
    name: '5 Big Bull',
    description: 'Explosive 5m move: progressive validation across 5m/15m/1h with strong volume acceleration',
    severity: 'high',
    marketMode: 'bull',
  },
  {
    type: 'futures_5_big_bear',
    name: '5 Big Bear',
    description: 'Explosive 5m drop: progressive downward momentum with strong volume acceleration',
    severity: 'high',
    marketMode: 'bear',
  },
  {
    type: 'futures_15_big_bull',
    name: '15 Big Bull',
    description: 'Strong 15m uptrend: progressive validation across 15m/1h/8h with volume confirmation',
    severity: 'high',
    marketMode: 'bull',
  },
  {
    type: 'futures_15_big_bear',
    name: '15 Big Bear',
    description: 'Strong 15m downtrend: progressive downward momentum across timeframes',
    severity: 'high',
    marketMode: 'bear',
  },
  {
    type: 'futures_bottom_hunter',
    name: 'Bottom Hunter',
    description: 'Bottom reversal: 1h/15m declining but 5m reversing upward with volume spike',
    severity: 'medium',
    marketMode: 'both',
  },
  {
    type: 'futures_top_hunter',
    name: 'Top Hunter',
    description: 'Top reversal: 1h/15m rallying but 5m reversing downward with volume spike',
    severity: 'medium',
    marketMode: 'both',
  },
]

/**
 * Futures alert type labels for UI display
 */
export const FUTURES_ALERT_LABELS: Record<FuturesAlertType, string> = {
  futures_big_bull_60: '60 Big Bull',
  futures_big_bear_60: '60 Big Bear',
  futures_pioneer_bull: 'Pioneer Bull',
  futures_pioneer_bear: 'Pioneer Bear',
  futures_5_big_bull: '5 Big Bull',
  futures_5_big_bear: '5 Big Bear',
  futures_15_big_bull: '15 Big Bull',
  futures_15_big_bear: '15 Big Bear',
  futures_bottom_hunter: 'Bottom Hunter',
  futures_top_hunter: 'Top Hunter',
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
