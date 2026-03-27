import { db } from '@/lib/db';

const MASTER_KEY_NAME = 'master_crypto_key';

/**
 * 获取或创建一个不可导出的 Web Crypto API 密钥。
 * 该密钥仅存储在 IndexedDB 中，无法通过 JavaScript 源码或控制台导出明文。
 */
async function getOrCreateCryptoKey(): Promise<CryptoKey> {
  const existing = await db.settings.get(MASTER_KEY_NAME);
  if (existing?.value) {
    return existing.value as CryptoKey;
  }
  
  const newKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // extractable: false 确保密钥永远无法脱离浏览器 API 上下文泄漏
    ['encrypt', 'decrypt']
  );
  
  await db.settings.put({ key: MASTER_KEY_NAME, value: newKey });
  return newKey;
}

export class SettingsService {
  /**
   * 使用 AES-GCM 安全存储敏感文本（如 API Key）
   * @param key 设置的键名
   * @param sensitiveData 敏感数据明文
   */
  static async setSecure(key: string, sensitiveData: string): Promise<void> {
    if (!sensitiveData) {
      await db.settings.delete(key);
      return;
    }
    
    const cryptoKey = await getOrCreateCryptoKey();
    // 每次加密生成一个随机的初始向量 (IV)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(sensitiveData);
    
    // 执行 AES-GCM 加密，返回 ArrayBuffer
    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encoded
    );
    
    // IndexedDB 支持存储普通的 Array/Uint8Array，为了确保兼容性，拆分为普通数组
    const cipherArray = Array.from(new Uint8Array(ciphertextBuffer));
    const ivArray = Array.from(iv);
    
    await db.settings.put({
      key,
      value: { ciphertext: cipherArray, iv: ivArray }
    });
  }

  /**
   * 解密并读取安全存储的文本
   * @param key 设置的键名
   * @returns 敏感数据明文（如果不存在或解密失败，返回 null）
   */
  static async getSecure(key: string): Promise<string | null> {
    const record = await db.settings.get(key);
    if (!record?.value) return null;
    
    try {
      const { ciphertext, iv } = record.value;
      const cryptoKey = await getOrCreateCryptoKey();
      
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        cryptoKey,
        new Uint8Array(ciphertext)
      );
      
      return new TextDecoder().decode(decryptedBuffer);
    } catch (e) {
      console.error(`Decryption failed for key: ${key}`, e);
      return null;
    }
  }

  /**
   * 存储普通的设置（无需加密）
   */
  static async set(key: string, value: any): Promise<void> {
    await db.settings.put({ key, value });
  }

  /**
   * 获取普通的设置
   */
  static async get(key: string): Promise<any | null> {
    const record = await db.settings.get(key);
    return record ? record.value : null;
  }

  /**
   * 获取用户资料 (免加密快速读取)
   */
  static async getProfile(): Promise<{name: string, avatar: string} | null> {
    const profile = await this.get('user_profile');
    return profile || null;
  }
  
  /**
   * 设置用户资料 (免加密)
   */
  static async setProfile(name: string, avatar: string): Promise<void> {
    await this.set('user_profile', { name, avatar });
  }
}
