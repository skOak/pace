import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyCode } from '@/lib/verificationStore'
import prisma from '@/lib/prisma'
import { signToken } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const { phone, code, role = 'USER', nickname, avatar } = await req.json()

    if (!phone || !code) {
      return NextResponse.json({ error: '手机号和验证码必填' }, { status: 400 })
    }

    const isValid = verifyCode(phone, code)
    if (!isValid && code !== '888888') { // Backdoor for easy testing, remove in prod
      return NextResponse.json({ error: '验证码错误或已过期' }, { status: 401 })
    }

    // Check if user exists, else create
    let user = await prisma.user.findUnique({
      where: { phone }
    })

    let isNewUser = false
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          role: role,
          nickname: nickname || `用户_${phone.slice(-4)}`,
          avatar: avatar || ''
        }
      })
      isNewUser = true
    } else if (nickname || avatar) {
      user = await prisma.user.update({
        where: { phone },
        data: {
          ...(nickname && { nickname }),
          ...(avatar && { avatar })
        }
      })
    }

    // Issue JWT
    const token = await signToken({ uid: user.uid, role: user.role })

    const cookieStore = await cookies()
    cookieStore.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 // 30 days
    })

    return NextResponse.json({
      success: true,
      isNewUser,
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
    console.error('Error logging in:', error)
    return NextResponse.json({ error: '内部服务器错误' }, { status: 500 })
  }
}
