/**
 * The questions a sceptical trader actually asks, answered without hedging.
 *
 * Every one of these is a real objection rather than a prompt for a sales
 * paragraph, so each answer concedes the limit before it makes the claim. A FAQ
 * that only says flattering things is read as marketing and skipped.
 */
const QA: Array<{ q: string; a: string }> = [
  {
    q: 'Is this a signal service?',
    a: 'No. It publishes zones and the plan attached to each one, then records what happened, including the losses and the ones that never filled. Nothing is executed for you and nothing tells you to take a trade — position sizing and the decision are yours.',
  },
  {
    q: 'Does it trade for me, or connect to my exchange?',
    a: 'Neither. It has no API keys, no withdrawal access and no connection to your account. It reads public market data and tells you what it found.',
  },
  {
    q: 'Which market does it cover?',
    a: 'Binance USDT-margined perpetual futures — over 200 pairs. The Dojo scan runs on the daily, 5-day and weekly charts; the momentum alerts run from 1m to 1h.',
  },
  {
    q: 'How often do zones appear?',
    a: 'The scan runs once a day, shortly after 00:02 UTC, and most days it publishes nothing on most symbols. That is the intent: it is looking for the handful of places worth an order, not filling a feed.',
  },
  {
    q: 'Why are some levels hidden on this page?',
    a: 'Because the levels are the product. Zones that have resolved are shown in full — the trade is over, and the record is what you are here to check. Zones still waiting for price show everything except the prices.',
  },
  {
    q: 'Can I get the alerts in my own Discord or Telegram?',
    a: 'Yes, as a Pro feature arranged individually — it is aimed at people running their own community or piping alerts into their own tooling. Ask after you subscribe.',
  },
]

export function Faq() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        Questions
      </h2>
      <dl className="mt-10 space-y-8">
        {QA.map(({ q, a }) => (
          <div key={q}>
            <dt className="font-medium text-white">{q}</dt>
            <dd className="mt-2 max-w-prose text-sm leading-relaxed text-gray-400">{a}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
