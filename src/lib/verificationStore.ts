// A simple in-memory store for SMS verification codes.
// For production, this should be replaced with Redis.

type VerificationRecord = {
  code: string
  expiresAt: number
}

declare global {
  var verificationStore: Map<string, VerificationRecord> | undefined
}

const store = globalThis.verificationStore ?? new Map<string, VerificationRecord>()

if (process.env.NODE_ENV !== 'production') {
  globalThis.verificationStore = store
}

export function saveVerificationCode(phone: string, code: string, ttlSeconds: number = 300) {
  store.set(phone, {
    code,
    expiresAt: Date.now() + ttlSeconds * 1000
  })
}

export function verifyCode(phone: string, code: string): boolean {
  const record = store.get(phone)
  if (!record) return false
  
  if (Date.now() > record.expiresAt) {
    store.delete(phone)
    return false
  }

  if (record.code === code) {
    store.delete(phone)
    return true
  }

  return false
}
