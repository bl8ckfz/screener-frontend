import { describe, it, expect } from 'vitest'
import { resolveInitialWorkspace, DEFAULT_TAB } from '@/hooks/useWorkspaceState'

const none = { tab: null, coin: null }

describe('resolveInitialWorkspace', () => {
  it('opens the Dojo tab when nothing is saved', () => {
    expect(resolveInitialWorkspace('', none)).toEqual({ tab: DEFAULT_TAB, coin: null, coinFromUrl: false })
    expect(DEFAULT_TAB).toBe('dojo')
  })

  it('returns to the stored tab and coin on a fresh launch', () => {
    expect(resolveInitialWorkspace('', { tab: 'alerts', coin: 'ETH' })).toEqual({
      tab: 'alerts',
      coin: 'ETH',
      coinFromUrl: false,
    })
  })

  // A refresh or a shared link is the more deliberate of the two.
  it('prefers the URL over storage', () => {
    expect(resolveInitialWorkspace('?tab=coins&coin=SOL', { tab: 'alerts', coin: 'ETH' })).toEqual({
      tab: 'coins',
      coin: 'SOL',
      coinFromUrl: true,
    })
  })

  it('ignores a tab it does not know', () => {
    expect(resolveInitialWorkspace('?tab=nonsense', { tab: 'bogus', coin: null }).tab).toBe(DEFAULT_TAB)
  })

  // The plan names its own coin; restoring another would replace its chart.
  it('restores no coin when a plan is open', () => {
    const r = resolveInitialWorkspace('?setup=abc&coin=SOL', { tab: null, coin: 'ETH' })
    expect(r.coin).toBeNull()
    expect(r.coinFromUrl).toBe(false)
  })
})
