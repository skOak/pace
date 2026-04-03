import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload?.uid) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { uid: payload.uid as string }
    })

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        uid: user.uid,
        phone: user.phone,
        nickname: user.nickname,
        avatar: user.avatar,
        role: user.role,
        level: user.level
      }
    })

  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json({ error: '内部服务器错误' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) return NextResponse.json({ error: '未经授权' }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload?.uid) return NextResponse.json({ error: '无效会话' }, { status: 401 })

    const body = await req.json()
    const { nickname, avatar } = body

    const user = await prisma.user.update({
      where: { uid: payload.uid as string },
      data: {
        ...(nickname !== undefined && { nickname }),
        ...(avatar !== undefined && { avatar })
      }
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: '内部服务器错误' }, { status: 500 })
  }
}
