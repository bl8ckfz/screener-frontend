/**
 * Alert color configuration — maps each alert type to a hex color.
 * V2 variants fall back to their base type color when not explicitly set.
 */
export interface AlertColorConfig {
  // Original
  futures_big_bull_60: string
  futures_pioneer_bull: string
  futures_5_big_bull: string
  futures_15_big_bull: string
  futures_bottom_hunter: string
  futures_big_bear_60: string
  futures_pioneer_bear: string
  futures_5_big_bear: string
  futures_15_big_bear: string
  futures_top_hunter: string
  // V2 Optimized
  futures_bottom_hunter_v2: string
  futures_top_hunter_v2: string
  futures_big_bull_60_v2: string
  futures_big_bear_60_v2: string
  // Whale
  futures_whale_detector: string
  futures_whale_accumulation: string
  futures_whale_distribution: string
}

export type AlertColorKey = keyof AlertColorConfig

export const DEFAULT_ALERT_COLORS: AlertColorConfig = {
  // Bullish
  futures_big_bull_60: '#14532d',
  futures_pioneer_bull: '#a7f3d0',
  futures_5_big_bull: '#84cc16',
  futures_15_big_bull: '#16a34a',
  futures_bottom_hunter: '#a855f7',
  // Bearish
  futures_big_bear_60: '#7f1d1d',
  futures_pioneer_bear: '#fce7f3',
  futures_5_big_bear: '#f87171',
  futures_15_big_bear: '#dc2626',
  futures_top_hunter: '#a855f7',
  // V2 Optimized
  futures_bottom_hunter_v2: '#8b5cf6',
  futures_top_hunter_v2: '#8b5cf6',
  futures_big_bull_60_v2: '#22c55e',
  futures_big_bear_60_v2: '#ef4444',
  // Whale
  futures_whale_detector: '#22d3ee',
  futures_whale_accumulation: '#34d399',
  futures_whale_distribution: '#f87171',
}

/** Grouped categories for the settings UI */
export const ALERT_COLOR_CATEGORIES = {
  bullish: [
    'futures_big_bull_60',
    'futures_15_big_bull',
    'futures_5_big_bull',
    'futures_pioneer_bull',
  ] as AlertColorKey[],
  bearish: [
    'futures_big_bear_60',
    'futures_15_big_bear',
    'futures_5_big_bear',
    'futures_pioneer_bear',
  ] as AlertColorKey[],
  hunter: [
    'futures_bottom_hunter',
    'futures_top_hunter',
  ] as AlertColorKey[],
  v2: [
    'futures_big_bull_60_v2',
    'futures_big_bear_60_v2',
    'futures_bottom_hunter_v2',
    'futures_top_hunter_v2',
  ] as AlertColorKey[],
  whale: [
    'futures_whale_accumulation',
    'futures_whale_distribution',
    'futures_whale_detector',
  ] as AlertColorKey[],
}

/** Human-readable label for each alert color key */
export function getAlertColorLabel(alertType: AlertColorKey): string {
  const labels: Record<AlertColorKey, string> = {
    futures_big_bull_60: 'Surge 60 Bull',
    futures_pioneer_bull: 'Scout Bull',
    futures_5_big_bull: 'Surge 5 Bull',
    futures_15_big_bull: 'Surge 15 Bull',
    futures_bottom_hunter: 'Bottom Raid',
    futures_big_bear_60: 'Surge 60 Bear',
    futures_pioneer_bear: 'Scout Bear',
    futures_5_big_bear: 'Surge 5 Bear',
    futures_15_big_bear: 'Surge 15 Bear',
    futures_top_hunter: 'Top Raid',
    futures_bottom_hunter_v2: 'Bottom Raid V2',
    futures_top_hunter_v2: 'Top Raid V2',
    futures_big_bull_60_v2: 'Surge 60 Bull V2',
    futures_big_bear_60_v2: 'Surge 60 Bear V2',
    futures_whale_detector: 'Whale Detector',
    futures_whale_accumulation: 'Whale Accu',
    futures_whale_distribution: 'Whale Dist',
  }
  return labels[alertType] ?? alertType
}

/** Validate a hex color string (#RRGGBB) */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color)
}

/**
 * Look up the user color for a given alert type string.
 * Handles both `futures_*` and bare type names.
 */
export function resolveAlertColor(
  alertColors: AlertColorConfig,
  type: string,
  fallback = '#3b82f6',
): string {
  const key = type.startsWith('futures_') ? type : `futures_${type}`
  return (alertColors as unknown as Record<string, string>)[key] ?? fallback
}
