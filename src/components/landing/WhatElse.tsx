/**
 * The rest of the product: the momentum engine, and the TradingView scripts.
 *
 * Kept as prose with a short list rather than a grid of feature cards. The page
 * has already made its case with live data; a wall of icons after that reads as
 * padding, and every card added here competes with the panel for attention.
 */

const MOMENTUM_ALERTS = [
  'Surge — volume and price breaking together on 5m, 15m or 1h',
  'Scout — early momentum with volume confirming, before the move is obvious',
  'Whale — a volume anomaly with almost no price impact',
  'Raid — a reversal off a high or low, with the flush behind it',
  'Capitulation — deep flushes inside an established drawdown',
]

const SCRIPTS = [
  {
    name: 'Dojo Structure',
    url: 'https://www.tradingview.com/script/qm8ifCzF-Dojo-Structure/',
    what: 'Swings labelled HH/HL/LH/LL, with breaks confirmed on a candle body close — a wick through a level is marked as a liquidity grab, not a break.',
  },
  {
    name: 'Dojo Zones',
    url: 'https://www.tradingview.com/script/ttQbeegL-Dojo-Zones/',
    what: 'Fair value gaps, order blocks validated against all four pillars, breaker flips, and hidden order blocks confirmed by the gap in front of them.',
  },
  {
    name: 'Dojo Liquidity',
    url: 'https://www.tradingview.com/script/qsFFesgw-Dojo-Liquidity/',
    what: 'Pools with tap counts, and a verdict when price pushes through one: a sweep, a failed auction, or a level that genuinely broke.',
  },
]

export function WhatElse() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
      <div className="grid gap-16 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            Zones are daily. The alerts are not.
          </h2>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-gray-400">
            A Dojo zone tells you where to put an order this week. The momentum engine runs
            underneath it on 1m through 1h, across every pair, for the days when something
            moves before the daily close says so.
          </p>
          <ul className="mt-6 space-y-2.5">
            {MOMENTUM_ALERTS.map((a) => {
              const [name, rest] = a.split(' — ')
              return (
                <li key={name} className="text-sm leading-relaxed text-gray-400">
                  <span className="text-gray-200">{name}</span>
                  <span className="text-gray-600"> — </span>
                  {rest}
                </li>
              )
            })}
          </ul>
          <p className="mt-6 max-w-prose text-sm leading-relaxed text-gray-500">
            Nineteen in all, each one switchable, scoped to your own watchlist if you want
            it quieter.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            The same logic, on your own charts
          </h2>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-gray-400">
            Three TradingView indicators implement the mechanical parts of the method. They
            are sold separately and they are not required — the scanner does this work for
            you across 200 pairs — but they are how you check its reasoning against a chart
            you are already looking at.
          </p>
          <ul className="mt-6 space-y-5">
            {SCRIPTS.map((s) => (
              <li key={s.name}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm font-medium text-white underline decoration-gray-700 underline-offset-4 transition-colors hover:decoration-[#f5a623]"
                >
                  {s.name}
                </a>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-gray-400">{s.what}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
