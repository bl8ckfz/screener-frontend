/**
 * Debug logging utility
 * Conditionally logs based on development environment
 */

const isDev = import.meta.env.DEV

export const debug = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args)
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args)
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args)
  },
  // Always log errors in production for debugging
  error: (...args: unknown[]) => {
    console.error(...args)
  }
}
