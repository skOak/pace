import Redis from 'ioredis';

// Type definitions
type VerificationRecord = {
  code: string;
  expiresAt: number;
};

// Global augmentation for memory fallback
declare global {
  var verificationStoreMem: Map<string, VerificationRecord> | undefined;
  var redisClient: Redis | undefined;
}

// Memory fallback store
const memStore = globalThis.verificationStoreMem ?? new Map<string, VerificationRecord>();

if (process.env.NODE_ENV !== 'production') {
  globalThis.verificationStoreMem = memStore;
}

// Initialize Redis if URL is provided
export const redis = process.env.REDIS_URL
  ? globalThis.redisClient || new Redis(process.env.REDIS_URL)
  : null;

if (redis && process.env.NODE_ENV !== 'production') {
  globalThis.redisClient = redis;
}

/**
 * Save verification code securely either on Redis or fallbacks to Memory
 * @param email The user email
 * @param code The 6-digit verification code 
 * @param ttlSeconds Expiration limit, default is 300s (5mins)
 */
export async function saveVerificationCode(email: string, code: string, ttlSeconds: number = 300) {
  if (redis) {
    await redis.setex(`auth_code:${email}`, ttlSeconds, code);
  } else {
    memStore.set(email, {
      code,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
}

/**
 * Validate given verification code against store
 * Auto destroys after successful match or expiration
 */
export async function verifyCode(email: string, code: string): Promise<boolean> {
  // Option A: Redis Cluster
  if (redis) {
    const record = await redis.get(`auth_code:${email}`);
    if (!record) return false;

    if (record === code) {
      await redis.del(`auth_code:${email}`);
      return true;
    }
    return false;
  }

  // Option B: Local Memory
  const record = memStore.get(email);
  if (!record) return false;

  if (Date.now() > record.expiresAt) {
    memStore.delete(email);
    return false;
  }

  if (record.code === code) {
    memStore.delete(email);
    return true;
  }

  return false;
}
