/**
 * Opening copy for the ad landing page, /start?a=scan|record|learn — one hero
 * per ad angle, so the first thing a visitor reads matches the ad they clicked.
 *
 * The ad rules apply here too, because review reads the landing page: no
 * returns, rates, "signals", or exchange names. tests/components/startPage
 * checks the wording.
 */

export type StartAngle = 'scan' | 'record' | 'learn'

export const START_HEROES: Record<StartAngle, { title: string; body: string }> = {
  scan: {
    title: '200+ crypto futures charts. One short list each morning.',
    body:
      'Every day, shortly after the daily close, the scanner checks every pair against one ' +
      'published method. The zones that qualify come with their plan — entry, stop and three ' +
      'targets — and their status as price arrives.',
  },
  record: {
    title: 'Every plan tracked to the end. Losses included.',
    body:
      'No VIP group, no API keys, no access to your account. Each zone the scanner publishes ' +
      'is followed until it reaches its target, hits its stop, or is retired before entry — ' +
      'and the record is public, so you can judge it before you pay.',
  },
  learn: {
    title: 'Market structure, zones and liquidity, drawn on real charts.',
    body:
      'One published method, applied the same way to 200+ futures pairs every day. See where ' +
      'each zone formed, the plan that came with it, and how it played out. You make every ' +
      'decision.',
  },
}

/** The angle named in the URL; anything missing or unknown is the scan angle. */
export function startAngle(value: string | null): StartAngle {
  return value === 'record' || value === 'learn' ? value : 'scan'
}

export const START_STEPS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'The scan runs daily',
    body: 'Shortly after 00:02 UTC, 200+ futures pairs are checked against the method. Some days several zones qualify, some days none.',
  },
  {
    title: 'You get the plan',
    body: 'Each qualifying zone comes with its entry, stop and three targets — plus nineteen momentum alerts through the day.',
  },
  {
    title: 'Every outcome is recorded',
    body: 'Target, stop, or retired before entry: each zone is tracked to its end and stays on the record.',
  },
]
