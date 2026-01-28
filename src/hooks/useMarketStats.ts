/**
 * Market Statistics Hook
 * 
 * Calculates market sentiment and statistics from coin data.
 * Extracted from useMarketData.ts to avoid dependency on legacy code.
 */

import type { Coin } from '@/types/coin'

export interface MarketStats {
  totalCoins: number
  bullishCount: number
  bearishCount: number
  neutralCount: number
  bullishPercent: number
  bearishPercent: number
  neutralPercent: number
  sentiment: 'bullish' | 'bearish' | 'neutral'
}

export interface UseMarketStatsReturn {
  isLoading: boolean
  stats: MarketStats | null
}

/**
 * Calculate market statistics from coin data
 * 
 * @param coins - Array of coins to analyze
 * @param isLoading - Loading state from parent component
 * @returns Market statistics and loading state
 */
export function useMarketStats(coins?: Coin[], isLoading?: boolean): UseMarketStatsReturn {
  if (isLoading || !coins || coins.length === 0) {
    return { isLoading: isLoading ?? false, stats: null }
  }

  const bullishCoins = coins.filter((c) => c.priceChangePercent > 0)
  const bearishCoins = coins.filter((c) => c.priceChangePercent < 0)
  const neutralCoins = coins.filter((c) => c.priceChangePercent === 0)

  const totalCoins = coins.length
  const bullishCount = bullishCoins.length
  const bearishCount = bearishCoins.length
  const neutralCount = neutralCoins.length

  return {
    isLoading: false,
    stats: {
      totalCoins,
      bullishCount,
      bearishCount,
      neutralCount,
      bullishPercent: (bullishCount / totalCoins) * 100,
      bearishPercent: (bearishCount / totalCoins) * 100,
      neutralPercent: (neutralCount / totalCoins) * 100,
      sentiment:
        bullishCount > bearishCount
          ? 'bullish'
          : bearishCount > bullishCount
            ? 'bearish'
            : 'neutral',
    },
  }
}
