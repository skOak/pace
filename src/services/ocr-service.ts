import { SettingsService } from './settings-service';

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

/**
 * 将字符串进行 SHA-256 Hash 并输出 Hex 字符串
 */
async function sha256Hex(msg: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(msg));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 使用 Web Crypto API 进行 HMAC-SHA256 签名，输出 ArrayBuffer
 */
async function sign(key: Uint8Array | string | ArrayBuffer, msg: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const keyData = typeof key === 'string' ? enc.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(msg));
}

export class OcrService {
  /**
   * OCR 统一识别接口
   * @param base64Image 图片的 base64 字符串（可带或不带 data:image/jpeg;base64, 前缀）
   * @param isLoggedIn 是否为云端接管状态。如果是，使用服务端算力中台；如果为否，使用本地存放的配置和签名。
   * @returns 识别并处理好的文本行（用于输入到批量添加组件）
   */
  static async recognizeImage(base64Image: string, isLoggedIn: boolean = false): Promise<string> {
    if (isLoggedIn) {
      // 在线模式: 调用后端中台
      const response = await fetch('/api/ocr/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Image, type: 'general' })
      });
      
      if (response.status === 429) {
        const body = await response.json();
        throw new QuotaExceededError(body.message || '免费使用额度不足，请升级专业版获取更高使用额度。');
      }
      
      if (!response.ok) {
        let msg = `OCR 接口请求失败：HTTP ${response.status}`;
        try { 
          const b = await response.json(); 
          if(b.error) msg = b.error; 
        } catch(e){}
        throw new Error(msg);
      }
      
      const result = await response.json();
      return result.text || '';
    }

    // === 以下为纯本地离线模式逻辑 ===
    const secretId = await SettingsService.getSecure('ocr_secret_id');
    const secretKey = await SettingsService.getSecure('ocr_secret_key');

    if (!secretId || !secretKey) {
      throw new Error('未配置本地腾讯云 OCR API 密钥，请前往设置页面配置。');
    }

    // 剔除前缀
    const cleanBase64 = base64Image.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    const endpoint = '/api/tencent-ocr';
    const host = 'ocr.tencentcloudapi.com';
    const service = 'ocr';
    const region = 'ap-guangzhou'; 
    const action = 'GeneralAccurateOCR'; 
    const version = '2018-11-19';
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().split('T')[0];

    const payload = JSON.stringify({ ImageBase64: cleanBase64 });

    const hashedPayload = await sha256Hex(payload);
    const canonicalRequest = `POST\n/\n\ncontent-type:application/json; charset=utf-8\nhost:${host}\n\ncontent-type;host\n${hashedPayload}`;

    const hashedCanonicalRequest = await sha256Hex(canonicalRequest);
    const credentialScope = `${date}/${service}/tc3_request`;
    const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

    const secretDate = await sign(`TC3${secretKey}`, date);
    const secretService = await sign(new Uint8Array(secretDate), service);
    const secretSigning = await sign(new Uint8Array(secretService), 'tc3_request');
    const signatureBuf = await sign(new Uint8Array(secretSigning), stringToSign);
    
    // 转 hex
    const signature = Array.from(new Uint8Array(signatureBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json; charset=utf-8',
        'Host': host,
        'X-TC-Action': action,
        'X-TC-Version': version,
        'X-TC-Timestamp': timestamp.toString(),
        'X-TC-Region': region,
        'X-TC-Language': 'zh-CN',
      },
      body: payload,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OCR Request Failed:', errText);
      throw new Error(`OCR 接口请求失败：HTTP ${response.status}`);
    }

    const result = await response.json();
    if (result.Response && result.Response.Error) {
      throw new Error(`OCR 识别出错：${result.Response.Error.Message}`);
    }

    if (!result.Response || !result.Response.TextDetections) {
      return '';
    }

    const lines: string[] = result.Response.TextDetections.map((item: any) => item.DetectedText);
    return lines.join('\n');
  }
}
