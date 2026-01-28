// Backend API
export { backendApi, isValidDiscordWebhookUrl, isValidTelegramWebhook, webhooks } from './backendApi'

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

// Alert History
export { alertHistory } from './alertHistory'
export { alertHistoryService } from './alertHistoryService'
export { audioNotificationService } from './audioNotification'
export type { AlertSeverity } from './audioNotification'

// Notifications
export { showNotification } from './notification'

// Sync Service
export * from './syncService'
