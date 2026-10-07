import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

const STATE_VALUE = /^[\w.~-]{1,128}$/

export function isHandoffState(value: string): boolean {
  return STATE_VALUE.test(value)
}

export function timingSafeEqualString(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left).digest()
  const rightDigest = createHash('sha256').update(right).digest()
  return timingSafeEqual(leftDigest, rightDigest)
}
