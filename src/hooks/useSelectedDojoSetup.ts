/**
 * Which Dojo plan is currently open.
 *
 * WHY THIS IS A HOOK AND NOT JUST useState
 *
 * The selection used to be plain component state, which had two consequences.
 * It died on refresh, so a plan could not be linked to or come back after a
 * reload. And it could only be set from the Dojo tab, because that was the
 * only place holding a whole DojoSetup object — an alert carries a setup ID,
 * not a setup, and there was no way to turn one into the other.
 *
 * So this owns both halves: the id lives in the URL, and the row is fetched by
 * id when only an id is known.
 *
 * HANDLING A PLAN THAT IS NOT THERE
 *
 * A missing setup is reported, never substituted. The tempting fallback is to
 * show another zone on the same symbol, and it is wrong: a symbol routinely
 * carries a long and a short on different timeframes, so the substitute would
 * be a different thesis with different levels, presented as the one the user
 * asked for.
 */

import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { backendApi } from '@/services/backendApi'
import type { DojoSetup } from '@/types/dojo'

/** The query parameter the selection is kept in. */
const PARAM = 'setup'

function readParam(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return new URLSearchParams(window.location.search).get(PARAM)
  } catch {
    return null
  }
}

/**
 * Writes the selection to the URL without adding a history entry.
 *
 * replaceState rather than pushState: selecting a plan is not navigation, and
 * a push would make the back button walk through every row the user clicked
 * before it left the page.
 */
function writeParam(id: string | null) {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    if (id) url.searchParams.set(PARAM, id)
    else url.searchParams.delete(PARAM)
    window.history.replaceState({}, '', url)
  } catch {
    // A blocked history API costs the deep link, not the selection.
  }
}

export interface SelectedDojoSetup {
  /** The open plan, once known. */
  setup: DojoSetup | null
  /** The id being opened, which is known before the row is. */
  setupId: string | null
  /** A row is being fetched by id. */
  isLoading: boolean
  /**
   * The id resolved to nothing. Distinct from "no selection": the caller must
   * say the plan is unavailable rather than silently showing the last one.
   */
  isMissing: boolean
  /** Open a plan already in hand, skipping the fetch. */
  select: (setup: DojoSetup) => void
  /** Open a plan by id, as an alert refers to it. */
  selectById: (setupId: string) => void
  clear: () => void
}

export function useSelectedDojoSetup(enabled: boolean): SelectedDojoSetup {
  const [setupId, setSetupId] = useState<string | null>(() => readParam())
  // Holds a row handed over directly, so clicking a table row does not
  // round-trip to the server for something already on screen.
  const [known, setKnown] = useState<DojoSetup | null>(null)

  useEffect(() => {
    writeParam(setupId)
  }, [setupId])

  // Fetch only when the id is not already satisfied by the row in hand.
  const needsFetch = Boolean(setupId) && known?.id !== setupId

  const query = useQuery({
    queryKey: ['dojoSetup', setupId] as const,
    queryFn: () => backendApi.getDojoSetup(setupId as string),
    enabled: enabled && needsFetch,
    // A published plan is immutable apart from its outcome timestamps, and
    // those move once a day. Refetching faster would be requests for nothing.
    staleTime: 5 * 60 * 1000,
    // A 404 is an answer, not a failure, and getDojoSetup returns null for it.
    // Retrying a genuine error twice is enough before telling the user.
    retry: 1,
  })

  const select = useCallback((setup: DojoSetup) => {
    setKnown(setup)
    setSetupId(setup.id)
  }, [])

  const selectById = useCallback((id: string) => {
    setKnown(null)
    setSetupId(id)
  }, [])

  const clear = useCallback(() => {
    setKnown(null)
    setSetupId(null)
  }, [])

  const fetched = needsFetch ? query.data ?? null : null
  const setup = known?.id === setupId ? known : fetched

  return {
    setup,
    setupId,
    isLoading: needsFetch && query.isLoading,
    // Only after a settled fetch. While it is in flight the plan is unknown,
    // not missing, and saying otherwise would flash "unavailable" at someone
    // whose plan is about to load.
    isMissing: Boolean(setupId) && needsFetch && query.isSuccess && query.data === null,
    select,
    selectById,
    clear,
  }
}
