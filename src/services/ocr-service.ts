import { SettingsService } from './settings-service';

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
   * 调用腾讯云通用印刷体识别接口 (GeneralBasicOCR)
   * @param base64Image 图片的 base64 字符串（可带或不带 data:image/jpeg;base64, 前缀）
   * @returns 识别并处理好的文本行（用于输入到批量添加组件）
   */
  static async recognizeImage(base64Image: string): Promise<string> {
    const secretId = await SettingsService.getSecure('ocr_secret_id');
    const secretKey = await SettingsService.getSecure('ocr_secret_key');

    if (!secretId || !secretKey) {
      throw new Error('未配置腾讯云 OCR API 密钥，请前往设置页面配置。');
    }

    // 剔除前缀
    const cleanBase64 = base64Image.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    const endpoint = '/api/tencent-ocr';
    const host = 'ocr.tencentcloudapi.com';
    const service = 'ocr';
    const region = 'ap-guangzhou'; // 默认可用区
    const action = 'GeneralAccurateOCR'; // 切换为高精度版
    const version = '2018-11-19';
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().split('T')[0];

    const payload = JSON.stringify({ ImageBase64: cleanBase64 });

    // --- 1. 拼接规范请求串 ---
    const hashedPayload = await sha256Hex(payload);
    const canonicalRequest = `POST\n/\n\ncontent-type:application/json; charset=utf-8\nhost:${host}\n\ncontent-type;host\n${hashedPayload}`;

    // --- 2. 拼接待签名字符串 ---
    const hashedCanonicalRequest = await sha256Hex(canonicalRequest);
    const credentialScope = `${date}/${service}/tc3_request`;
    const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

    // --- 3. 计算签名 ---
    const secretDate = await sign(`TC3${secretKey}`, date);
    const secretService = await sign(new Uint8Array(secretDate), service);
    const secretSigning = await sign(new Uint8Array(secretService), 'tc3_request');
    const signatureBuf = await sign(new Uint8Array(secretSigning), stringToSign);
    
    // 转 hex
    const signature = Array.from(new Uint8Array(signatureBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // --- 4. 拼接 Authorization ---
    const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`;

    // --- 5. 发起请求 ---
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

    // --- 6. 结果处理聚合 ---
    if (!result.Response || !result.Response.TextDetections) {
      return '';
    }

    const lines: string[] = result.Response.TextDetections.map((item: any) => item.DetectedText);
    
    // 取消了原先的盲目自动打 Tag，防止乱贴标签
    // 让后续的 UI 层 Batch Add 逻辑通过树状分组（Header）来分配对应科目标签
    return lines.join('\n');
  }
}
