/**
 * Alert Engine - Evaluates alert rules against market data
 * 
 * This service replicates the alert logic from fast.html while providing
 * a flexible, extensible architecture for custom alerts.
 */

import type { Coin, Timeframe } from '@/types/coin'
import type {
  Alert,
  AlertRule,
  AlertCondition,
} from '@/types/alert'
import { LEGACY_ALERT_PRESETS } from '@/types/alert'

/**
 * Helper to get timeframe data from coin history
 */
function getTimeframeData(coin: Coin, timeframe: Timeframe) {
  return coin.history[timeframe]
}

/**
 * Evaluate all alert rules against the given coins
 */
export function evaluateAlertRules(
  coins: Coin[],
  rules: AlertRule[],
  marketMode: 'bull' | 'bear' = 'bull'
): Alert[] {
  const alerts: Alert[] = []
  const enabledRules = rules.filter((rule) => rule.enabled)

  for (const coin of coins) {
    for (const rule of enabledRules) {
      const triggeredAlert = evaluateRule(coin, rule, marketMode)
      if (triggeredAlert) {
        alerts.push(triggeredAlert)
      }
    }
  }

  return alerts
}

/**
 * Evaluate a single alert rule against a coin
 */
function evaluateRule(
  coin: Coin,
  rule: AlertRule,
  marketMode: 'bull' | 'bear'
): Alert | null {
  // Check if rule applies to this symbol
  if (rule.symbols.length > 0 && !rule.symbols.includes(coin.symbol)) {
    return null
  }

  // Evaluate each condition
  const allConditionsMet = rule.conditions.every((condition) =>
    evaluateCondition(coin, condition, marketMode)
  )

  if (!allConditionsMet) {
    return null
  }

  // Get first condition for alert metadata
  const firstCondition = rule.conditions[0]
  const alertType = firstCondition?.type || 'custom'

  // For momentum-based alerts, show price change % instead of absolute price
  const momentumAlerts = ['pioneer_bull', 'pioneer_bear', '5m_big_bull', '5m_big_bear', '15m_big_bull', '15m_big_bear']
  const usePercentage = momentumAlerts.includes(alertType)

  // Create alert
  return {
    id: `${coin.symbol}-${rule.id}-${Date.now()}`,
    symbol: coin.symbol,
    type: alertType,
    severity: rule.severity,
    title: generateAlertTitle(coin, rule),
    message: generateAlertMessage(coin, rule),
    value: usePercentage ? coin.priceChangePercent : coin.lastPrice,
    threshold: firstCondition?.threshold || 0,
    timeframe: firstCondition?.timeframe,
    timestamp: Date.now(),
    read: false,
    dismissed: false,
  }
}

/**
 * Evaluate a single condition
 */
function evaluateCondition(
  coin: Coin,
  condition: AlertCondition,
  marketMode: 'bull' | 'bear'
): boolean {
  const { type, threshold, timeframe } = condition

  switch (type) {
    case 'price_pump':
      return evaluatePricePump(coin, threshold, timeframe)
    
    case 'price_dump':
      return evaluatePriceDump(coin, threshold, timeframe)
    
    case 'volume_spike':
      return evaluateVolumeSpike(coin, threshold, timeframe)
    
    case 'volume_drop':
      return evaluateVolumeDrop(coin, threshold, timeframe)
    
    case 'vcp_signal':
      return evaluateVCPSignal(coin, threshold)
    
    case 'fibonacci_break':
      return evaluateFibonacciBreak(coin, threshold)
    
    case 'pioneer_bull':
      return marketMode === 'bull' && evaluatePioneerBull(coin)
    
    case 'pioneer_bear':
      return marketMode === 'bear' && evaluatePioneerBear(coin)
    
    case '5m_big_bull':
      return marketMode === 'bull' && evaluate5mBigBull(coin)
    
    case '5m_big_bear':
      return marketMode === 'bear' && evaluate5mBigBear(coin)
    
    case '15m_big_bull':
      return marketMode === 'bull' && evaluate15mBigBull(coin)
    
    case '15m_big_bear':
      return marketMode === 'bear' && evaluate15mBigBear(coin)
    
    case 'bottom_hunter':
      return evaluateBottomHunter(coin)
    
    case 'top_hunter':
      return evaluateTopHunter(coin)
    
    default:
      return false
  }
}

// ============================================================================
// LEGACY ALERT EVALUATORS (from fast.html)
// ============================================================================

/**
 * PIONEER BULL ALARM
 * Condition: Strong bullish momentum with accelerating price growth
 * Original fast.html logic (line 2028):
 * price/5m > 1.01 && price/15m > 1.01 && 3*(price/5m) > price/prevClose
 * && 2*volume/volume5m > volume/volume15m
 * 
 * For testing: If history is unavailable, use priceChangePercent as proxy
 */
function evaluatePioneerBull(coin: Coin): boolean {
  // Get historical data - EXACT mapping from fast.html
  const price5m = getTimeframeData(coin, '5m')?.price      // FAST_DIZI[t][102]
  const price15m = getTimeframeData(coin, '15m')?.price    // FAST_DIZI[t][107]
  const volume5m = getTimeframeData(coin, '5m')?.volume    // FAST_DIZI[t][101]
  const volume15m = getTimeframeData(coin, '15m')?.volume  // FAST_DIZI[t][106]
  const previousClose = coin.prevClosePrice                // FAST_DIZI[t][10]
  
  // If we have full history, use EXACT original logic
  if (price5m && price15m && volume5m && volume15m && previousClose) {
    console.log(`🐂 ${coin.symbol} Pioneer Bull check (with history):`, {
      currentPrice: coin.lastPrice,
      price5m,
      price15m,
      volume5m,
      volume15m,
      previousClose,
      priceRatio5m: (coin.lastPrice / price5m).toFixed(4),
      priceRatio15m: (coin.lastPrice / price15m).toFixed(4)
    })
    const priceRatio5m = coin.lastPrice / price5m           // [6]/[102]
    const priceRatio15m = coin.lastPrice / price15m         // [6]/[107]
    const priceRatioPrev = coin.lastPrice / previousClose   // [6]/[10]
    const volumeRatio = (2 * coin.quoteVolume) / volume5m > coin.quoteVolume / volume15m
    
    return (
      priceRatio5m > 1.01 &&                    // price/5m > 1.01
      priceRatio15m > 1.01 &&                   // price/15m > 1.01
      3 * priceRatio5m > priceRatioPrev &&      // 3*(price/5m) > price/prevClose
      volumeRatio                                // 2*vol/vol5m > vol/vol15m
    )
  }
  
  // No fallback - require historical data for accurate evaluation
  console.log(`⚠️ ${coin.symbol} Pioneer Bull skipped - insufficient history (need 5m and 15m)`, {
    hasHistory5m: !!price5m,
    hasHistory15m: !!price15m
  })
  return false
}

/**
 * PIONEER BEAR ALARM
 * Condition: Strong bearish momentum with accelerating price decline
 * Original fast.html logic (line 2845):
 * price/5m < 0.99 && price/15m < 0.99 && 3*(price/5m) < price/prevClose
 * && 2*volume/volume5m > volume/volume15m
 * 
 * For testing: If history unavailable, use priceChangePercent as proxy
 */
function evaluatePioneerBear(coin: Coin): boolean {
  // Get historical data - EXACT mapping from fast.html
  const price5m = getTimeframeData(coin, '5m')?.price      // FAST_DIZI[t][102]
  const price15m = getTimeframeData(coin, '15m')?.price    // FAST_DIZI[t][107]
  const volume5m = getTimeframeData(coin, '5m')?.volume    // FAST_DIZI[t][101]
  const volume15m = getTimeframeData(coin, '15m')?.volume  // FAST_DIZI[t][106]
  const previousClose = coin.prevClosePrice                // FAST_DIZI[t][10]
  
  // If we have history, use EXACT original logic
  if (price5m && price15m && volume5m && volume15m && previousClose) {
    console.log(`🐻 ${coin.symbol} Pioneer Bear check (with history):`, {
      currentPrice: coin.lastPrice,
      price5m,
      price15m,
      volume5m,
      volume15m,
      previousClose,
      priceRatio5m: (coin.lastPrice / price5m).toFixed(4),
      priceRatio15m: (coin.lastPrice / price15m).toFixed(4)
    })
    const priceRatio5m = coin.lastPrice / price5m           // [6]/[102]
    const priceRatio15m = coin.lastPrice / price15m         // [6]/[107]
    const priceRatioPrev = coin.lastPrice / previousClose   // [6]/[10]
    const volumeRatio = (2 * coin.quoteVolume) / volume5m > coin.quoteVolume / volume15m
    
    return (
      priceRatio5m < 0.99 &&                    // price/5m < 0.99 (2-1.01 from fast.html)
      priceRatio15m < 0.99 &&                   // price/15m < 0.99 (2-1.01 from fast.html)
      3 * priceRatio5m < priceRatioPrev &&      // 3*(price/5m) < price/prevClose
      volumeRatio                                // 2*vol/vol5m > vol/vol15m
    )
  }
  
  // No fallback - require historical data for accurate evaluation
  console.log(`⚠️ ${coin.symbol} Pioneer Bear skipped - insufficient history (need 5m and 15m)`, {
    hasHistory5m: !!price5m,
    hasHistory15m: !!price15m
  })
  return false
}

/**
 * 5M BIG BULL ALARM
 * Condition: 5-minute volume spike with price increase
 * Original: price/3m > 1.006 && volume delta > 100k && ascending volumes
 * For testing: If history unavailable, use strong momentum as proxy
 */
function evaluate5mBigBull(coin: Coin): boolean {
  const price1m = getTimeframeData(coin, '1m')?.price
  const price3m = getTimeframeData(coin, '3m')?.price
  const volume5m = getTimeframeData(coin, '5m')?.volume
  
  // If we have history, use original logic
  if (price1m && price3m && volume5m) {
    const volume1m = getTimeframeData(coin, '1m')?.volume || coin.quoteVolume
    const volume3m = getTimeframeData(coin, '3m')?.volume || coin.quoteVolume
    
    const priceRatio3m = coin.lastPrice / price3m
    const volumeDelta3m = coin.quoteVolume - volume3m
    const volumeDelta5m = coin.quoteVolume - volume5m
    
    const priceAscending = price3m < price1m && price1m < coin.lastPrice
    const volumeAscending =
      volume3m < volume1m &&
      volume1m < volume5m &&
      volume5m < coin.quoteVolume
    
    return (
      priceRatio3m > 1.006 &&
      volumeDelta3m > 100000 &&
      volumeDelta5m > 50000 &&
      priceAscending &&
      volumeAscending
    )
  }
  
  // No fallback - require historical data
  return false
}

/**
 * 5M BIG BEAR ALARM
 * Condition: 5-minute volume spike with price decrease
 */
function evaluate5mBigBear(coin: Coin): boolean {
  const price1m = getTimeframeData(coin, '1m')?.price || coin.lastPrice
  const price3m = getTimeframeData(coin, '3m')?.price || coin.lastPrice
  // const price5m = getTimeframeData(coin, '5m')?.price || coin.lastPrice
  
  const volume1m = getTimeframeData(coin, '1m')?.volume || coin.quoteVolume
  const volume3m = getTimeframeData(coin, '3m')?.volume || coin.quoteVolume
  const volume5m = getTimeframeData(coin, '5m')?.volume || coin.quoteVolume
  
  const priceRatio3m = coin.lastPrice / price3m
  const volumeDelta3m = coin.quoteVolume - volume3m
  const volumeDelta5m = coin.quoteVolume - volume5m
  
  // Check price descending: 3m > 1m > current
  const priceDescending =
    price3m > price1m && price1m > coin.lastPrice
  
  // Check volume ascending
  const volumeAscending =
    volume3m < volume1m &&
    volume1m < volume5m &&
    volume5m < coin.quoteVolume
  
  return (
    priceRatio3m < 0.994 && // < 2-1.006
    volumeDelta3m > 100000 &&
    volumeDelta5m > 50000 &&
    priceDescending &&
    volumeAscending
  )
}

/**
 * 15M BIG BULL ALARM
 * Condition: 15-minute volume spike with price increase
 * Original: price/15m > 1.01 && volume delta > 400k
 */
function evaluate15mBigBull(coin: Coin): boolean {
  const price3m = getTimeframeData(coin, '3m')?.price
  const price15m = getTimeframeData(coin, '15m')?.price
  
  const volume1m = getTimeframeData(coin, '1m')?.volume
  const volume3m = getTimeframeData(coin, '3m')?.volume
  const volume5m = getTimeframeData(coin, '5m')?.volume
  const volume15m = getTimeframeData(coin, '15m')?.volume
  
  // Require all historical data
  if (!price3m || !price15m || !volume1m || !volume3m || !volume5m || !volume15m) {
    return false
  }
  
  const priceRatio15m = coin.lastPrice / price15m
  const volumeDelta3m = coin.quoteVolume - volume3m
  const volumeDelta15m = coin.quoteVolume - volume15m
  
  // Check price ascending: 15m < 3m < current
  const priceAscending =
    price15m < price3m && price3m < coin.lastPrice
  
  // Check volume ascending
  const volumeAscending =
    volume15m < volume3m &&
    volume3m < volume5m &&
    volume5m < coin.quoteVolume &&
    volume1m > volume3m
  
  return (
    priceRatio15m > 1.01 &&
    volumeDelta15m > 400000 &&
    volumeDelta3m > 100000 &&
    priceAscending &&
    volumeAscending
  )
}

/**
 * 15M BIG BEAR ALARM
 * Condition: 15-minute volume spike with price decrease
 */
function evaluate15mBigBear(coin: Coin): boolean {
  const price3m = getTimeframeData(coin, '3m')?.price
  const price15m = getTimeframeData(coin, '15m')?.price
  
  const volume1m = getTimeframeData(coin, '1m')?.volume
  const volume3m = getTimeframeData(coin, '3m')?.volume
  const volume5m = getTimeframeData(coin, '5m')?.volume
  const volume15m = getTimeframeData(coin, '15m')?.volume
  
  // Require all historical data
  if (!price3m || !price15m || !volume1m || !volume3m || !volume5m || !volume15m) {
    return false
  }
  
  const priceRatio15m = coin.lastPrice / price15m
  const volumeDelta3m = coin.quoteVolume - volume3m
  const volumeDelta15m = coin.quoteVolume - volume15m
  
  // Check price descending: 15m > 3m > current
  const priceDescending =
    price15m > price3m && price3m > coin.lastPrice
  
  // Check volume ascending
  const volumeAscending =
    volume15m < volume3m &&
    volume3m < volume5m &&
    volume5m < coin.quoteVolume &&
    volume1m > volume3m
  
  return (
    priceRatio15m < 0.99 &&
    volumeDelta15m > 400000 &&
    volumeDelta3m > 100000 &&
    priceDescending &&
    volumeAscending
  )
}

/**
 * BOTTOM HUNTER ALARM
 * Condition: Price declining but showing reversal signs
 * Original: price/15m < 0.994 && price/3m < 0.995 && price/1m > 1.004
 */
function evaluateBottomHunter(coin: Coin): boolean {
  const price1m = getTimeframeData(coin, '1m')?.price
  const price3m = getTimeframeData(coin, '3m')?.price
  const price15m = getTimeframeData(coin, '15m')?.price
  
  const volume3m = getTimeframeData(coin, '3m')?.volume
  const volume5m = getTimeframeData(coin, '5m')?.volume
  const volume15m = getTimeframeData(coin, '15m')?.volume
  
  // Require all historical data
  if (!price1m || !price3m || !price15m || !volume3m || !volume5m || !volume15m) {
    return false
  }
  
  const priceRatio1m = coin.lastPrice / price1m
  const priceRatio3m = coin.lastPrice / price3m
  const priceRatio15m = coin.lastPrice / price15m
  
  // Volume increasing
  const volumeIncreasing =
    coin.quoteVolume > volume5m &&
    volume5m > volume3m &&
    2 * volume3m > volume15m
  
  return (
    priceRatio15m < 0.994 && // Declining from 15m
    priceRatio3m < 0.995 && // Declining from 3m
    priceRatio1m > 1.004 && // But reversing in last 1m
    volumeIncreasing
  )
}

/**
 * TOP HUNTER ALARM
 * Condition: Price rising but losing momentum
 * Original: price/15m > 1.006 && price/3m > 1.005 && price/1m slowing
 */
function evaluateTopHunter(coin: Coin): boolean {
  const price1m = getTimeframeData(coin, '1m')?.price
  const price3m = getTimeframeData(coin, '3m')?.price
  const price15m = getTimeframeData(coin, '15m')?.price
  
  const volume3m = getTimeframeData(coin, '3m')?.volume
  const volume5m = getTimeframeData(coin, '5m')?.volume
  const volume15m = getTimeframeData(coin, '15m')?.volume
  
  // Require all historical data
  if (!price1m || !price3m || !price15m || !volume3m || !volume5m || !volume15m) {
    return false
  }
  
  const priceRatio1m = coin.lastPrice / price1m
  const priceRatio3m = coin.lastPrice / price3m
  const priceRatio15m = coin.lastPrice / price15m
  
  // Volume increasing
  const volumeIncreasing =
    coin.quoteVolume > volume5m &&
    volume5m > volume3m &&
    2 * volume3m > volume15m
  
  return (
    priceRatio15m > 1.006 && // Rising from 15m
    priceRatio3m > 1.005 && // Rising from 3m
    priceRatio1m > 0.996 && // But slowing in last 1m (> 2-1.004)
    volumeIncreasing
  )
}

// ============================================================================
// STANDARD ALERT EVALUATORS
// ============================================================================

function evaluatePricePump(
  coin: Coin,
  threshold: number,
  timeframe?: Timeframe
): boolean {
  if (!timeframe) return false
  
  const pastPrice = getTimeframeData(coin, timeframe)?.price
  if (!pastPrice) return false
  
  const changePercent = ((coin.lastPrice - pastPrice) / pastPrice) * 100
  return changePercent >= threshold
}

function evaluatePriceDump(
  coin: Coin,
  threshold: number,
  timeframe?: Timeframe
): boolean {
  if (!timeframe) return false
  
  const pastPrice = getTimeframeData(coin, timeframe)?.price
  if (!pastPrice) return false
  
  const changePercent = ((coin.lastPrice - pastPrice) / pastPrice) * 100
  return changePercent <= -threshold
}

function evaluateVolumeSpike(
  coin: Coin,
  threshold: number,
  timeframe?: Timeframe
): boolean {
  if (!timeframe) return false
  
  const pastVolume = getTimeframeData(coin, timeframe)?.volume
  if (!pastVolume) return false
  
  const changePercent = ((coin.quoteVolume - pastVolume) / pastVolume) * 100
  return changePercent >= threshold
}

function evaluateVolumeDrop(
  coin: Coin,
  threshold: number,
  timeframe?: Timeframe
): boolean {
  if (!timeframe) return false
  
  const pastVolume = getTimeframeData(coin, timeframe)?.volume
  if (!pastVolume) return false
  
  const changePercent = ((coin.quoteVolume - pastVolume) / pastVolume) * 100
  return changePercent <= -threshold
}

function evaluateVCPSignal(coin: Coin, threshold: number): boolean {
  return coin.indicators.vcp >= threshold
}

function evaluateFibonacciBreak(coin: Coin, threshold: number): boolean {
  // Check if price crossed a significant Fibonacci level
  const { resistance1, resistance0618, resistance0382, support0382, support0618, support1, pivot } = coin.indicators.fibonacci
  
  // Check if price is near any Fibonacci level (within threshold %)
  const levels = [resistance1, resistance0618, resistance0382, support0382, support0618, support1, pivot]
  return levels.some((level) => {
    const distance = Math.abs((coin.lastPrice - level) / level) * 100
    return distance <= threshold
  })
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateAlertTitle(coin: Coin, rule: AlertRule): string {
  return `${rule.name}: ${coin.symbol}`
}

function generateAlertMessage(coin: Coin, rule: AlertRule): string {
  const condition = rule.conditions[0]
  if (!condition) return `Alert triggered for ${coin.symbol}`
  
  switch (condition.type) {
    case 'price_pump':
      return `${coin.symbol} price increased by ${condition.threshold}% in ${condition.timeframe}`
    
    case 'price_dump':
      return `${coin.symbol} price decreased by ${condition.threshold}% in ${condition.timeframe}`
    
    case 'volume_spike':
      return `${coin.symbol} volume spiked by ${condition.threshold}% in ${condition.timeframe}`
    
    case 'pioneer_bull':
      return `${coin.symbol} showing strong bullish momentum with accelerating growth`
    
    case 'pioneer_bear':
      return `${coin.symbol} showing strong bearish momentum with accelerating decline`
    
    case '5m_big_bull':
      return `${coin.symbol} 5-minute volume spike with significant price increase`
    
    case '5m_big_bear':
      return `${coin.symbol} 5-minute volume spike with significant price decrease`
    
    case '15m_big_bull':
      return `${coin.symbol} 15-minute volume spike with significant price increase`
    
    case '15m_big_bear':
      return `${coin.symbol} 15-minute volume spike with significant price decrease`
    
    case 'bottom_hunter':
      return `${coin.symbol} potential bottom reversal detected`
    
    case 'top_hunter':
      return `${coin.symbol} potential top reversal detected`
    
    default:
      return `Alert triggered for ${coin.symbol}`
  }
}

/**
 * Create default alert rules from legacy presets
 */
export function createDefaultAlertRules(): AlertRule[] {
  return LEGACY_ALERT_PRESETS.map((preset) => ({
    id: `legacy-${preset.type}`,
    name: preset.name,
    enabled: false, // Disabled by default - user can enable
    symbols: [], // Empty = applies to all symbols
    conditions: [
      {
        type: preset.type,
        threshold: 0, // Legacy alerts don't use simple thresholds
        comparison: 'greater_than' as const,
      },
    ],
    severity: preset.severity,
    notificationEnabled: true,
    soundEnabled: true,
    createdAt: Date.now(),
  }))
}
