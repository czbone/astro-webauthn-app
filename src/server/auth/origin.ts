const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function isUnsafeMethod(method: string): boolean {
  return UNSAFE_METHODS.has(method.toUpperCase())
}

export function isAllowedOrigin(originHeader: string | null, appOrigin: string): boolean {
  return originHeader === appOrigin
}
