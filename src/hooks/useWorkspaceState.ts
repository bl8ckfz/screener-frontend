/**
 * The workspace a user left: which tab, and which coin was on the chart.
 *
 * WHY
 *
 * Both were plain component state, so a refresh — or simply coming back the
 * next day — dropped the user on Market Coins with an empty chart, whatever
 * they had been following. Only an open Dojo plan survived, because
 * useSelectedDojoSetup keeps it in the URL. This does the same for the rest,
 * with the same replaceState approach.
 *
 * WHERE IT IS KEPT
 *
 * The URL first, so a refresh or a copied link is exact. localStorage second,
 * so opening the app fresh from a bookmark still returns to the last tab and
 * coin. The URL wins when both exist, since it is the more deliberate of the
 * two. Storage failures cost only the convenience.
 *
 * A first visit with nothing saved opens the Dojo tab: the published plans are
 * what the product is for, and Market Coins is one click away.
 */
import { useCallback, useEffect, useState } from 'react'

export type WorkspaceTab = 'coins' | 'alerts' | 'dojo'

const TABS: readonly WorkspaceTab[] = ['coins', 'alerts', 'dojo']
export const DEFAULT_TAB: WorkspaceTab = 'dojo'

const TAB_PARAM = 'tab'
const COIN_PARAM = 'coin'
const TAB_KEY = 'workspace-tab'
const COIN_KEY = 'workspace-coin'

function isTab(v: string | null | undefined): v is WorkspaceTab {
  return !!v && (TABS as readonly string[]).includes(v)
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // Only the convenience is lost.
  }
}

function writeParam(name: string, value: string | null) {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    if (value) url.searchParams.set(name, value)
    else url.searchParams.delete(name)
    window.history.replaceState(window.history.state, '', url)
  } catch {
    // A blocked history API costs the deep link, not the state.
  }
}

/**
 * The tab and coin to start from, URL before storage. Pure over its inputs so
 * the precedence can be tested without a browser.
 */
export function resolveInitialWorkspace(
  search: string,
  stored: { tab: string | null; coin: string | null },
): { tab: WorkspaceTab; coin: string | null; coinFromUrl: boolean } {
  const params = new URLSearchParams(search)
  const urlTab = params.get(TAB_PARAM)
  const urlCoin = params.get(COIN_PARAM)
  // An open plan names its own coin, so a stored coin must not compete with
  // it — the plan's chart would be replaced by yesterday's coin.
  const hasPlan = params.has('setup')
  return {
    tab: isTab(urlTab) ? urlTab : isTab(stored.tab) ? stored.tab : DEFAULT_TAB,
    coin: hasPlan ? null : urlCoin || stored.coin || null,
    coinFromUrl: !hasPlan && !!urlCoin,
  }
}

export interface WorkspaceState {
  tab: WorkspaceTab
  setTab: (tab: WorkspaceTab) => void
  /**
   * The coin to put back on the chart once the coin list has loaded, or null.
   * Cleared by consumeRestoredCoin once it has been applied (or found absent).
   */
  restoredCoin: string | null
  /**
   * Whether restoredCoin came from the URL (a refresh or a shared link)
   * rather than from storage (a fresh launch). On a phone, where restoring
   * opens a full-screen drawer, only the former should.
   */
  restoredCoinFromUrl: boolean
  consumeRestoredCoin: () => void
  /** Record the coin on the chart; null when it is closed or a plan owns it. */
  rememberCoin: (symbol: string | null) => void
}

export function useWorkspaceState(): WorkspaceState {
  const [initial] = useState(() =>
    resolveInitialWorkspace(typeof window === 'undefined' ? '' : window.location.search, {
      tab: readStorage(TAB_KEY),
      coin: readStorage(COIN_KEY),
    }),
  )
  const [tab, setTabState] = useState<WorkspaceTab>(initial.tab)
  const [restoredCoin, setRestoredCoin] = useState<string | null>(initial.coin)

  useEffect(() => {
    writeParam(TAB_PARAM, tab)
    writeStorage(TAB_KEY, tab)
  }, [tab])

  const setTab = useCallback((next: WorkspaceTab) => setTabState(next), [])
  const consumeRestoredCoin = useCallback(() => setRestoredCoin(null), [])

  const rememberCoin = useCallback((symbol: string | null) => {
    writeParam(COIN_PARAM, symbol)
    writeStorage(COIN_KEY, symbol)
  }, [])

  return {
    tab,
    setTab,
    restoredCoin,
    restoredCoinFromUrl: initial.coinFromUrl,
    consumeRestoredCoin,
    rememberCoin,
  }
}
