import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    const cookieStore = await cookies()
    cookieStore.set({
      name: 'auth_token',
      value: '',
      httpOnly: true,
      path: '/',
      expires: new Date(0)
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: '内部服务器错误' }, { status: 500 })
  }
}
