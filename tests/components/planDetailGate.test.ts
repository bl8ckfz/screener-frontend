import { describe, it, expect } from 'vitest'
import { columnsFor } from '@/components/dojo/DojoSetupsTable'
import { hasPlanDetailAccess } from '@/services/authService'
import type { User } from '@/services/authService'

/**
 * Who sees how a zone was built.
 *
 * The backend is what actually withholds the fields (planDetailAccess in
 * cmd/api-gateway/handlers_dojo.go). These tests cover the UI's half: asking
 * the same question, so the table does not render a column of dashes for data
 * the server declined to send.
 */

function user(over: Partial<User>): User {
  return { id: '1', email: 'a@b.c', role: 'user', status: 'active', ...over } as User
}

describe('hasPlanDetailAccess', () => {
  it('admits admins', () => {
    expect(hasPlanDetailAccess(user({ role: 'admin' }))).toBe(true)
  })

  it('admits pro on a live plan', () => {
    expect(hasPlanDetailAccess(user({ role: 'pro', status: 'active' }))).toBe(true)
  })

  // Cancelling stops the renewal. It does not refund the month already paid
  // for, so access runs to the end of it.
  it('admits pro whose cancelled period has not ended', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    expect(hasPlanDetailAccess(user({ role: 'pro', status: 'canceled', plan_expires_at: future }))).toBe(true)
  })

  it('refuses pro once the cancelled period has ended', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString()
    expect(hasPlanDetailAccess(user({ role: 'pro', status: 'canceled', plan_expires_at: past }))).toBe(false)
  })

  // The decision this gate encodes: a trial evaluates the product, it does not
  // grant what is sold on top of it.
  it('refuses a trial, whatever the role says', () => {
    expect(hasPlanDetailAccess(user({ role: 'pro', status: 'trial' }))).toBe(false)
    expect(hasPlanDetailAccess(user({ role: 'user', status: 'trial' }))).toBe(false)
  })

  it('refuses an ordinary paying subscriber', () => {
    expect(hasPlanDetailAccess(user({ role: 'user', status: 'active' }))).toBe(false)
  })

  it('refuses nobody at all rather than defaulting open', () => {
    expect(hasPlanDetailAccess(null)).toBe(false)
  })
})

describe('columnsFor', () => {
  const fields = (hasDetail: boolean) => columnsFor(hasDetail).map((c) => c.field)

  it('drops Vol without plan detail', () => {
    expect(fields(false)).not.toContain('volume')
  })

  it('keeps Vol with it', () => {
    expect(fields(true)).toContain('volume')
  })

  // The explicit product decision: the band is everyone's. It says how
  // strongly the scanner rated the zone, not what it rated it on.
  it('keeps Conf either way', () => {
    expect(fields(false)).toContain('confluence')
    expect(fields(true)).toContain('confluence')
  })

  // Everything else in the row is the plan, which the subscription buys.
  it('drops nothing else', () => {
    const withDetail = fields(true)
    const without = fields(false)
    expect(without).toEqual(withDetail.filter((f) => f !== 'volume'))
  })
})
