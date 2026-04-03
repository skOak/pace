import { NextResponse } from 'next/server'
import { saveVerificationCode } from '@/lib/verificationStore'

export async function POST(req: Request) {
  try {
    const { phone, turnstileToken } = await req.json()

    if (!phone || !turnstileToken) {
      return NextResponse.json({ error: '手机号和验证码(Token)为必填项' }, { status: 400 })
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

    if (!turnstileOutcome.success) {
      return NextResponse.json({ error: '人机验证失败，请重试' }, { status: 403 })
    }

    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    saveVerificationCode(phone, code)

    // In a real app, integrate SMS provider (e.g., Aliyun SMS) here
    console.log(`[MOCK SMS] 发送验证码 ${code} 到手机号 ${phone}`)

    return NextResponse.json({ success: true, message: '验证码发送成功' })

  } catch (error) {
    console.error('Error sending code:', error)
    return NextResponse.json({ error: '内部服务器错误' }, { status: 500 })
  }
}
