import { describe, expect, it } from 'vitest'
import { buildCookie, readCookie, SESSION_COOKIE } from './cookies'

describe('buildCookie', () => {
  it('ホスト専用の属性だけを付ける', () => {
    const line = buildCookie(SESSION_COOKIE, 'a b', 10)
    expect(line).toContain('__Host-session=a%20b')
    expect(line).toContain('Path=/')
    expect(line).toContain('Max-Age=10')
    expect(line).toContain('SameSite=Lax')
    expect(line).toContain('HttpOnly')
    expect(line).toContain('Secure')
    expect(line.toLowerCase()).not.toContain('domain')
  })
})

describe('readCookie', () => {
  it('エンコードした値を戻す', () => {
    const request = new Request('http://app.localhost:4000/', {
      headers: { cookie: '__Host-session=a%20b; other=1' }
    })
    expect(readCookie(request, SESSION_COOKIE)).toBe('a b')
  })
})
