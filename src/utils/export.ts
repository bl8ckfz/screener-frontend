import { debug } from '@/utils/debug'
import type { Coin } from '@/types/coin'

/**
 * Export utilities for coin data
 */

/**
 * Convert coins array to CSV format
 */
export function exportToCSV(coins: Coin[], filename: string = 'pulsaryx-export.csv'): void {
  if (!coins || coins.length === 0) {
    debug.warn('No data to export')
    return
  }

  // Define columns to export
  const headers = [
    'Symbol',
    'Price',
    'Price Change %',
    'Volume',
    'Quote Volume',
    'Weighted Avg Price',
    'High 24h',
    'Low 24h',
    'Open Price',
    'VCP',
    'Volume/WA Ratio',
    'ETH Dominance',
    'BTC Dominance',
    'PAXG Dominance',
  ]

  // Build CSV content
  const csvRows = [headers.join(',')]

  coins.forEach((coin) => {
    const row = [
      coin.symbol,
      coin.lastPrice,
      coin.priceChangePercent,
      coin.volume,
      coin.quoteVolume,
      coin.weightedAvgPrice,
      coin.highPrice,
      coin.lowPrice,
      coin.openPrice,
      coin.indicators.vcp,
      coin.indicators.priceToWeightedAvg,
      coin.indicators.ethDominance,
      coin.indicators.btcDominance,
      coin.indicators.paxgDominance,
    ]
    csvRows.push(row.join(','))
  })

  const csvContent = csvRows.join('\n')
  downloadFile(csvContent, filename, 'text/csv')
}

/**
 * Convert coins array to JSON format
 */
export function exportToJSON(coins: Coin[], filename: string = 'pulsaryx-export.json'): void {
  if (!coins || coins.length === 0) {
    debug.warn('No data to export')
    return
  }

  const jsonContent = JSON.stringify(coins, null, 2)
  downloadFile(jsonContent, filename, 'application/json')
}

/**
 * Download file to user's device
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(prefix: string = 'pulsaryx', extension: string = 'csv'): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  return `${prefix}-${timestamp}.${extension}`
}
