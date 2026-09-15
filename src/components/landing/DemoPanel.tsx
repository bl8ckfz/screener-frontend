/**
 * The product, running, on the landing page.
 *
 * This is the page's argument: not a screenshot, not a video, but the actual
 * scanner output with the actual chart, restricted to a few symbols and with
 * live zones' levels withheld. Everything a visitor can see here is something
 * they can verify later against their own charts.
 */
import { Suspense, lazy, useState } from 'react'
import { ChartSkeleton } from '@/components/ui/Skeleton'
import { DemoZonesTable } from './DemoZonesTable'
import { usePublicDemo } from '@/hooks/usePublicDemo'
import { featuredZone, isUnlocked, type PublicZone, type UnlockedZone } from '@/types/publicDemo'

const DemoChart = lazy(() => import('./DemoChart'))

/** How stale the payload is, in words rather than a timestamp nobody parses. */
function freshness(generatedAt: string): string {
  const secs = Math.max(0, Math.round((Date.now() - Date.parse(generatedAt)) / 1000))
  if (secs < 90) return 'updated just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `updated ${mins} min ago`
  const hours = Math.round(mins / 60)
  return `updated ${hours}h ago`
}

export function DemoPanel() {
  const { data, isLoading, isError } = usePublicDemo()
  const [selected, setSelected] = useState<PublicZone | null>(null)

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-800 bg-[#0d0f12] p-6">
        <ChartSkeleton />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-gray-800 bg-[#0d0f12] p-8">
        <p className="text-sm text-gray-400">
          The live panel is not reachable right now. The scanner is unaffected — this is
          only the public preview.
        </p>
      </div>
    )
  }

  // What the chart draws: whatever the visitor last clicked, if it resolved,
  // otherwise the zone the server featured. Both are unlocked by construction.
  const clicked: UnlockedZone | null = selected && isUnlocked(selected) ? selected : null
  const drawn = clicked ?? featuredZone(data)
  const chartSymbol =
    data.symbols.find((s) => s.symbol === drawn?.symbol) ?? data.symbols[0] ?? null

  return (
    <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#0d0f12]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-medium text-white">
            {chartSymbol ? chartSymbol.symbol.replace(/USDT$/, '/USDT') : 'Dojo zones'}
          </span>
          {chartSymbol && (
            <span className="font-mono text-sm text-gray-300">
              {chartSymbol.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}
            </span>
          )}
          {chartSymbol?.price_source === 'candle_close' && (
            <span className="text-xs text-gray-500" title="Live ticker unavailable; showing the last daily close">
              last close
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {data.symbols.length} of {data.stats.total > 0 ? '200+' : 'many'} pairs shown ·{' '}
          {freshness(data.generated_at)}
        </span>
      </div>

      {chartSymbol && (
        <Suspense fallback={<div className="h-[420px]" />}>
          <DemoChart symbol={chartSymbol} zone={drawn} />
        </Suspense>
      )}

      <div className="border-t border-gray-800">
        <DemoZonesTable
          zones={data.zones}
          featuredId={drawn?.id}
          selectedId={selected?.id ?? null}
          onZoneSelect={setSelected}
        />
      </div>
    </div>
  )
}
