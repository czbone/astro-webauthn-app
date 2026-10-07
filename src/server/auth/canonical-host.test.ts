import { describe, expect, it } from 'vitest'
import { redirectToCanonicalHost } from './canonical-host'

const canonical = 'http://app.localhost:4000'

describe('redirectToCanonicalHost', () => {
  it('別ホストの GET を同じパスへ 302 する', () => {
    const response = redirectToCanonicalHost(
      new Request('http://localhost:4000/grants?x=1'),
      canonical
    )
    expect(response?.status).toBe(302)
    expect(response?.headers.get('location')).toBe('http://app.localhost:4000/grants?x=1')
  })

  it('同じホストと変更系はリダイレクトしない', () => {
    expect(
      redirectToCanonicalHost(new Request('http://app.localhost:4000/grants'), canonical)
    ).toBeNull()
    expect(
      redirectToCanonicalHost(
        new Request('http://localhost:4000/logout', { method: 'POST' }),
        canonical
      )
    ).toBeNull()
  })
})
