/**
 * Alert Engine - Core alert evaluation logic
 * Evaluates alert rules against coin data using futures-based metrics
 */

import type { Coin } from '@/types/coin'
import type {
  Alert,
  AlertRule,
  AlertCondition,
} from '@/types/alert'
import type { FuturesMetrics } from '@/types/api'

/**
 * Evaluate all alert rules against all coins
 * Returns array of triggered alerts
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
  const momentumAlerts = [
    'futures_big_bull_60',
    'futures_big_bear_60',
    'futures_pioneer_bull',
    'futures_pioneer_bear',
    'futures_5_big_bull',
    'futures_5_big_bear',
    'futures_15_big_bull',
    'futures_15_big_bear',
    'futures_bottom_hunter',
    'futures_top_hunter'
  ]
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
  const { type } = condition

  // Use futures metrics directly from coin
  const metrics = coin.futuresMetrics
  if (!metrics) {
    // Skip evaluation if metrics not available
    return false
  }

  switch (type) {
    // Futures alert types
    case 'futures_big_bull_60':
      return marketMode === 'bull' && evaluateFuturesBigBull60(metrics)
    
    case 'futures_big_bear_60':
      return marketMode === 'bear' && evaluateFuturesBigBear60(metrics)
    
    case 'futures_pioneer_bull':
      return marketMode === 'bull' && evaluateFuturesPioneerBull(metrics)
    
    case 'futures_pioneer_bear':
      return marketMode === 'bear' && evaluateFuturesPioneerBear(metrics)
    
    case 'futures_5_big_bull':
      return marketMode === 'bull' && evaluateFutures5BigBull(metrics)
    
    case 'futures_5_big_bear':
      return marketMode === 'bear' && evaluateFutures5BigBear(metrics)
    
    case 'futures_15_big_bull':
      return marketMode === 'bull' && evaluateFutures15BigBull(metrics)
    
    case 'futures_15_big_bear':
      return marketMode === 'bear' && evaluateFutures15BigBear(metrics)
    
    case 'futures_bottom_hunter':
      return evaluateFuturesBottomHunter(metrics)
    
    case 'futures_top_hunter':
      return evaluateFuturesTopHunter(metrics)
    
    default:
      return false
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate alert title based on rule
 */
function generateAlertTitle(coin: Coin, rule: AlertRule): string {
  return `${rule.name}: ${coin.symbol}`
}

/**
 * Generate alert message based on alert type
 */
function generateAlertMessage(coin: Coin, rule: AlertRule): string {
  const condition = rule.conditions[0]
  if (!condition) return `Alert triggered for ${coin.symbol}`
  
  switch (condition.type) {
    case 'futures_big_bull_60':
      return `${coin.symbol} showing sustained bullish momentum across multiple timeframes`
    
    case 'futures_big_bear_60':
      return `${coin.symbol} showing sustained bearish momentum across multiple timeframes`
    
    case 'futures_pioneer_bull':
      return `${coin.symbol} showing strong bullish momentum with accelerating growth`
    
    case 'futures_pioneer_bear':
      return `${coin.symbol} showing strong bearish momentum with accelerating decline`
    
    case 'futures_5_big_bull':
      return `${coin.symbol} 5-minute volume spike with significant price increase`
    
    case 'futures_5_big_bear':
      return `${coin.symbol} 5-minute volume spike with significant price decrease`
    
    case 'futures_15_big_bull':
      return `${coin.symbol} 15-minute volume spike with significant price increase`
    
    case 'futures_15_big_bear':
      return `${coin.symbol} 15-minute volume spike with significant price decrease`
    
    case 'futures_bottom_hunter':
      return `${coin.symbol} potential bottom reversal detected`
    
    case 'futures_top_hunter':
      return `${coin.symbol} potential top reversal detected`
    
    default:
      return `Alert triggered for ${coin.symbol}`
  }
}

// ============================================================================
// FUTURES ALERT EVALUATORS
// ============================================================================

/**
 * Evaluate 60 Big Bull alert
 * Detects coins with sustained momentum over multiple timeframes
 */
export function evaluateFuturesBigBull60(metrics: FuturesMetrics): boolean {
  return (
    metrics.change_1h > 1.6 &&
    metrics.change_1d < 15 &&
    metrics.change_8h > metrics.change_1h &&
    metrics.change_1d > metrics.change_8h &&
    metrics.volume_1h > 500_000 &&
    metrics.volume_8h > 5_000_000 &&
    6 * metrics.volume_1h > metrics.volume_8h &&
    16 * metrics.volume_1h > metrics.volume_1d
  )
}

/**
 * Evaluate 60 Big Bear alert
 * Detects coins with sustained downward momentum over multiple timeframes
 */
export function evaluateFuturesBigBear60(metrics: FuturesMetrics): boolean {
  return (
    metrics.change_1h < -1.6 &&
    metrics.change_1d > -15 &&
    metrics.change_8h < metrics.change_1h &&
    metrics.change_1d < metrics.change_8h &&
    metrics.volume_1h > 500_000 &&
    metrics.volume_8h > 5_000_000 &&
    6 * metrics.volume_1h > metrics.volume_8h &&
    16 * metrics.volume_1h > metrics.volume_1d
  )
}

/**
 * Evaluate Pioneer Bull alert
 * Early detection of emerging trends with accelerating momentum
 */
export function evaluateFuturesPioneerBull(metrics: FuturesMetrics): boolean {
  return (
    metrics.change_5m > 1 &&
    metrics.change_15m > 1 &&
    3 * metrics.change_5m > metrics.change_15m &&
    2 * metrics.volume_5m > metrics.volume_15m
  )
}

/**
 * Evaluate Pioneer Bear alert
 * Early detection of emerging downtrends with accelerating downward momentum
 */
export function evaluateFuturesPioneerBear(metrics: FuturesMetrics): boolean {
  return (
    metrics.change_5m < -1 &&
    metrics.change_15m < -1 &&
    3 * metrics.change_5m < metrics.change_15m &&
    2 * metrics.volume_5m > metrics.volume_15m
  )
}

/**
 * Evaluate 5 Big Bull alert
 * Catches explosive moves with progressive momentum acceleration
 */
export function evaluateFutures5BigBull(metrics: FuturesMetrics): boolean {
  return (
    metrics.change_5m > 0.6 &&
    metrics.change_1d < 15 &&
    metrics.change_15m > metrics.change_5m &&
    metrics.change_1h > metrics.change_15m &&
    metrics.volume_5m > 100_000 &&
    metrics.volume_1h > 1_000_000 &&
    metrics.volume_5m > metrics.volume_15m / 3 &&
    metrics.volume_5m > metrics.volume_1h / 6 &&
    metrics.volume_5m > metrics.volume_8h / 66
  )
}

/**
 * Evaluate 5 Big Bear alert
 * Catches explosive downward moves with progressive momentum acceleration
 */
export function evaluateFutures5BigBear(metrics: FuturesMetrics): boolean {
  return (
    metrics.change_5m < -0.6 &&
    metrics.change_1d > -15 &&
    metrics.change_15m < metrics.change_5m &&
    metrics.change_1h < metrics.change_15m &&
    metrics.volume_5m > 100_000 &&
    metrics.volume_1h > 1_000_000 &&
    metrics.volume_5m > metrics.volume_15m / 3 &&
    metrics.volume_5m > metrics.volume_1h / 6 &&
    metrics.volume_5m > metrics.volume_8h / 66
  )
}

/**
 * Evaluate 15 Big Bull alert
 * Identifies strong trending moves with progressive momentum acceleration
 */
export function evaluateFutures15BigBull(metrics: FuturesMetrics): boolean {
  return (
    metrics.change_15m > 1 &&
    metrics.change_1d < 15 &&
    metrics.change_1h > metrics.change_15m &&
    metrics.change_8h > metrics.change_1h &&
    metrics.volume_15m > 400_000 &&
    metrics.volume_1h > 1_000_000 &&
    metrics.volume_15m > metrics.volume_1h / 3 &&
    metrics.volume_15m > metrics.volume_8h / 26
  )
}

/**
 * Evaluate 15 Big Bear alert
 * Identifies strong downward trending moves with progressive momentum acceleration
 */
export function evaluateFutures15BigBear(metrics: FuturesMetrics): boolean {
  return (
    metrics.change_15m < -1 &&
    metrics.change_1d > -15 &&
    metrics.change_1h < metrics.change_15m &&
    metrics.change_8h < metrics.change_1h &&
    metrics.volume_15m > 400_000 &&
    metrics.volume_1h > 1_000_000 &&
    metrics.volume_15m > metrics.volume_1h / 3 &&
    metrics.volume_15m > metrics.volume_8h / 26
  )
}

/**
 * Evaluate Bottom Hunter alert
 * Detects reversal from bottom with volume confirmation
 */
export function evaluateFuturesBottomHunter(metrics: FuturesMetrics): boolean {
  return (
    metrics.change_1h < -0.7 &&
    metrics.change_15m < -0.6 &&
    metrics.change_5m > 0.5 &&
    metrics.volume_5m > metrics.volume_15m / 2 &&
    metrics.volume_5m > metrics.volume_1h / 8
  )
}

/**
 * Evaluate Top Hunter alert
 * Detects reversal from top with volume confirmation
 */
export function evaluateFuturesTopHunter(metrics: FuturesMetrics): boolean {
  return (
    metrics.change_1h > 0.7 &&
    metrics.change_15m > 0.6 &&
    metrics.change_5m < -0.5 &&
    metrics.volume_5m > metrics.volume_15m / 2 &&
    metrics.volume_5m > metrics.volume_1h / 8
  )
}

/**
 * Evaluate all futures alerts for given metrics
 * Returns array of triggered alert types
 */
export function evaluateAllFuturesAlerts(metrics: FuturesMetrics): string[] {
  const triggeredAlerts: string[] = []

  if (evaluateFuturesBigBull60(metrics)) triggeredAlerts.push('futures_big_bull_60')
  if (evaluateFuturesBigBear60(metrics)) triggeredAlerts.push('futures_big_bear_60')
  if (evaluateFuturesPioneerBull(metrics)) triggeredAlerts.push('futures_pioneer_bull')
  if (evaluateFuturesPioneerBear(metrics)) triggeredAlerts.push('futures_pioneer_bear')
  if (evaluateFutures5BigBull(metrics)) triggeredAlerts.push('futures_5_big_bull')
  if (evaluateFutures5BigBear(metrics)) triggeredAlerts.push('futures_5_big_bear')
  if (evaluateFutures15BigBull(metrics)) triggeredAlerts.push('futures_15_big_bull')
  if (evaluateFutures15BigBear(metrics)) triggeredAlerts.push('futures_15_big_bear')
  if (evaluateFuturesBottomHunter(metrics)) triggeredAlerts.push('futures_bottom_hunter')
  if (evaluateFuturesTopHunter(metrics)) triggeredAlerts.push('futures_top_hunter')

  return triggeredAlerts
}
