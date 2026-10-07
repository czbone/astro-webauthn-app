const SAFE_METHODS = new Set(['GET', 'HEAD'])

/** 開発時に別ホストで開かれた GET / HEAD を APP_ORIGIN の同じパスへ戻す。 */
export function redirectToCanonicalHost(
  request: Request,
  canonicalOrigin: string
): Response | null {
  if (!SAFE_METHODS.has(request.method)) return null
  let current: URL
  let canonical: URL
  try {
    current = new URL(request.url)
    canonical = new URL(canonicalOrigin)
  } catch {
    return null
  }
  if (current.host === canonical.host) return null
  const target = new URL(`${current.pathname}${current.search}`, canonical.origin)
  return Response.redirect(target, 302)
}
