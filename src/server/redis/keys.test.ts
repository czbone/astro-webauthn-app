import { describe, expect, it } from 'vitest'
import { RedisKeys } from './keys'

describe('RedisKeys', () => {
  it('プレフィックスと論理キーを連結する', () => {
    expect(RedisKeys.session('app', 'abc', 'pre:')).toBe('pre:sess:app:abc')
    expect(RedisKeys.handoff('app', 'abc', '')).toBe('handoff:app:abc')
    expect(RedisKeys.sessionUser('user-1', 'pre:')).toBe('pre:sess:user:user-1')
    expect(RedisKeys.sessionUserMember('app', 'abc')).toBe('app/abc')
  })
})
