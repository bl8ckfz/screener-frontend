/**
 * The free view: what a signed-in account without a subscription sees.
 *
 * This used to be the paywall. An account that had only an email address got a
 * pricing table and nothing else, so 22 of the first 31 signups never saw the
 * product at all. Now it gets the scanner's output with the levels locked, one
 * live zone a week in full, and the whole record.
 *
 * Deliberately NOT ScreenerApp with features switched off. The paying app
 * opens the alert socket and loads the market data on mount, and every one of
 * those calls answers 403 to a free account. This page reads /api/free/* only,
 * and reuses the landing page's table and chart — the same components, fed
 * more rows.
 *
 * WHERE A LIVE PRICE CAN APPEAR HERE: the sample section, and nowhere else.
 * The live list is LockedZone[], which has no price fields to render.
 */
import { Suspense, lazy, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useFreeZones, useFreeRecord } from '@/hooks/useFreeAccount'
import { DemoZonesTable } from '@/components/landing/DemoZonesTable'
import { OutcomeBadge, TradePlan } from '@/components/dojo/DojoSetupsTable'
import { DigestSwitch } from '@/components/free/DigestSwitch'
import { UpgradeLink } from '@/components/free/UpgradeLink'
import { Logo } from '@/components/ui'
import { FREE, TRIAL } from '@/config/access'
import { toDojoSetup, type PublicDemoStats, type PublicDemoSymbol } from '@/types/publicDemo'
import type { RecordOutcome, SampleZone } from '@/types/free'

const DemoChart = lazy(() => import('@/components/landing/DemoChart'))

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** The week's one unlocked zone, drawn and with its plan. */
function Sample({ zone, chart }: { zone: SampleZone; chart: PublicDemoSymbol | null }) {
  const setup = toDojoSetup(zone)
  const over = zone.outcome === 'target' || zone.outcome === 'stopped' || zone.outcome === 'invalidated'

  return (
    <div className="overflow-hidden rounded-lg border border-[#f5a623]/40 bg-[#0d0f12]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-medium text-white">{zone.symbol.replace(/USDT$/, '/USDT')}</span>
          <span className="font-mono text-xs text-gray-400">{zone.timeframe}</span>
          <span className={zone.direction === 'long' ? 'text-sm text-emerald-400' : 'text-sm text-red-400'}>
            {zone.direction === 'long' ? 'Long' : 'Short'}
          </span>
        </div>
        <OutcomeBadge setup={{ outcome: zone.outcome, invalidation_reason: zone.invalidation_reason }} />
      </div>

      {/* Drawn only on its own candles: the chart labels every level on the
          price axis, so the wrong pair underneath would be worse than none. */}
      {chart && chart.symbol === zone.symbol && (
        <Suspense fallback={<div className="h-[360px]" />}>
          <DemoChart symbol={chart} zone={zone} height={360} />
        </Suspense>
      )}

      <TradePlan setup={setup} livePrice={chart?.price} hasPlanDetails={false} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 px-4 py-3">
        <p className="max-w-prose text-sm leading-relaxed text-gray-400">
          {over
            ? 'This week’s sample has ended; the outcome is above. A new one is chosen next week.'
            : 'Subscribers get this for every zone, the day it publishes.'}
        </p>
        <UpgradeLink source="free_sample">{TRIAL.cta}</UpgradeLink>
      </div>
    </div>
  )
}

function Counts({ stats }: { stats: PublicDemoStats }) {
  // Counts, never a rate — the same rule, for the same reason, as the landing
  // page's TrackRecord.
  const counts = [
    { label: 'Published', value: stats.total },
    { label: 'Hit target', value: stats.target, tone: 'text-emerald-400' },
    { label: 'Stopped out', value: stats.stopped, tone: 'text-red-400' },
    { label: 'Retired unfilled', value: stats.invalidated },
    { label: 'In play', value: stats.waiting + stats.open },
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-5">
      {counts.map((c) => (
        <div key={c.label}>
          <dd className={`font-mono text-2xl ${c.tone ?? 'text-white'}`}>{c.value}</dd>
          <dt className="mt-1 text-sm text-gray-500">{c.label}</dt>
        </div>
      ))}
    </dl>
  )
}

const RECORD_FILTERS: Array<{ label: string; value: RecordOutcome | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'Hit target', value: 'target' },
  { label: 'Stopped out', value: 'stopped' },
  { label: 'Retired', value: 'invalidated' },
]

function Record() {
  const [outcome, setOutcome] = useState<RecordOutcome | undefined>(undefined)
  const record = useFreeRecord(outcome)
  const zones = record.data?.pages.flatMap((p) => p.zones) ?? []

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter the record by outcome">
        {RECORD_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={outcome === f.value}
            onClick={() => setOutcome(f.value)}
            className={`rounded px-3 py-1 text-sm transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#f5a623] ${
              outcome === f.value ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#0d0f12]">
        {record.isLoading ? (
          <p className="px-4 py-8 text-sm text-gray-400">Loading the record…</p>
        ) : record.isError ? (
          <p role="alert" className="px-4 py-8 text-sm text-gray-400">
            The record could not be loaded right now. Try again in a moment.
          </p>
        ) : zones.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-400">Nothing with that outcome yet.</p>
        ) : (
          <DemoZonesTable zones={zones} />
        )}
      </div>

      {record.hasNextPage && (
        <button
          type="button"
          onClick={() => record.fetchNextPage()}
          disabled={record.isFetchingNextPage}
          className="mt-3 rounded border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-900 disabled:opacity-50"
        >
          {record.isFetchingNextPage ? 'Loading…' : 'Show older zones'}
        </button>
      )}
    </>
  )
}

export function FreeApp() {
  const { user, logout } = useAuth()
  const { data, isLoading, isError } = useFreeZones()

  // plan_activated_at is set by the first checkout, so it tells an account
  // that once paid from one that never has. They see the same view; only the
  // one line that explains why differs.
  const lapsed = !!user?.plan_activated_at

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-900 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 whitespace-nowrap">
            <Logo size={24} />
            <span className="hidden rounded border border-gray-700 px-2 py-0.5 text-xs text-gray-400 sm:inline">
              Free account
            </span>
          </div>
          <div className="flex items-center gap-3 whitespace-nowrap">
            <span className="hidden text-sm text-gray-500 md:inline">{user?.email}</span>
            {/* A phone has room for one word here, not for the whole offer. */}
            <UpgradeLink source="free_header">
              <span className="sm:hidden">Upgrade</span>
              <span className="hidden sm:inline">{TRIAL.cta}</span>
            </UpgradeLink>
            <button type="button" onClick={logout} className="px-2 py-1.5 text-sm text-gray-400 transition-colors hover:text-white">
              Sign out
            </button>
          </div>
        </div>
      </header>

      {lapsed && (
        <div className="border-b border-gray-900 bg-[#08090b] px-4 py-2.5 text-center text-sm text-gray-400">
          Your subscription has ended, so this is the free view.{' '}
          <UpgradeLink source="free_notice" variant="text">
            Restart your plan
          </UpgradeLink>
        </div>
      )}

      <section className="mx-auto max-w-5xl px-4 pb-2 pt-10 sm:px-6">
        <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight">
          Today’s scan, one zone in full, and every result so far.
        </h1>
        <p className="mt-3 max-w-prose text-gray-400">{FREE.without}</p>
      </section>

      {isLoading ? (
        <p className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400 sm:px-6">Loading the scan…</p>
      ) : isError || !data ? (
        <p role="alert" className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-400 sm:px-6">
          The scan could not be loaded right now. The scanner is unaffected; try again in a moment.
        </p>
      ) : (
        <>
          <Section
            title="This week’s sample"
            aside={<span className="text-sm text-gray-500">one live zone a week, shown in full</span>}
          >
            {data.sample ? (
              <Sample zone={data.sample} chart={data.sample_chart} />
            ) : (
              <p className="rounded-lg border border-gray-800 bg-[#0d0f12] px-4 py-6 text-sm leading-relaxed text-gray-400">
                No sample yet this week. It appears with the first new zone that qualifies; some
                weeks start quietly.
              </p>
            )}
          </Section>

          <Section
            title={`Zones in play (${data.live.length})`}
            aside={<span className="text-sm text-gray-500">scan runs daily, shortly after 00:02 UTC</span>}
          >
            <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#0d0f12]">
              {data.live.length === 0 ? (
                <p className="px-4 py-8 text-sm text-gray-400">
                  Nothing else is in play right now. Most days the scan finds little; that is the intent.
                </p>
              ) : (
                <DemoZonesTable
                  zones={data.live}
                  lockedAction={<UpgradeLink source="free_locked_row">Unlock the levels</UpgradeLink>}
                />
              )}
            </div>
          </Section>

          <Section title="The record">
            <Counts stats={data.stats} />
            <p className="mb-5 mt-4 max-w-prose text-sm leading-relaxed text-gray-400">
              Every zone that has ended, with the plan it published and what happened. Retired
              zones never reached their entry, so they are neither wins nor losses.
            </p>
            <Record />
          </Section>
        </>
      )}

      <Section title="Email">
        <div className="rounded-lg border border-gray-800 bg-[#0d0f12] p-5">
          <DigestSwitch description="The new zones, what ended, and the week’s sample. Sent only on days with something to report; one click in any email stops it." />
        </div>
      </Section>

      <footer className="border-t border-gray-900 py-10">
        <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-6">
          <p className="max-w-3xl text-xs leading-relaxed text-gray-500">
            <span className="font-semibold text-gray-400">Disclaimer:</span> Coin-Sniffer provides
            market data, alerts, and analytical tools for informational and educational purposes
            only. It does not provide financial, investment, or trading advice. Trading
            cryptocurrencies and futures involves substantial risk, and losses can exceed deposits.
            Past performance and alerts do not guarantee future results.
          </p>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/terms" className="text-gray-400 transition-colors hover:text-white">Terms of Service</Link>
            <Link to="/privacy" className="text-gray-400 transition-colors hover:text-white">Privacy Policy</Link>
            <Link to="/billing" className="text-gray-400 transition-colors hover:text-white">Billing</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
