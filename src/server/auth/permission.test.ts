import { describe, expect, it } from 'vitest'
import { effectivePermission } from '@/server/auth/permission'

describe('effectivePermission', () => {
  it('アプリが無いときは付与なし', () => {
    expect(
      effectivePermission({ appFound: false, grant: null, defaultPermission: 'allow' })
    ).toBeNull()
  })

  it('行が allow なら入れる', () => {
    expect(effectivePermission({ appFound: true, grant: 'allow', defaultPermission: null })).toBe(
      'allow'
    )
  })

  it('行が none や allow 以外なら既定へ進まない', () => {
    expect(
      effectivePermission({ appFound: true, grant: 'none', defaultPermission: 'allow' })
    ).toBeNull()
    expect(
      effectivePermission({ appFound: true, grant: 'admin', defaultPermission: 'allow' })
    ).toBeNull()
    expect(
      effectivePermission({ appFound: true, grant: '', defaultPermission: 'allow' })
    ).toBeNull()
  })

  it('行が無く既定が allow なら入れる', () => {
    expect(effectivePermission({ appFound: true, grant: null, defaultPermission: 'allow' })).toBe(
      'allow'
    )
  })

  it('行が無く既定が allow 以外なら付与なし', () => {
    expect(effectivePermission({ appFound: true, grant: null, defaultPermission: null })).toBeNull()
    expect(
      effectivePermission({ appFound: true, grant: null, defaultPermission: 'user' })
    ).toBeNull()
  })
})
