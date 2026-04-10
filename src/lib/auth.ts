import { SignJWT, jwtVerify } from 'jose'

const secretKey = process.env.JWT_SECRET || 'fallback-secret-pace-key-2026'
const key = new TextEncoder().encode(secretKey)

export async function signToken(payload: any, expiresIn = '30d') {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key)
}

export async function verifyToken(token: string, options: { ignoreSessionLimit?: boolean } = {}) {
  try {
    const { payload } = await jwtVerify(token, key)
    if (!payload?.uid) return null;

    if (!options.ignoreSessionLimit && (payload.level === 'FREE' || !payload.level)) {
       const { redis } = await import('@/lib/verificationStore');
       if (redis) {
          const activeIatStr = await redis.get(`active_session_iat:${payload.uid}`);
          if (activeIatStr && payload.iat) {
              const activeIat = parseInt(activeIatStr, 10);
              if (payload.iat < activeIat) {
                  return null; // Token was issued before the currently active session
              }
          }
       }
    }

    return payload
  } catch (error) {
    return null
  }
}
