import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as uploadUrlPOST } from '../app/api/oss/upload-url/route';
import { POST as confirmPOST } from '../app/api/oss/confirm/route';
import prisma from '../lib/prisma';
import * as auth from '../lib/auth';
import * as presigner from '@aws-sdk/s3-request-presigner';

vi.mock('../lib/prisma', () => {
  return {
    default: {
      user: {
        findUnique: vi.fn(),
        update: vi.fn()
      }
    }
  }
});

vi.mock('../lib/auth', () => ({
  verifyToken: vi.fn()
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn()
}));

describe('OSS Upload URL API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeReq = (body: any, token: string = "mocked-token") => {
    return new NextRequest('http://localhost/api/oss/upload-url', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
  };

  test('rejects unauthenticated requests', async () => {
    const req = new NextRequest('http://localhost/api/oss/upload-url', { method: 'POST' });
    const res = await uploadUrlPOST(req);
    expect(res.status).toBe(401);
  });

  test('validates missing fields', async () => {
    vi.spyOn(auth, 'verifyToken').mockResolvedValue({ uid: 'user_1' });
    const req = makeReq({ filename: "a.jpg", contentType: "image/jpeg" }); // missing size
    const res = await uploadUrlPOST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("参数不完整");
  });

  test('validates file size limit (max 50MB)', async () => {
    vi.spyOn(auth, 'verifyToken').mockResolvedValue({ uid: 'user_1' });
    const req = makeReq({ filename: "a.jpg", contentType: "image/jpeg", size: 51 * 1024 * 1024 }); 
    const res = await uploadUrlPOST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("大小不得超过");
  });

  test('rejects when storage quota exceeded (FREE)', async () => {
    vi.spyOn(auth, 'verifyToken').mockResolvedValue({ uid: 'user_1' });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      uid: 'user_1', level: 'FREE', storage_usage: 99 * 1024 * 1024 
    } as any);

    const req = makeReq({ filename: "a.jpg", contentType: "image/jpeg", size: 2 * 1024 * 1024 }); 
    const res = await uploadUrlPOST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("存储容量不足");
  });

  test('allows upload when quota is sufficient, returns signed URL', async () => {
    vi.spyOn(auth, 'verifyToken').mockResolvedValue({ uid: 'user_1' });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      uid: 'user_1', level: 'PRO', storage_usage: 500 * 1024 * 1024 
    } as any);
    vi.mocked(presigner.getSignedUrl).mockResolvedValue('https://mocked-signed-url');

    const req = makeReq({ filename: "a.jpg", contentType: "image/jpeg", size: 2 * 1024 * 1024 }); 
    const res = await uploadUrlPOST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.uploadUrl).toBe('https://mocked-signed-url');
    expect(data.fileUrl).toBeDefined();
  });
});

describe('OSS Confirm API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeReq = (body: any, token: string = "mocked-token") => {
    return new NextRequest('http://localhost/api/oss/confirm', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
  };

  test('updates storage usage correctly with valid payload', async () => {
    vi.spyOn(auth, 'verifyToken').mockResolvedValue({ uid: 'user_1' });
    vi.mocked(prisma.user.update).mockResolvedValue({ storage_usage: 1024 } as any);

    const req = makeReq({ size: 1024 });
    const res = await confirmPOST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.newUsage).toBe(1024);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { uid: 'user_1' },
      data: { storage_usage: { increment: 1024 } }
    });
  });

  test('rejects unauthenticated requests or invalid size', async () => {
    const req = new NextRequest('http://localhost/api/oss/confirm', { method: 'POST' });
    expect((await confirmPOST(req)).status).toBe(401);

    vi.spyOn(auth, 'verifyToken').mockResolvedValue({ uid: 'user_1' });
    const req2 = makeReq({ size: "1024" }); // should be number
    expect((await confirmPOST(req2)).status).toBe(400);

    const req3 = makeReq({ size: -500 }); // invalid size
    expect((await confirmPOST(req3)).status).toBe(400);
  });
});
