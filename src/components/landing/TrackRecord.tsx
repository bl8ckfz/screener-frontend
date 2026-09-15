/**
 * The record, stated as counts.
 *
 * NO WIN RATE, deliberately, and this is worth defending because the omission
 * looks like evasion until you do the arithmetic. With a handful of resolved
 * zones any percentage is noise. And a win rate is the wrong statistic for this
 * method regardless: the plans run at roughly 3:1, where two wins against three
 * losses is +3R — profitable. Publishing "40%" would argue against the product
 * using its own data, and publishing it alongside an explanation of why it is
 * fine reads worse still.
 *
 * So: the counts, and an honest account of what the largest bucket means.
 */
import { usePublicDemo } from '@/hooks/usePublicDemo'

export function TrackRecord() {
  const { data } = usePublicDemo()
  if (!data || data.stats.total === 0) return null

  const { total, target, stopped, invalidated, waiting, open } = data.stats
  const resolved = target + stopped

  const counts = [
    { label: 'Published', value: total },
    { label: 'Hit target', value: target, tone: 'text-emerald-400' },
    { label: 'Stopped out', value: stopped, tone: 'text-red-400' },
    { label: 'Retired unfilled', value: invalidated },
    { label: 'Still waiting', value: waiting + open },
  ]

  return (
    <section className="border-y border-gray-900 bg-[#08090b]">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Every zone, tracked to its conclusion
        </h2>

        <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-5">
          {counts.map((c) => (
            <div key={c.label}>
              <dd className={`font-mono text-3xl ${c.tone ?? 'text-white'}`}>{c.value}</dd>
              <dt className="mt-1 text-sm text-gray-500">{c.label}</dt>
            </div>
          ))}
        </dl>

        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <p className="max-w-prose text-sm leading-relaxed text-gray-400">
            {invalidated > 0 && (
              <>
                The biggest number there is the retired one, and it is the number most
                worth understanding. Those zones stopped being tradeable before price ever
                reached the entry — the swing they were measured from re-anchored, the gap
                that validated them got filled, or structure turned against them. No order
                was ever filled, so they are not losses. They are trades you did not take.
              </>
            )}
          </p>
          <p className="max-w-prose text-sm leading-relaxed text-gray-400">
            {resolved > 0 ? (
              <>
                {resolved} {resolved === 1 ? 'zone has' : 'zones have'} actually resolved so
                far, and both outcomes are on this page. There is no win rate quoted here
                because at this sample size a percentage would be noise — and because with
                plans running near 3:1, the rate on its own tells you very little about
                whether the method makes money.
              </>
            ) : (
              <>
                Nothing has resolved yet. When it does it will appear here, whichever way it
                went.
              </>
            )}
          </p>
        </div>
      </div>
    </section>
  )
}
