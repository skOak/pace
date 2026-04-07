import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ success: false }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload?.uid) return NextResponse.json({ success: false }, { status: 401 });

    const uid = payload.uid as string;
    
    const forwardedFor = req.headers.get('x-forwarded-for');
    let realIp = req.headers.get('x-real-ip') || (req as any).ip || '';
    if (forwardedFor) {
       realIp = forwardedFor.split(',')[0].trim();
    }
    const ua = req.headers.get('user-agent') || '';

    // Optimistically update
    const user = await prisma.user.findUnique({
      where: { uid },
      select: { first_active_at: true }
    });

    if (user) {
      await prisma.user.update({
        where: { uid },
        data: {
          last_ip: realIp,
          last_ua: ua,
          last_active_at: new Date(),
          ...(user.first_active_at === null ? { first_active_at: new Date() } : {})
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Track active API error:', error);
    return NextResponse.json({ success: false }); // Always return 200/silent on error
  }
}
