import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

function sha256Hex(msg: string): string {
  return crypto.createHash('sha256').update(msg).digest('hex');
}

function sign(key: string | Buffer, msg: string): Buffer {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) return NextResponse.json({ error: '未经授权' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.uid) return NextResponse.json({ error: '无效会话' }, { status: 401 });

    const userId = payload.uid as string;
    const body = await req.json();
    const { imageBase64, type = 'general' } = body;

    if (!imageBase64) return NextResponse.json({ error: '缺少图片数据' }, { status: 400 });

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    const user = await prisma.user.findUnique({ where: { uid: userId } });
    if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

    const quotaRow = await prisma.systemConfig.findUnique({ where: { key: 'ocr_quotas' } });
    let freeQuota = 1;
    let proQuota = 100;
    if (quotaRow) {
      try {
        const parsed = JSON.parse(quotaRow.value);
        freeQuota = parsed.free ?? 1;
        proQuota = parsed.pro ?? 100;
      } catch (e) {}
    }
    const limit = user.level === 'PRO' ? proQuota : freeQuota; 
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const usageCount = await prisma.ocrUsageLog.count({
      where: { userId, created_at: { gte: startOfDay } },
    });

    if (usageCount >= limit) {
      return NextResponse.json({ 
        error: 'QUOTA_EXCEEDED', 
        message: '免费用户每日仅可使用1次OCR服务，是否升级专业版？' 
      }, { status: 429 });
    }

    const imageMd5 = crypto.createHash('md5').update(cleanBase64).digest('hex');
    const cached = await prisma.ocrCache.findUnique({ where: { image_md5: imageMd5 } });

    if (cached) {
      await prisma.ocrUsageLog.create({ data: { userId } });
      return NextResponse.json({ text: cached.result });
    }

    // Get Active Config from DB
    const configRow = await prisma.systemConfig.findUnique({ where: { key: 'ocr_configs' } });
    if (!configRow) {
      return NextResponse.json({ error: '服务端暂未配置OCR密钥' }, { status: 500 });
    }
    const ocrConfigs = JSON.parse(configRow.value);
    const activeConfig = ocrConfigs.find((c: any) => c.isActive);
    if (!activeConfig) {
      return NextResponse.json({ error: '服务端未激活任何OCR配置' }, { status: 500 });
    }

    const secretId = activeConfig.secretId;
    const secretKey = activeConfig.secretKey;

    const endpoint = 'https://ocr.tencentcloudapi.com/';
    const host = 'ocr.tencentcloudapi.com';
    const service = 'ocr';
    const region = 'ap-guangzhou';
    const action = type === 'handwriting' ? 'GeneralHandwritingOCR' : 'GeneralAccurateOCR';
    const version = '2018-11-19';
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().split('T')[0];

    const payloadStr = JSON.stringify({ ImageBase64: cleanBase64 });

    const hashedPayload = sha256Hex(payloadStr);
    const canonicalRequest = `POST\n/\n\ncontent-type:application/json; charset=utf-8\nhost:${host}\n\ncontent-type;host\n${hashedPayload}`;

    const hashedCanonicalRequest = sha256Hex(canonicalRequest);
    const credentialScope = `${date}/${service}/tc3_request`;
    const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

    const secretDate = sign(`TC3${secretKey}`, date);
    const secretService = sign(secretDate, service);
    const secretSigning = sign(secretService, 'tc3_request');
    const signatureBuf = sign(secretSigning, stringToSign);
    const signature = signatureBuf.toString('hex');

    const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`;

    const tencentRes = await fetch(endpoint, {
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
      body: payloadStr,
    });

    if (!tencentRes.ok) {
      const errText = await tencentRes.text();
      return NextResponse.json({ error: `OCR接口调用失败 (${tencentRes.status}) - ${errText}` }, { status: 502 });
    }

    const result = await tencentRes.json();
    if (result.Response && result.Response.Error) {
      return NextResponse.json({ error: `OCR 识别出错: ${result.Response.Error.Message}` }, { status: 500 });
    }

    if (!result.Response || !result.Response.TextDetections) {
      return NextResponse.json({ text: '' });
    }

    const lines: string[] = result.Response.TextDetections.map((item: any) => item.DetectedText);
    const cleanedText = lines.filter((line: string) => {
      const trimmed = line.trim();
      if (/^\d{1,3}$/.test(trimmed)) return false;
      if (/^[.、\-*+~_]{1,3}$/.test(trimmed)) return false;
      return true;
    }).join('\n');

    await prisma.ocrCache.create({
      data: { image_md5: imageMd5, result: cleanedText }
    });
    
    await prisma.ocrUsageLog.create({ data: { userId } });

    return NextResponse.json({ text: cleanedText });

  } catch (err: any) {
    console.error('Server OCR error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
