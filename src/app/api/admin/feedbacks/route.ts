import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function verifySuperAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload?.role === 'SUPER_ADMIN';
}

export async function GET(req: Request) {
  if (!(await verifySuperAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const feedbacks = await prisma.feedback.findMany({
    where: status ? { status } : undefined,
    include: {
      user: {
        select: { email: true, nickname: true, avatar: true }
      }
    },
    orderBy: { created_at: 'desc' }
  });

  return NextResponse.json({ data: feedbacks });
}

export async function PUT(req: Request) {
  if (!(await verifySuperAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, status, reply } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const updated = await prisma.feedback.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(reply !== undefined && { reply })
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
