import { describe, expect, it } from 'vitest'
import { isAllowedOrigin } from './origin'

describe('isAllowedOrigin', () => {
  it('APP_ORIGIN と完全一致するときだけ許可する', () => {
    expect(isAllowedOrigin('http://app.localhost:4000', 'http://app.localhost:4000')).toBe(true)
    expect(isAllowedOrigin(null, 'http://app.localhost:4000')).toBe(false)
    expect(isAllowedOrigin('http://evil.localhost:4000', 'http://app.localhost:4000')).toBe(false)
    expect(isAllowedOrigin('http://app.localhost:4000/', 'http://app.localhost:4000')).toBe(false)
  })
})
