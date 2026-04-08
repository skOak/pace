import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { redis } from '@/lib/verificationStore';

export async function GET() {
  try {
    // Check Database
    await prisma.$queryRaw`SELECT 1`;
    
    // Check Redis if configured
    let redisStatus = 'not_configured';
    if (redis) {
      const ping = await redis.ping();
      redisStatus = ping === 'PONG' ? 'connected' : 'error';
    }

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      redis: redisStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      status: 'error',
      database: 'disconnected or error',
      message: 'Service unavailable'
    }, { status: 503 });
  }
}
