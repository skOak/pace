import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyCode } from '@/lib/verificationStore'
import prisma from '@/lib/prisma'
import { signToken } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const { email, code, nickname, avatar, checkOnly } = await req.json()

    if (!email || !code) {
      return NextResponse.json({ error: '邮箱和验证码必填' }, { status: 400 })
    }

    const { ALLOWED_EMAIL_DOMAINS } = await import('@/lib/constants');
    const isValidFormat = /^[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+\.[a-zA-Z0-9_.-]+$/.test(email);
    const domainPart = email.substring(email.lastIndexOf('@'));

    if (!isValidFormat || !ALLOWED_EMAIL_DOMAINS.includes(domainPart)) {
      return NextResponse.json({ error: '邮箱格式无效或域名不受支持' }, { status: 400 })
    }

    const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    const isTargetSuperAdmin = superAdminEmails.includes(email.toLowerCase());

    const globalLockConfig = await prisma.systemConfig.findUnique({ where: { key: 'GLOBAL_LOGIN_ENABLED' } });
    const isGlobalLoginEnabled = globalLockConfig?.value === 'true';

    if (!isGlobalLoginEnabled && !isTargetSuperAdmin) {
      return NextResponse.json({ error: '系统目前为内测锁定状态，暂不开放公众注册与登录。' }, { status: 403 });
    }

    const isValid = await verifyCode(email, code)
    if (!isValid) {
      if (process.env.NODE_ENV !== 'production' && code === '888888') {
        console.log(`[AUTH MOCK] 开发环境放行验证码绕过: ${email}`);
      } else {
        return NextResponse.json({ error: '验证码错误或已过期' }, { status: 401 })
      }
    }

    // Check if user exists, else create
    let user = await prisma.user.findUnique({
      where: { email }
    })

    if (user && user.role === 'BANNED') {
      return NextResponse.json({ error: '对不起，此账号已被封禁。如有疑问请联系管理员。' }, { status: 403 })
    }

    let isNewUser = false
    const assignedRole = isTargetSuperAdmin ? 'SUPER_ADMIN' : 'USER'

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          role: assignedRole,
          nickname: nickname || email.split('@')[0],
          avatar: avatar || ''
        }
      })
      isNewUser = true
    } else {
      const needsRoleUpgrade = isTargetSuperAdmin && user.role !== 'SUPER_ADMIN'
      if (nickname || avatar || needsRoleUpgrade) {
        user = await prisma.user.update({
          where: { email },
          data: {
            ...(nickname && { nickname }),
            ...(avatar && { avatar }),
            ...(needsRoleUpgrade && { role: 'SUPER_ADMIN' })
          }
        })
      }
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
          email: user.email,
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
        email: user.email,
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
