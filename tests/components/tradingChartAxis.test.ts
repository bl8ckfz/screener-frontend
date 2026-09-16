import { describe, it, expect } from 'vitest'
import { isIntradaySeries } from '@/components/coin/TradingChart'
import type { Candlestick } from '@/services/chartData'

/**
 * The time axis renders HH:MM for intraday series and dates for daily ones.
 * Getting this backwards on a daily chart labels every bar 00:00 — which is
 * what it used to do, and why a zone described as "published 11 September"
 * could not be found on the chart meant to show it.
 */
const series = (stepSeconds: number, n = 10): Candlestick[] =>
  Array.from({ length: n }, (_, i) => ({
    time: 1_757_548_800 + i * stepSeconds,
    open: 1, high: 2, low: 0.5, close: 1.5,
    volume: 0, quoteVolume: 0, trades: 0,
  }))

describe('isIntradaySeries', () => {
  it('treats minute and hour bars as intraday', () => {
    expect(isIntradaySeries(series(60))).toBe(true)
    expect(isIntradaySeries(series(15 * 60))).toBe(true)
    expect(isIntradaySeries(series(60 * 60))).toBe(true)
    expect(isIntradaySeries(series(4 * 60 * 60))).toBe(true)
  })

  it('treats daily and higher bars as not intraday', () => {
    expect(isIntradaySeries(series(24 * 60 * 60))).toBe(false)
    expect(isIntradaySeries(series(7 * 24 * 60 * 60))).toBe(false)
  })

  it('survives a DST shift, where a daily bar is 23 or 25 hours', () => {
    // The threshold is 23h rather than 24h for exactly this case. A naive
    // `gap >= 24h` test flips the whole axis to times twice a year.
    const daily = series(24 * 60 * 60, 8)
    daily[4].time -= 60 * 60
    expect(isIntradaySeries(daily)).toBe(false)
  })

  it('is not fooled by a single listing gap in an intraday series', () => {
    // Median, not max: one long gap in an otherwise 15m series must not read
    // as daily.
    const intraday = series(15 * 60, 12)
    for (let i = 8; i < intraday.length; i++) intraday[i].time += 3 * 24 * 60 * 60
    expect(isIntradaySeries(intraday)).toBe(true)
  })

  it('assumes intraday when there is not enough data to tell', () => {
    expect(isIntradaySeries([])).toBe(true)
    expect(isIntradaySeries(series(60, 2))).toBe(true)
  })
})

// ── Which bar a live price belongs to ──────────────────────────────────────

import { medianBarSeconds } from '@/components/coin/TradingChart'

/**
 * A stored series does not reach the present: candles_1d holds CLOSED days, so
 * its newest bar is yesterday's, and candles_1m is a minute behind for the same
 * reason. The live price therefore often belongs to a bar that does not exist
 * yet — and folding it into the last stored one rewrites a settled candle,
 * which is how a daily close silently moved by a third on COMPUSDT.
 *
 * Picking the right bar depends entirely on knowing the bar length.
 */
describe('medianBarSeconds', () => {
  const series = (stepSeconds: number, n = 10): Candlestick[] =>
    Array.from({ length: n }, (_, i) => ({
      time: 1_789_557_480 + i * stepSeconds,
      open: 1, high: 2, low: 0.5, close: 1.5,
      volume: 0, quoteVolume: 0, trades: 0,
    }))

  it('reads the spacing of common intervals', () => {
    expect(medianBarSeconds(series(60))).toBe(60)
    expect(medianBarSeconds(series(300))).toBe(300)
    expect(medianBarSeconds(series(86400))).toBe(86400)
  })

  it('is not fooled by a single missing bar', () => {
    // Median, not the last gap: one hole would otherwise double the answer and
    // put the live price in a bucket that does not exist.
    const daily = series(86400, 10)
    for (let i = 5; i < daily.length; i++) daily[i].time += 86400
    expect(medianBarSeconds(daily)).toBe(86400)
  })

  it('falls back to a minute when the series is too short to tell', () => {
    expect(medianBarSeconds([])).toBe(60)
    expect(medianBarSeconds(series(300, 1))).toBe(60)
  })
})
