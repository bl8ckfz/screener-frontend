import { describe, it, expect, vi } from 'vitest'
import { dojoChips } from '@/components/alerts/dojoPlanBadges'
import type { DojoSetup, DojoOutcome } from '@/types/dojo'
import type { AlertHistoryEntry } from '@/types/alertHistory'

/**
 * The badges that keep a plan visible in the alert table.
 *
 * The problem they solve: the badges beside them are alert TYPES, read over 48
 * hours from a table kept for seven days, and capped so a busy coin shows only
 * the first few. A Dojo plan outlives the window and loses the race for the
 * cap, so a coin with a live weekly zone could show no sign of it at all —
 * either because the armed alert had aged out, or because four momentum alerts
 * had pushed it off the end.
 *
 * These come from dojo_setups, which has no retention, and they are rendered
 * outside the cap. So the rule they have to keep is simple: present for
 * exactly as long as the plan is in play, and never silently dropped.
 */

function setup(over: Partial<DojoSetup> = {}): DojoSetup {
  return {
    id: 'setup-1',
    leg_id: 'leg-1',
    fired_at: '2026-09-01T00:02:00Z',
    symbol: 'ZETAUSDT',
    timeframe: '1w',
    direction: 'short',
    rule_type: 'futures_dojo_otz_short_1w',
    trigger_price: 0.5,
    otz_low: 0.5,
    otz_high: 0.56,
    entry: 0.52,
    stop_loss: 0.58,
    tp1: 0.4,
    tp2: 0.35,
    tp3: 0.3,
    rr: 2.4,
    confluence_band: 'HIGH',
    backings: [],
    outcome: 'unfilled' as DojoOutcome,
    ...over,
  } as DojoSetup
}

function endedAlert(
  setupId: string,
  event: NonNullable<AlertHistoryEntry['dojo']>['event'],
  timestamp = Date.parse('2026-09-20T12:00:00Z')
): AlertHistoryEntry {
  return {
    id: `alert-${setupId}`,
    symbol: 'ZETA',
    alertType: 'futures_dojo_stopped_short',
    timestamp,
    priceAtTrigger: 0.58,
    changePercent: 0,
    dojo: { setupId, event, timeframe: '1w', direction: 'short' },
  }
}

describe('dojoChips', () => {
  it('renders nothing when the coin has neither a plan nor a recent ending', () => {
    expect(dojoChips(undefined, undefined)).toEqual([])
    expect(dojoChips([], [])).toEqual([])
  })

  // The labels are words, not a code. This line sits beside round badges whose
  // meaning has to be memorised; the plan should be readable without that.
  it('describes a plan in words, with the timeframe and side', () => {
    const [waiting] = dojoChips([setup({ outcome: 'unfilled' })], [])
    expect(waiting.label).toBe('Waiting')
    expect(waiting.mark).toBe('🥋')
    expect(waiting.detail).toBe('1W Short')

    const [running] = dojoChips([setup({ outcome: 'open' })], [])
    expect(running.label).toBe('In trade')
  })

  // The single most useful thing the row can say at a glance is whether money
  // is at risk right now, so a running trade is emphasised over a waiting one.
  it('emphasises a running trade over a waiting one', () => {
    const [waiting] = dojoChips([setup({ outcome: 'unfilled' })], [])
    const [running] = dojoChips([setup({ outcome: 'open' })], [])
    expect(waiting.emphasised).toBeFalsy()
    expect(running.emphasised).toBe(true)
  })

  it('explains the state in the title, including that a waiting plan risks nothing', () => {
    const [waiting] = dojoChips([setup({ outcome: 'unfilled' })], [])
    expect(waiting.title).toMatch(/waiting for price/i)
    expect(waiting.title).toMatch(/nothing risked/i)
  })

  // A coin can carry a long and a short on different timeframes. Each is a
  // separate thesis with separate levels, so each gets its own chip.
  it('shows one chip per plan', () => {
    const chips = dojoChips(
      [
        setup({ id: 'a', timeframe: '1w', direction: 'short' }),
        setup({ id: 'b', timeframe: '1d', direction: 'long' }),
      ],
      []
    )
    expect(chips.map((c) => c.detail)).toEqual(['1W Short', '1D Long'])
  })

  // A plan that ended is no longer live, so it cannot come from the setups —
  // but "this coin's plan just got stopped" is worth seeing while it is recent.
  it('shows a recently ended plan that the live list cannot carry', () => {
    const chips = dojoChips([], [endedAlert('setup-ended', 'stop_hit')])

    expect(chips).toHaveLength(1)
    expect(chips[0].label).toBe('Stop taken')
    expect(chips[0].key).toBe('setup-ended')
  })

  // A plan in play is described by its STATE. An alert about it is a record of
  // one past moment, and showing both would say the same plan twice.
  it('prefers the live state over an alert about the same plan', () => {
    const chips = dojoChips(
      [setup({ id: 'setup-1', outcome: 'open' })],
      [endedAlert('setup-1', 'entry_filled')]
    )

    expect(chips).toHaveLength(1)
    expect(chips[0].label).toBe('In trade')
  })

  it('names the reason a zone was retired', () => {
    const alert = endedAlert('setup-x', 'zone_invalidated')
    alert.dojo!.invalidationReason = 'fvg_mitigated'

    const [chip] = dojoChips([], [alert])
    expect(chip.label).toBe('Invalidated')
    expect(chip.title).toMatch(/fvg mitigated/i)
  })

  // Counted, not dropped. The whole point of this line is that a plan does not
  // silently vanish from the row.
  it('counts the overflow rather than hiding it', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => setup({ id }))
    const chips = dojoChips(many, [])

    const last = chips[chips.length - 1]
    expect(last.label).toBe('+1 more')
    expect(last.title).toMatch(/1 more/i)
    // Not clickable: it stands for several plans and there is no single one to
    // open.
    expect(last.onClick).toBeUndefined()
  })

  it('opens the plan it stands for', () => {
    const onOpen = vi.fn()
    const [chip] = dojoChips([setup({ id: 'setup-9' })], [], onOpen)

    chip.onClick?.()
    expect(onOpen).toHaveBeenCalledWith('setup-9')
  })

  it('marks the plan currently open on the chart', () => {
    const chips = dojoChips(
      [setup({ id: 'a' }), setup({ id: 'b' })],
      [],
      undefined,
      'b'
    )
    expect(chips.find((c) => c.key === 'a')?.active).toBe(false)
    expect(chips.find((c) => c.key === 'b')?.active).toBe(true)
  })

  it('stays inert when nothing can be opened', () => {
    const [chip] = dojoChips([setup()], [])
    expect(chip.onClick).toBeUndefined()
  })
})
