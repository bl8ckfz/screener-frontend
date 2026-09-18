/**
 * BackendWebSocketClient — reconnection policy
 *
 * The backend re-checks entitlement on a timer now, and closes an open socket
 * with 1008 when it is no longer allowed one: the plan lapsed, the account was
 * disabled, the token was revoked by a password change, or the token expired.
 *
 * Every one of those refuses the next handshake too, so the retry loop — which
 * is otherwise infinite, capped only by a 30s backoff — has to stop for that
 * code and only that code. A network drop must still retry forever.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BackendWebSocketClient, WS_CLOSE_UNAUTHORIZED } from '@/services/backendApi'

vi.mock('@/services/authService', () => ({
  authService: { getToken: () => 'test-token' },
}))

/** Minimal stand-in: records instances and lets the test drive the callbacks. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  // All four, because connect() compares this.ws?.readyState against
  // WebSocket.CONNECTING — and with a fresh client that is undefined on both
  // sides unless the constant exists, which short-circuits the connect.
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readyState = FakeWebSocket.OPEN
  onopen: (() => void) | null = null
  onclose: ((event: { code: number; reason: string; wasClean: boolean }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  sent: string[] = []

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    /* the client under test calls this on manual disconnect */
  }

  /** Drive a close from the server side. */
  serverClose(code: number, reason = '') {
    this.readyState = 3
    this.onclose?.({ code, reason, wasClean: true })
  }
}

describe('BackendWebSocketClient reconnection', () => {
  let client: BackendWebSocketClient

  beforeEach(() => {
    vi.useFakeTimers()
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
    // The client is a singleton; each test drives a fresh one.
    ;(BackendWebSocketClient as unknown as { instance: unknown }).instance = null
    client = BackendWebSocketClient.getInstance()
    client.connect()
    FakeWebSocket.instances[0].onopen?.()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('stops reconnecting when the backend says the session is not authorized', () => {
    FakeWebSocket.instances[0].serverClose(WS_CLOSE_UNAUTHORIZED, 'subscription_expired')

    // Well past the first backoff, and the one after it.
    vi.advanceTimersByTime(60_000)

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(client.isAuthClosed()).toBe(true)
  })

  it('still reconnects after an ordinary drop', () => {
    FakeWebSocket.instances[0].serverClose(1006, 'abnormal closure')

    vi.advanceTimersByTime(60_000)

    expect(FakeWebSocket.instances.length).toBeGreaterThan(1)
    expect(client.isAuthClosed()).toBe(false)
  })

  it('retries again once something calls connect() — signing in, or renewing', () => {
    FakeWebSocket.instances[0].serverClose(WS_CLOSE_UNAUTHORIZED, 'session expired')
    expect(client.isAuthClosed()).toBe(true)

    client.connect()

    expect(client.isAuthClosed()).toBe(false)
    expect(FakeWebSocket.instances).toHaveLength(2)
  })

  it('reports the close code and reason to listeners so the UI can explain itself', () => {
    const seen: { code: number; reason: string }[] = []
    client.onClose((event) => seen.push({ code: event.code, reason: event.reason }))

    FakeWebSocket.instances[0].serverClose(WS_CLOSE_UNAUTHORIZED, 'subscription_expired')

    expect(seen).toEqual([{ code: WS_CLOSE_UNAUTHORIZED, reason: 'subscription_expired' }])
  })
})
