import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyCode } from '@/lib/verificationStore'
import prisma from '@/lib/prisma'
import { signToken } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const { phone, code, role = 'USER', nickname, avatar, checkOnly } = await req.json()

    if (!phone || !code) {
      return NextResponse.json({ error: '手机号和验证码必填' }, { status: 400 })
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: '请输入11位有效的中国内地手机号' }, { status: 400 })
    }

    const isValid = verifyCode(phone, code)
    if (!isValid && code !== '888888') { // Backdoor for easy testing, remove in prod
      return NextResponse.json({ error: '验证码错误或已过期' }, { status: 401 })
    }

    // Check if user exists, else create
    let user = await prisma.user.findUnique({
      where: { phone }
    })

    if (user && user.role === 'BANNED') {
      return NextResponse.json({ error: '对不起，此账号已被封禁。如有疑问请联系管理员。' }, { status: 403 })
    }

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

    const taskCount = await prisma.task.count({ where: { userId: user.uid } })
    const goalCount = await prisma.goal.count({ where: { userId: user.uid } })
    const hasCloudData = taskCount > 0 || goalCount > 0

    if (checkOnly) {
      return NextResponse.json({
        success: true,
        isNewUser,
        hasCloudData,
        handoverToken: token,
        user: {
          uid: user.uid,
          phone: user.phone,
          nickname: user.nickname,
          avatar: user.avatar,
          role: user.role,
          level: user.level
        }
      })
    }

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
      hasCloudData,
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
