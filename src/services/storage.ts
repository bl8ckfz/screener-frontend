/**
 * IndexedDB Storage Utilities
 * 
 * Provides a robust IndexedDB-based storage layer with fallback to localStorage.
 * Uses idb-keyval for simplified IndexedDB operations.
 * 
 * Benefits over localStorage:
 * - Larger storage capacity (no 5-10MB limit)
 * - Async operations (non-blocking)
 * - Better performance for large data
 * - Type-safe with structured cloning
 * - No JSON serialization overhead
 */

import { get, set, del, clear, keys } from 'idb-keyval'

/**
 * Storage interface for compatibility
 */
export interface Storage {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
  clear: () => Promise<void>
  keys: () => Promise<string[]>
}

/**
 * IndexedDB storage implementation
 * Falls back to localStorage if IndexedDB is unavailable
 */
class IndexedDBStorage implements Storage {
  private isAvailable: boolean
  private fallbackStorage: typeof localStorage
  private hasLoggedError: boolean = false

  constructor() {
    this.isAvailable = this.checkAvailability()
    this.fallbackStorage = localStorage
  }

  /**
   * Check if IndexedDB is available
   */
  private checkAvailability(): boolean {
    try {
      return typeof indexedDB !== 'undefined'
    } catch {
      return false
    }
  }

  /**
   * Log warning only once to avoid console spam
   */
  private logWarningOnce(message: string, error?: unknown): void {
    if (!this.hasLoggedError) {
      console.warn(message, error)
      console.warn('Falling back to localStorage for all operations')
      this.hasLoggedError = true
    }
  }

  /**
   * Get item from storage
   */
  async getItem(key: string): Promise<string | null> {
    if (!this.isAvailable) {
      return this.fallbackStorage.getItem(key)
    }

    try {
      const value = await get<string>(key)
      return value ?? null
    } catch (error) {
      this.logWarningOnce('IndexedDB getItem failed:', error)
      return this.fallbackStorage.getItem(key)
    }
  }

  /**
   * Set item in storage
   */
  async setItem(key: string, value: string): Promise<void> {
    if (!this.isAvailable) {
      this.fallbackStorage.setItem(key, value)
      return
    }

    try {
      await set(key, value)
      // Also set in localStorage as backup
      this.fallbackStorage.setItem(key, value)
    } catch (error) {
      this.logWarningOnce('IndexedDB setItem failed:', error)
      this.fallbackStorage.setItem(key, value)
    }
  }

  /**
   * Remove item from storage
   */
  async removeItem(key: string): Promise<void> {
    if (!this.isAvailable) {
      this.fallbackStorage.removeItem(key)
      return
    }

    try {
      await del(key)
      this.fallbackStorage.removeItem(key)
    } catch (error) {
      this.logWarningOnce('IndexedDB removeItem failed:', error)
      this.fallbackStorage.removeItem(key)
    }
  }

  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    if (!this.isAvailable) {
      this.fallbackStorage.clear()
      return
    }

    try {
      await clear()
      this.fallbackStorage.clear()
    } catch (error) {
      this.logWarningOnce('IndexedDB clear failed:', error)
      this.fallbackStorage.clear()
    }
  }

  /**
   * Get all keys
   */
  async keys(): Promise<string[]> {
    if (!this.isAvailable) {
      return Object.keys(this.fallbackStorage)
    }

    try {
      const idbKeys = await keys()
      return idbKeys.map(String)
    } catch (error) {
      this.logWarningOnce('IndexedDB keys failed:', error)
      return Object.keys(this.fallbackStorage)
    }
  }
}

/**
 * Singleton instance
 */
export const storage = new IndexedDBStorage()

/**
 * Zustand persist storage adapter for IndexedDB
 * Compatible with Zustand's persist middleware
 */
export const createIndexedDBStorage = () => ({
  getItem: async (name: string): Promise<string | null> => {
    return storage.getItem(name)
  },
  setItem: async (name: string, value: string): Promise<void> => {
    return storage.setItem(name, value)
  },
  removeItem: async (name: string): Promise<void> => {
    return storage.removeItem(name)
  },
})

/**
 * Migration utility to move data from localStorage to IndexedDB
 */
export async function migrateFromLocalStorage(keys: string[]): Promise<void> {
  console.log('Migrating data from localStorage to IndexedDB...')
  
  let migratedCount = 0
  
  for (const key of keys) {
    try {
      const value = localStorage.getItem(key)
      if (value !== null) {
        await storage.setItem(key, value)
        migratedCount++
      }
    } catch (error) {
      console.warn(`Failed to migrate key "${key}":`, error)
    }
  }
  
  console.log(`Migration complete: ${migratedCount} items migrated`)
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  type: 'IndexedDB' | 'localStorage'
  keys: string[]
  estimatedSize: number
}> {
  const allKeys = await storage.keys()
  let estimatedSize = 0

  for (const key of allKeys) {
    const value = await storage.getItem(key)
    if (value) {
      estimatedSize += value.length * 2 // Rough estimate (UTF-16)
    }
  }

  return {
    type: typeof indexedDB !== 'undefined' ? 'IndexedDB' : 'localStorage',
    keys: allKeys,
    estimatedSize,
  }
}

/**
 * Export all data for backup
 */
export async function exportAllData(): Promise<Record<string, string>> {
  const allKeys = await storage.keys()
  const data: Record<string, string> = {}

  for (const key of allKeys) {
    const value = await storage.getItem(key)
    if (value !== null) {
      data[key] = value
    }
  }

  return data
}

/**
 * Import data from backup
 */
export async function importAllData(data: Record<string, string>): Promise<void> {
  console.log('Importing data...')
  
  for (const [key, value] of Object.entries(data)) {
    await storage.setItem(key, value)
  }
  
  console.log(`Import complete: ${Object.keys(data).length} items imported`)
}
