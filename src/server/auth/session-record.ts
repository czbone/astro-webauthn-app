export type SessionClassification =
  | { action: 'missing' }
  | { action: 'drop'; userId: string | null }
  | { action: 'ok'; userId: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readUserId(value: Record<string, unknown>): string | null {
  const userId = value.userId
  if (typeof userId !== 'string' || userId.length === 0) return null
  return userId
}

/** Redis のセッション JSON を、削除が要るか続行できるかに分ける。 */
export function classifySessionValue(raw: string | null, appId: string): SessionClassification {
  if (raw === null) return { action: 'missing' }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { action: 'drop', userId: null }
  }
  if (!isRecord(parsed)) return { action: 'drop', userId: null }
  const userId = readUserId(parsed)
  const recordAppId = typeof parsed.appId === 'string' ? parsed.appId : ''
  if (recordAppId !== appId || !userId) return { action: 'drop', userId }
  return { action: 'ok', userId }
}
