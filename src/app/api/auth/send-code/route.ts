import { NextResponse } from 'next/server'
import { saveVerificationCode, redis } from '@/lib/verificationStore'
import prisma from '@/lib/prisma'


export async function POST(req: Request) {
  try {
    const { email, turnstileToken } = await req.json()

    if (!email) {
      return NextResponse.json({ error: '请提供邮箱' }, { status: 400 })
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

    if (!email || !turnstileToken) {
      return NextResponse.json({ error: '邮箱和验证码(Token)为必填项' }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '请输入有效的邮箱地址' }, { status: 400 })
    }

    // Rate Limiting (60s)
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitKey = `rate_limit:email:${email}:${ip}`
    if (redis) {
      const isRateLimited = await redis.get(rateLimitKey)
      if (isRateLimited) {
         return NextResponse.json({ error: '发送过于频繁，请稍后再试（60秒一次）' }, { status: 429 })
      }
    }

    // Verify Cloudflare Turnstile token
    const secret = process.env.TURNSTILE_SECRET_KEY
    if (!secret) {
      console.error('TURNSTILE_SECRET_KEY is not defined')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const verifyFormData = new FormData()
    verifyFormData.append('secret', secret)
    verifyFormData.append('response', turnstileToken)

    const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: verifyFormData,
    })

    const turnstileOutcome = await turnstileRes.json()

    if (!turnstileOutcome.success && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: '人机验证失败，请重试' }, { status: 403 })
    }

    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    await saveVerificationCode(email, code)

    // Set Rate Limit
    if (redis) {
      await redis.setex(rateLimitKey, 60, '1')
    }

    // Send Email logic
    if (process.env.NODE_ENV === 'production') {
       try {
         const { sendEmail } = await import('@/lib/emailService');
         const result = await sendEmail({
           to: email,
           subject: '您的 Pace 登录验证码',
           html: `<p>您的验证码是 <strong>${code}</strong>，5分钟内有效。</p><p>如果您并未请求此验证码，请忽略本邮件。</p>`
         });
         console.log(`[AUTH] sent code via ${result.provider}`);
       } catch (err: any) {
          console.error('All email providers failed:', err.message);
          return NextResponse.json({ error: '邮件发送失败，请稍后重试或联系管理员' }, { status: 500 })
       }
    } else {
      console.log(`[MOCK EMAIL 开发环境] 验证码: ${code}，收件人: ${email}`)
    }

    return NextResponse.json({ success: true, message: '验证码发送成功' })

  } catch (error) {
    console.error('Error sending code:', error)
    return NextResponse.json({ error: '内部服务器错误' }, { status: 500 })
  }
}
