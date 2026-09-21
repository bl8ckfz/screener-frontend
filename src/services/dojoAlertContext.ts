/**
 * Reading the Dojo context off a backend alert.
 *
 * WHY THIS IS SHARED
 *
 * Live alerts arrive over the WebSocket and historical ones over
 * GET /api/alerts, and each path had its own hand-written transform. Both
 * declared `metadata` on their input type and neither read it, so the two
 * agreed by accident rather than by construction. One of them gaining a field
 * and the other not would mean an alert that navigates when it is live and
 * stops navigating after a refresh — a bug nobody would look for.
 *
 * So there is one reader, and both call it.
 *
 * WHY IT IS AN ALLOWLIST
 *
 * The backend scrubs its alert metadata on purpose: the published levels
 * travel, the fibonacci ratios and the swing they were measured from do not,
 * because entry and stop alone reconstruct the leg for anyone holding the two
 * plan constants. Copying the whole map across would make that contract one
 * forgotten backend field away from breaking, in the direction that leaks.
 *
 * Every field below is named deliberately. Adding one is a decision.
 */

import type { DojoAlertContext } from '@/types/alert'

/** The shape the backend actually sends. Mirrors internal/alerts.Alert. */
export interface BackendAlertMetadata {
  [key: string]: unknown
}

/** Rule types that belong to the Dojo family. */
const DOJO_RULE_PREFIX = 'futures_dojo_'

/**
 * A number, or undefined.
 *
 * Every numeric in the backend's metadata round-trips through JSON, so they
 * all arrive as numbers — but a missing key and a malformed one must both read
 * as "not provided" rather than as 0, which would render as a real price.
 */
function num(md: BackendAlertMetadata, key: string): number | undefined {
  const v = md[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function str(md: BackendAlertMetadata, key: string): string | undefined {
  const v = md[key]
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

/** Whether a rule type is one of the Dojo family. */
export function isDojoRuleType(ruleType: string): boolean {
  return ruleType.startsWith(DOJO_RULE_PREFIX)
}

/**
 * Extracts the plan context from a backend alert's metadata.
 *
 * Returns undefined when there is no setup to point at. That is the important
 * case: without a setup id there is nothing to open, and the caller must fall
 * back to the plain coin chart rather than guessing a plan from the symbol.
 * A symbol routinely carries two zones — a long and a short on different
 * timeframes — so guessing shows the wrong levels rather than none.
 */
export function readDojoAlertContext(
  ruleType: string,
  metadata: BackendAlertMetadata | null | undefined
): DojoAlertContext | undefined {
  if (!metadata || !isDojoRuleType(ruleType)) return undefined

  const setupId = str(metadata, 'setup_id')
  if (!setupId) return undefined

  const direction = str(metadata, 'direction')
  const event = str(metadata, 'event')

  return {
    setupId,
    event: event as DojoAlertContext['event'],
    direction: direction === 'long' || direction === 'short' ? direction : undefined,
    timeframe: str(metadata, 'timeframe'),
    otzLow: num(metadata, 'otz_low'),
    otzHigh: num(metadata, 'otz_high'),
    entry: num(metadata, 'entry'),
    stopLoss: num(metadata, 'stop_loss'),
    tp1: num(metadata, 'tp1'),
    invalidationReason: str(metadata, 'invalidation_reason'),
  }
}
