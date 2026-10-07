import { describe, expect, it } from 'vitest'
import { timingSafeEqualString } from './tokens'

describe('timingSafeEqualString', () => {
  it('同じ文字列だけ一致する', () => {
    expect(timingSafeEqualString('state-a', 'state-a')).toBe(true)
    expect(timingSafeEqualString('state-a', 'state-b')).toBe(false)
    expect(timingSafeEqualString('short', 'much-longer-value')).toBe(false)
  })
})
