import { cookieStore } from '@/server/auth/cookie-store'

export const SESSION_COOKIE = '__Host-session'
export const HANDOFF_COOKIE = '__Host-handoff'
export const HANDOFF_MAX_AGE_SECONDS = 300

export function buildCookie(name: string, value: string, maxAge: number): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
    'HttpOnly',
    'Secure'
  ].join('; ')
}

export function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    if (trimmed.slice(0, eq) !== name) continue
    try {
      return decodeURIComponent(trimmed.slice(eq + 1))
    } catch {
      return null
    }
  }
  return null
}

export function appendCookie(name: string, value: string, maxAge: number): void {
  cookieStore.append(buildCookie(name, value, maxAge))
}

export function setSessionCookie(token: string, maxAge: number): void {
  appendCookie(SESSION_COOKIE, token, maxAge)
}

export function clearSessionCookie(): void {
  appendCookie(SESSION_COOKIE, '', 0)
}

export function setHandoffCookie(value: string): void {
  appendCookie(HANDOFF_COOKIE, value, HANDOFF_MAX_AGE_SECONDS)
}

export function clearHandoffCookie(): void {
  appendCookie(HANDOFF_COOKIE, '', 0)
}
