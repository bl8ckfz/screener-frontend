import { describe, it, expect } from 'vitest'
import {
  PLAN_PRICES,
  planPrice,
  planPeriod,
  planPriceWithPeriod,
  yearlySaving,
  type PlanSlug,
} from '@/config/plans'

describe('plan pricing', () => {
  // The bug this file exists to prevent: the TradingView add-on was shown at
  // $59/mo and $599/yr on ExpiredPage and $19.99/mo and $219.99/yr on
  // BillingPage, while both buttons opened the same Whop plan — so one page
  // quoted a price the customer would never be charged.
  it('prices the TradingView add-on at the figures Whop charges', () => {
    expect(planPrice('tv_monthly')).toBe('$19.99')
    expect(planPrice('tv_yearly')).toBe('$219.99')
  })

  it('pins the other plans too, so a silent edit shows up here', () => {
    expect(planPrice('screener_monthly')).toBe('$39.99')
    expect(planPrice('screener_yearly')).toBe('$439.99')
    expect(planPrice('bundle_monthly')).toBe('$54.99')
    expect(planPrice('bundle_yearly')).toBe('$604.99')
  })

  // The saving is derived, not written down. A hardcoded one is a third number
  // that can drift from the two it describes — and it did: the TradingView
  // yearly button read "Save $109", which was only ever consistent with the
  // wrong $59/$599 pair.
  it('derives every yearly saving from the prices themselves', () => {
    expect(yearlySaving('tv_monthly', 'tv_yearly')).toBe('$19.89')
    expect(yearlySaving('screener_monthly', 'screener_yearly')).toBe('$39.89')
    expect(yearlySaving('bundle_monthly', 'bundle_yearly')).toBe('$54.89')
  })

  it('never quotes a yearly plan that costs more than paying monthly', () => {
    const pairs: Array<[PlanSlug, PlanSlug]> = [
      ['screener_monthly', 'screener_yearly'],
      ['tv_monthly', 'tv_yearly'],
      ['bundle_monthly', 'bundle_yearly'],
    ]
    for (const [m, y] of pairs) {
      const saved = PLAN_PRICES[m].amount * 12 - PLAN_PRICES[y].amount
      expect(saved, `${y} should be cheaper than 12x ${m}`).toBeGreaterThan(0)
    }
  })

  it('labels each plan with the right period', () => {
    expect(planPeriod('tv_monthly')).toBe('/mo')
    expect(planPeriod('tv_yearly')).toBe('/yr')
    expect(planPriceWithPeriod('tv_monthly')).toBe('$19.99/mo')
    expect(planPriceWithPeriod('tv_yearly')).toBe('$219.99/yr')
  })

  // The slugs are the contract with the backend's planIDForSlug; a typo here
  // surfaces as "unsupported plan" only once a user clicks buy.
  it('covers exactly the slugs the backend maps to Whop plan IDs', () => {
    expect(Object.keys(PLAN_PRICES).sort()).toEqual([
      'bundle_monthly', 'bundle_yearly',
      'screener_monthly', 'screener_yearly',
      'tv_monthly', 'tv_yearly',
    ])
  })
})
