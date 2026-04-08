import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

async function verifySuperAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload?.role === 'SUPER_ADMIN';
}

export async function GET(req: Request) {
  if (!(await verifySuperAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const keysParam = searchParams.get('keys');
  
  if (keysParam === 'ocr_quotas') {
    const config = await prisma.systemConfig.findUnique({ where: { key: 'ocr_quotas' } });
    return NextResponse.json({ ocrQuotas: config ? JSON.parse(config.value) : null });
  }

  const configs = await prisma.systemConfig.findMany();
  const configMap = configs.reduce((acc: Record<string, string>, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
  
  return NextResponse.json({ 
    configs: configMap,
    data: configMap['ocr_configs'] ? JSON.parse(configMap['ocr_configs']) : []
  });
}

export async function POST(req: Request) {
  if (!(await verifySuperAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const { ocrConfigs, ocrQuotas, key, value } = body;
  
  if (ocrConfigs) {
    await prisma.systemConfig.upsert({
      where: { key: 'ocr_configs' },
      update: { value: JSON.stringify(ocrConfigs) },
      create: { key: 'ocr_configs', value: JSON.stringify(ocrConfigs) }
    });
  }

  if (ocrQuotas) {
    await prisma.systemConfig.upsert({
      where: { key: 'ocr_quotas' },
      update: { value: JSON.stringify(ocrQuotas) },
      create: { key: 'ocr_quotas', value: JSON.stringify(ocrQuotas) }
    });
  }

  if (key !== undefined && value !== undefined) {
    await prisma.systemConfig.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) }
    });
  }
  
  return NextResponse.json({ success: true });
}
