import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/emailService';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyToken(token);
    if (payload?.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      return NextResponse.json({ error: '参数 [to, subject, html] 是必填项' }, { status: 400 });
    }

    const result = await sendEmail({ to, subject, html });

    return NextResponse.json({
      success: true,
      provider: result.provider,
      message: `测试邮件投递完成！目前最终成功送出的通道是：${result.provider}`
    });
  } catch (error: any) {
    console.error('Test email sending failed:', error.message);
    return NextResponse.json({ error: error.message || '邮件发送过程中完全失败，主备线路均失效' }, { status: 500 });
  }
}
