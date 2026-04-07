import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json();
    if (!path) return NextResponse.json({ success: false }, { status: 400 });

    const forwardedFor = req.headers.get('x-forwarded-for');
    let realIp = req.headers.get('x-real-ip') || (req as any).ip || '';
    if (forwardedFor) {
       realIp = forwardedFor.split(',')[0].trim();
    }
    const ua = req.headers.get('user-agent') || '';

    // Calculate YYYY-MM-DD
    const now = new Date();
    // Offset local timezone if needed, or simply use UTC for global apps. Using UTC here for simplicity.
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Async tracking insertion
    await prisma.siteVisitLog.create({
      data: {
        ip: realIp.substring(0, 45), // Support IPv6 max length safely
        ua: ua.substring(0, 255),
        path: path.substring(0, 255),
        date_str: dateStr
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Visit track error:', error);
    return NextResponse.json({ success: false }); 
  }
}
