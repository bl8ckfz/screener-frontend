import { describe, it, expect, vi, afterEach } from 'vitest'
import { backendApi, BackendHttpError } from '@/services/backendApi'

/**
 * A missing plan is an answer. The alert link resolver shows "this plan is not
 * in the records" on null, and an error screen on a throw — so a 404 must come
 * back as null, and everything else must still throw.
 */
function respond(status: number, body: unknown = {}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getDojoSetup', () => {
  it('returns the setup on 200', async () => {
    respond(200, { id: 'z1' })
    await expect(backendApi.getDojoSetup('z1')).resolves.toEqual({ id: 'z1' })
  })

  it('returns null on 404', async () => {
    respond(404)
    await expect(backendApi.getDojoSetup('gone')).resolves.toBeNull()
  })

  it('still throws on other failures', async () => {
    respond(500)
    await expect(backendApi.getDojoSetup('z1')).rejects.toBeInstanceOf(BackendHttpError)
  })
})
