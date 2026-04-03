import { expect, test, describe } from 'vitest'
import { saveVerificationCode, verifyCode } from '../lib/verificationStore'
import { signToken, verifyToken } from '../lib/auth'

describe('Verification Store', () => {
  test('saves and verifies code', () => {
    saveVerificationCode('13800000000', '123456', 300)
    expect(verifyCode('13800000000', '123456')).toBe(true)
    expect(verifyCode('13800000000', '123456')).toBe(false) // code gets cleared upon successful verification
  })

  test('rejects incorrect code', () => {
    saveVerificationCode('13800000001', '123456', 300)
    expect(verifyCode('13800000001', '654321')).toBe(false) // wrong code
    expect(verifyCode('13800000001', '123456')).toBe(true) // right code later
  })

  test('expires correctly', () => {
    saveVerificationCode('13800000002', '111111', -1) // expire instantly
    expect(verifyCode('13800000002', '111111')).toBe(false)
  })
})

describe('JWT Lib', () => {
  test('signs and verifies JWT', async () => {
    const token = await signToken({ uid: 'foo' })
    const payload = await verifyToken(token)
    expect(payload?.uid).toBe('foo')
  })
})
