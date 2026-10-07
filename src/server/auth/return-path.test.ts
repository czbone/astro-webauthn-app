import { describe, expect, it } from 'vitest'
import { sanitizeReturnPath } from './return-path'

describe('sanitizeReturnPath', () => {
  it('パスとクエリを残す', () => {
    expect(sanitizeReturnPath('/grants')).toBe('/grants')
    expect(sanitizeReturnPath('/grants?x=1')).toBe('/grants?x=1')
  })

  it('外部と引き渡し用のパスはルートにする', () => {
    expect(sanitizeReturnPath('//evil.example')).toBe('/')
    expect(sanitizeReturnPath('/\\evil')).toBe('/')
    expect(sanitizeReturnPath('https://evil.example')).toBe('/')
    expect(sanitizeReturnPath('/callback')).toBe('/')
    expect(sanitizeReturnPath('/logged-out?next=1')).toBe('/')
    expect(sanitizeReturnPath('/ok\\path')).toBe('/')
    expect(sanitizeReturnPath('/a\u0000b')).toBe('/')
    expect(sanitizeReturnPath('')).toBe('/')
  })
})
