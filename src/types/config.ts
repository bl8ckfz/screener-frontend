import { CurrencyPair } from './coin'
import { ScreeningListId } from './screener'

/**
 * View mode options
 */
export type ViewMode = 'table' | 'cards' | 'compact'

/**
 * Display mode options (legacy: "LH" from fast.html)
 */
export type DisplayMode = 'LH' | 'HL' | 'default'

/**
 * Theme options
 */
export type Theme = 'dark' | 'light' | 'auto'

/**
 * Refresh interval options (in seconds)
 */
export type RefreshInterval = 5 | 10 | 15 | 20 | 30 | 60

/**
 * Application configuration
 */
export interface AppConfig {
  // API settings
  api: {
    binanceUrl: string
    timeout: number
    retries: number
  }

  // Display settings
  display: {
    theme: Theme
    viewMode: ViewMode
    displayMode: DisplayMode
    showCharts: boolean
    compactMode: boolean
    fontSize: number // 10-16px
  }

  // Data settings
  data: {
    currentPair: CurrencyPair
    currentList: ScreeningListId
    currentPage: number
    itemsPerPage: number
  }

  // Refresh settings
  refresh: {
    enabled: boolean
    interval: RefreshInterval // in seconds
    autoRefreshOnFocus: boolean
  }

  // Advanced settings
  advanced: {
    maxHistoricalSnapshots: number
    cacheExpiration: number // in seconds
  }
}

/**
 * User preferences (persisted in IndexedDB/localStorage)
 */
export interface UserPreferences extends AppConfig {
  // User identification (optional)
  userId?: string

  // UI preferences
  ui: {
    sidebarCollapsed: boolean
    columnVisibility: Record<string, boolean>
    customColumns?: string[]
    favoriteSymbols: string[]
  }

  // Notifications
  notifications: {
    enabled: boolean
    sound: boolean
    desktop: boolean
  }

  // Last state
  lastUsed: {
    pair: CurrencyPair
    list: ScreeningListId
    viewMode: ViewMode
    lastVisit: number
  }

  // Version for migration
  version: string
  createdAt: number
  updatedAt: number
}

/**
 * Default application configuration
 */
export const DEFAULT_CONFIG: AppConfig = {
  api: {
    binanceUrl: import.meta.env.VITE_BINANCE_API_URL || 'https://api.binance.com/api/v3',
    timeout: 10000,
    retries: 3,
  },
  display: {
    theme: 'dark',
    viewMode: 'table',
    displayMode: 'LH',
    showCharts: true,
    compactMode: false,
    fontSize: 10,
  },
  data: {
    currentPair: (import.meta.env.VITE_DEFAULT_PAIR as CurrencyPair) || 'USDT',
    currentList: Number(import.meta.env.VITE_DEFAULT_LIST) || 134,
    currentPage: 1,
    itemsPerPage: 20,
  },
  refresh: {
    enabled: true,
    interval: ((Number(import.meta.env.VITE_REFRESH_INTERVAL) / 1000) || 5) as RefreshInterval,
    autoRefreshOnFocus: true,
  },
  advanced: {
    maxHistoricalSnapshots: 10,
    cacheExpiration: 300, // 5 minutes
  },
}

/**
 * Storage keys for persisting config
 */
export const STORAGE_KEYS = {
  USER_PREFERENCES: 'crypto_screener_preferences',
  HISTORICAL_DATA: 'crypto_screener_historical',
  WATCHLISTS: 'crypto_screener_watchlists',
  ALERT_RULES: 'crypto_screener_alerts',
  CACHE: 'crypto_screener_cache',
} as const

/**
 * Column visibility options
 */
export interface ColumnConfig {
  key: string
  label: string
  visible: boolean
  width?: number
  sortable: boolean
  align?: 'left' | 'center' | 'right'
}

/**
 * Default column configuration
 */
export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'symbol', label: 'Symbol', visible: true, sortable: true, align: 'left' },
  { key: 'lastPrice', label: 'Price', visible: true, width: 120, sortable: true, align: 'right' },
  { key: 'priceChangePercent', label: 'Change %', visible: true, width: 100, sortable: true, align: 'right' },
  { key: 'volume', label: 'Volume', visible: true, width: 120, sortable: true, align: 'right' },
  { key: 'quoteVolume', label: 'Quote Vol', visible: true, width: 120, sortable: true, align: 'right' },
  { key: 'vcp', label: 'VCP', visible: true, width: 80, sortable: true, align: 'right' },
  { key: 'priceToWeightedAvg', label: 'P/WA', visible: true, width: 80, sortable: true, align: 'right' },
  { key: 'highToLow', label: 'H/L', visible: false, width: 80, sortable: true, align: 'right' },
  { key: 'count', label: 'Trades', visible: false, width: 100, sortable: true, align: 'right' },
]
