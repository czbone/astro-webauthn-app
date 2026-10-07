import { describe, expect, it } from 'vitest'
import { classifySessionValue } from './session-record'

describe('classifySessionValue', () => {
  it('キーが無いときは削除しない', () => {
    expect(classifySessionValue(null, 'app')).toEqual({ action: 'missing' })
  })

  it('JSON でない値は userId なしで捨てる', () => {
    expect(classifySessionValue('not-json', 'app')).toEqual({ action: 'drop', userId: null })
    expect(classifySessionValue('{"appId":"app"}', 'app')).toEqual({ action: 'drop', userId: null })
  })

  it('appId が違うときは userId を残して捨てる', () => {
    const raw = JSON.stringify({ userId: 'user-1', appId: 'other', id: 's', createdAt: 't' })
    expect(classifySessionValue(raw, 'app')).toEqual({ action: 'drop', userId: 'user-1' })
  })

  it('appId が一致すれば続行する', () => {
    const raw = JSON.stringify({ userId: 'user-1', appId: 'app', id: 's', createdAt: 't' })
    expect(classifySessionValue(raw, 'app')).toEqual({ action: 'ok', userId: 'user-1' })
  })
})
