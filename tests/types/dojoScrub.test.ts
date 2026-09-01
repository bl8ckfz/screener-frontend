import { describe, it, expect } from 'vitest'
import { FUTURES_ALERT_PRESETS, FUTURES_ALERT_LABELS } from '@/types/alert'

/**
 * The published Dojo copy must not name the method.
 *
 * The levels are the product; the ratios that generate them are not. They are
 * not independent either — the plan is built as
 *
 *   stop  = legOrigin × (1 ∓ buffer)
 *   entry = legOrigin + entryFib × legRange
 *
 * so a reader holding entry, stop and the two constants recovers the leg
 * exactly, and the leg yields the whole ladder. Removing the leg from the
 * payload only helps while the constants stay out of the prose, which is what
 * this asserts.
 *
 * The backend has the same test over the alert metadata and the chat
 * renderers (internal/dojo/emitter_test.go, pkg/webhook/dojo_format_test.go).
 * This one covers the copy the app itself ships.
 */
const FIB = /\bfib|0\.\d{2,3}/i

describe('published Dojo copy', () => {
  const dojoPresets = FUTURES_ALERT_PRESETS.filter((p) => p.type.startsWith('futures_dojo_'))

  it('covers every Dojo rule, so none can drift unchecked', () => {
    expect(dojoPresets.length).toBe(10)
  })

  it('names no fibonacci ratio in any description', () => {
    for (const preset of dojoPresets) {
      expect(preset.description, `${preset.type} description`).not.toMatch(FIB)
    }
  })

  it('names no fibonacci ratio in any name or label', () => {
    for (const preset of dojoPresets) {
      expect(preset.name, `${preset.type} name`).not.toMatch(FIB)
      expect(FUTURES_ALERT_LABELS[preset.type] ?? '', `${preset.type} label`).not.toMatch(FIB)
    }
  })

  it('still explains what the alert is', () => {
    // The scrub must not have hollowed the copy out: a subscriber choosing
    // which alerts to enable needs to know what each one means.
    for (const preset of dojoPresets) {
      expect(preset.description.length, `${preset.type}`).toBeGreaterThan(80)
    }
  })
})
