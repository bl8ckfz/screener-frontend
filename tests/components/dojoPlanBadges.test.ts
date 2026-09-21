import { describe, it, expect, vi } from 'vitest'
import { dojoPlanBadges } from '@/components/alerts/dojoPlanBadges'
import type { DojoSetup, DojoOutcome } from '@/types/dojo'

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

describe('dojoPlanBadges', () => {
  it('renders nothing when the coin has no plan in play', () => {
    expect(dojoPlanBadges(undefined)).toEqual([])
    expect(dojoPlanBadges([])).toEqual([])
  })

  it('shows the timeframe, which is what distinguishes one plan from another', () => {
    const badges = dojoPlanBadges([setup({ timeframe: '1w' })])
    expect(badges).toHaveLength(1)
    expect(badges[0].text).toBe('1W')
  })

  it('colours by direction', () => {
    const [long] = dojoPlanBadges([setup({ direction: 'long' })])
    const [short] = dojoPlanBadges([setup({ direction: 'short' })])
    expect(long.color).not.toBe(short.color)
  })

  // The single most useful thing the row can say at a glance is whether money
  // is at risk right now, so a running trade is emphasised over a waiting one.
  it('emphasises a running trade over a waiting one', () => {
    const [waiting] = dojoPlanBadges([setup({ outcome: 'unfilled' })])
    const [running] = dojoPlanBadges([setup({ outcome: 'open' })])
    expect(waiting.emphasised).toBeFalsy()
    expect(running.emphasised).toBe(true)
  })

  it('explains the state in the title, including that a waiting plan risks nothing', () => {
    const [waiting] = dojoPlanBadges([setup({ outcome: 'unfilled' })])
    expect(waiting.title).toMatch(/waiting/i)
    expect(waiting.title).toMatch(/nothing risked/i)

    const [running] = dojoPlanBadges([setup({ outcome: 'open' })])
    expect(running.title).toMatch(/in the trade/i)
  })

  // A coin can carry a long and a short on different timeframes. Each is a
  // separate thesis with separate levels, so each gets its own badge.
  it('shows one badge per plan', () => {
    const badges = dojoPlanBadges([
      setup({ id: 'a', timeframe: '1w', direction: 'short' }),
      setup({ id: 'b', timeframe: '1d', direction: 'long' }),
    ])
    expect(badges.map((b) => b.text)).toEqual(['1W', '1D'])
    expect(badges.map((b) => b.key)).toEqual(['a', 'b'])
  })

  // Counted, not dropped. The whole point of these badges is that a plan does
  // not silently vanish from the row.
  it('counts the overflow rather than hiding it', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => setup({ id }))
    const badges = dojoPlanBadges(many)

    const last = badges[badges.length - 1]
    expect(last.text).toBe('+2')
    expect(last.title).toMatch(/2 more/i)
    // The overflow marker is not clickable: it stands for several plans and
    // there is no single one to open.
    expect(last.onClick).toBeUndefined()
  })

  it('opens the plan it stands for', () => {
    const onOpen = vi.fn()
    const [badge] = dojoPlanBadges([setup({ id: 'setup-9' })], onOpen)

    badge.onClick?.()
    expect(onOpen).toHaveBeenCalledWith('setup-9')
  })

  it('stays inert when nothing can be opened', () => {
    const [badge] = dojoPlanBadges([setup()])
    expect(badge.onClick).toBeUndefined()
  })
})
