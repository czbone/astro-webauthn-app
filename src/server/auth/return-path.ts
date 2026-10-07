function hasControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code <= 31 || code === 127) return true
  }
  return false
}

/** 引き渡し後に戻すパス。開いたリダイレクトと引き渡しページ自身は `/` にする。 */
export function sanitizeReturnPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/'
  if (value.includes('\\') || hasControlCharacter(value)) return '/'
  let url: URL
  try {
    url = new URL(value, 'http://return.local')
  } catch {
    return '/'
  }
  if (url.origin !== 'http://return.local') return '/'
  if (url.pathname === '/callback' || url.pathname === '/logged-out') return '/'
  return `${url.pathname}${url.search}`
}

export function isStaticAsset(pathname: string): boolean {
  const segment = pathname.slice(pathname.lastIndexOf('/') + 1)
  return segment.includes('.')
}
