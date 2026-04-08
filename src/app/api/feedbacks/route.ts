import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'check_quota') {
      const config = await prisma.systemConfig.findUnique({ where: { key: 'USER_FEEDBACK_QUOTA' } });
      const maxQuota = config ? parseInt(config.value, 10) : 3;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayCount = await prisma.feedback.count({
        where: {
          userId: payload.uid,
          created_at: { gte: todayStart }
        }
      });

      return NextResponse.json({
        todayCount,
        maxQuota,
        canSubmit: todayCount < maxQuota && maxQuota > 0
      });
    }

    const feedbacks = await prisma.feedback.findMany({
      where: { userId: payload.uid },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({ data: feedbacks });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const config = await prisma.systemConfig.findUnique({ where: { key: 'USER_FEEDBACK_QUOTA' } });
    const maxQuota = config ? parseInt(config.value, 10) : 3;

    if (maxQuota <= 0) {
      return NextResponse.json({ error: '系统当前未开放意见反馈功能' }, { status: 403 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayCount = await prisma.feedback.count({
      where: {
        userId: payload.uid,
        created_at: { gte: todayStart }
      }
    });

    if (todayCount >= maxQuota) {
      return NextResponse.json({ error: `您今日提交的反馈已达到上限 (${maxQuota}次)，请明日再试` }, { status: 429 });
    }

    const { content, images } = await req.json();

    if (!content || typeof content !== 'string' || content.length > 5000) {
      return NextResponse.json({ error: '反馈内容无效或过长' }, { status: 400 });
    }

    let validImages: string[] = [];
    if (Array.isArray(images)) {
      if (images.length > 3) {
        return NextResponse.json({ error: '最多只能上传3张截图' }, { status: 400 });
      }
      for (const img of images) {
        if (typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://'))) {
          // Additional safety: truncate excessively long url strings
          validImages.push(img.substring(0, 500));
        } else if (typeof img === 'string' && img.startsWith('data:image/') && img.length < 3 * 1024 * 1024) {
          validImages.push(img);
        } else {
          return NextResponse.json({ error: '无效的图片地址或超出允许大小' }, { status: 400 });
        }
      }
    }

    const newFeedback = await prisma.feedback.create({
      data: {
        userId: payload.uid,
        content: content.trim(),
        images: validImages,
      }
    });

    return NextResponse.json({ success: true, data: newFeedback });
  } catch (error) {
    console.error('Feedback create err:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
