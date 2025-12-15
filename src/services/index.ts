// API Services
export { BinanceApiClient, binanceApi } from './binanceApi'
export { BinanceFuturesApiClient, binanceFuturesApi } from './binanceFuturesApi'
export { CoinGeckoApiClient, coinGeckoApi } from './coinGeckoApi'
export { FuturesMetricsService } from './futuresMetricsService'

// Data Processing
export {
  parseSymbol,
  filterTickersByPair,
  tickerToCoin,
  processTickersForPair,
  findCoinBySymbol,
  getMarketStats,
} from './dataProcessor'

// Storage
export {
  storage,
  createIndexedDBStorage,
  migrateFromLocalStorage,
  getStorageStats,
  exportAllData,
  importAllData,
} from './storage'
export type { Storage } from './storage'

// Alert System
export {
  evaluateAlertRules,
} from './alertEngine'
export { AlertHistoryService, alertHistory } from './alertHistory'
export { alertHistoryService } from './alertHistoryService'
export { audioNotificationService } from './audioNotification'
export type { AlertSeverity } from './audioNotification'
export { sendDiscordWebhook, testDiscordWebhook, isValidDiscordWebhookUrl, sendBatchToWebhooks } from './webhookService'
export { alertBatcher } from './alertBatcher'
export type { AlertSummary, SymbolStats } from './alertBatcher'

// Bubble Detection
export { BubbleDetectionService, DEFAULT_BUBBLE_CONFIG } from './bubbleDetectionService'

// Sync Service
export * from './syncService'
