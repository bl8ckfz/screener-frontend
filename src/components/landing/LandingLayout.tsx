/**
 * Everything the public pages share below their hero.
 *
 * `/` and the ad landing page `/start` differ only in the opening: the copy a
 * visitor reads first has to match the ad they clicked. The argument after it —
 * the live panel, the trade story, the record, pricing, the questions — is the
 * same product and must not drift into two versions, so it lives here once.
 *
 * Signed-in users never see any of this; they are redirected to the app.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { LandingHeader, LandingFooter } from '@/components/landing/LandingChrome'
import { DemoPanel } from '@/components/landing/DemoPanel'
import { TradeStory } from '@/components/landing/TradeStory'
import { TrackRecord } from '@/components/landing/TrackRecord'
import { WhatElse } from '@/components/landing/WhatElse'
import { Pricing } from '@/components/landing/Pricing'
import { Faq } from '@/components/landing/Faq'
import type { PublicZone } from '@/types/publicDemo'

export function LandingLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()

  /**
   * The zone the page is currently about.
   *
   * Owned here because two sections read it: the panel draws it on the chart,
   * and TradeStory narrates it. Null means "whatever the server featured", and
   * that fallback lives in drawnZone rather than in this state.
   */
  const [selectedZone, setSelectedZone] = useState<PublicZone | null>(null)

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

      {children}

      {/*
        The panel is mounted unconditionally for anonymous visitors. A signed-in
        one is mid-redirect, and fetching demo data they will never see is a
        wasted request on every visit.
      */}
      {!isAuthenticated && (
        <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
          <DemoPanel selected={selectedZone} onSelect={setSelectedZone} />
        </section>
      )}

      <TradeStory selected={selectedZone} onSelect={setSelectedZone} />
      <TrackRecord />
      <WhatElse />
      <Pricing />
      <Faq />
      <LandingFooter />
    </div>
  )
}
