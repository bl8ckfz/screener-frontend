/**
 * Landing Page
 *
 * The page's argument is the panel, not the copy: a visitor sees the actual
 * scanner output — real chart, real zones, real outcomes including the losses —
 * before they read a word of persuasion. Zones still waiting for price have
 * their levels withheld by the server, and that locked row is the strongest
 * call to action on the page.
 *
 * Signed-in users never see any of this; they are redirected to the app.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LandingHeader, LandingFooter } from '@/components/landing/LandingChrome'
import { DemoPanel } from '@/components/landing/DemoPanel'
import { TradeStory } from '@/components/landing/TradeStory'
import { TrackRecord } from '@/components/landing/TrackRecord'
import { WhatElse } from '@/components/landing/WhatElse'
import { Pricing } from '@/components/landing/Pricing'
import { Faq } from '@/components/landing/Faq'
import { checkoutUrl } from '@/config/checkout'

export function LandingPage() {
  const { isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/app', { replace: true })
    }
  }, [isAuthenticated, loading, navigate])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <svg className="h-8 w-8 animate-spin text-gray-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <LandingHeader />

      <section className="mx-auto max-w-6xl px-4 pb-6 pt-14 sm:px-6 sm:pt-20">
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          200+ pairs scanned every day.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-400">
          Usually it finds nothing. When it does find something, you get the zone, the
          entry, the stop and three targets — and then a record of what actually happened
          to it.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
          <a
            href={checkoutUrl('screener_monthly', 'hero')}
            className="rounded bg-[#f5a623] px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[#ffb83d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5a623]"
          >
            Get access
          </a>
          <span className="text-sm text-gray-500">
            Below is the live scanner, not a screenshot.
          </span>
        </div>
      </section>

      {/*
        The panel is mounted unconditionally for anonymous visitors. A signed-in
        one is mid-redirect, and fetching demo data they will never see is a
        wasted request on every visit to "/".
      */}
      {!isAuthenticated && (
        <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
          <DemoPanel />
        </section>
      )}

      <TradeStory />
      <TrackRecord />
      <WhatElse />
      <Pricing />
      <Faq />
      <LandingFooter />
    </div>
  )
}
