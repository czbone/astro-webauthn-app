export function effectivePermission(input: {
  appFound: boolean
  grant: string | null
  defaultPermission: string | null
}): 'allow' | null {
  if (!input.appFound) return null
  if (input.grant !== null) return input.grant === 'allow' ? 'allow' : null
  return input.defaultPermission === 'allow' ? 'allow' : null
}

export function roleLabel(role: string | null): string {
  if (role === 'admin') return '管理者'
  if (role === 'manager') return 'ユーザー管理者'
  return '一般ユーザー'
}

export function canViewGrants(role: string | null): boolean {
  return role === 'admin'
}

export function canManageAppRoles(role: string | null): boolean {
  return role === 'admin' || role === 'manager'
}

export function grantLabel(permission: string): string {
  if (permission === 'allow') return '利用可'
  if (permission === 'none') return '利用不可'
  return permission
}

export function defaultPermissionLabel(value: string | null): string {
  if (value === 'allow') return '全利用者に利用を許可'
  if (value === null) return '利用を許可しない（個別のみ）'
  return '設定エラー。既定からは入場させない'
}
