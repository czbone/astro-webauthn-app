export type AppPermission = 'admin' | 'user'

export function isAppPermission(value: string | null): value is AppPermission {
  return value === 'admin' || value === 'user'
}

export function permissionLabel(permission: AppPermission): string {
  return permission === 'admin' ? '管理者' : '利用者'
}
