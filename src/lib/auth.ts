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

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, key)
    return payload
  } catch (error) {
    return null
  }
}
