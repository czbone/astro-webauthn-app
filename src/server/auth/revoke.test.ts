import { describe, expect, it } from 'vitest'
import { parseIndexMember } from '@/server/auth/revoke'

describe('parseIndexMember', () => {
  it('最初のスラッシュでアプリ ID とトークンハッシュに分ける', () => {
    expect(parseIndexMember('app/abc')).toEqual({ appId: 'app', tokenHash: 'abc' })
    expect(parseIndexMember('app/ab/c')).toEqual({ appId: 'app', tokenHash: 'ab/c' })
  })

  it('スラッシュが端にある要素と、スラッシュが無い要素は解釈しない', () => {
    expect(parseIndexMember('not-a-member')).toBeNull()
    expect(parseIndexMember('/abc')).toBeNull()
    expect(parseIndexMember('app/')).toBeNull()
    expect(parseIndexMember('')).toBeNull()
  })
})
