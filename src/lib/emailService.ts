import prisma from '@/lib/prisma';
import { Resend } from 'resend';

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  // 1. 获取数据库中的主选记录
  const config = await prisma.systemConfig.findUnique({ where: { key: 'PRIMARY_MAIL_PROVIDER' } });
  const primaryProvider = config?.value === 'SMTP2GO' ? 'SMTP2GO' : 'RESEND';

  const tryResend = async () => {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) throw new Error("RESEND_API_KEY is not configured");

    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Pace <noreply@pace.app>',
      to,
      subject,
      html
    });

    if (error) throw new Error(error.message);
  };

  const trySmtp2go = async () => {
    const smtp2goApiKey = process.env.SMTP2GO_API_KEY;
    if (!smtp2goApiKey) throw new Error("SMTP2GO_API_KEY is not configured");

    const fallbackRes = await fetch('https://api.smtp2go.com/v3/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: smtp2goApiKey,
        to: [to],
        sender: process.env.EMAIL_FROM || 'Pace <noreply@pace.app>',
        subject: subject,
        html_body: html
      })
    });

    const fallbackData = await fallbackRes.json();
    if (!fallbackRes.ok || fallbackData.data?.succeeded === 0) {
      throw new Error(fallbackData.data?.failures?.[0] || 'SMTP2GO via HTTP Failed');
    }
  };

  // 2. 根据 primaryProvider 尝试发送，带有自动降级
  if (primaryProvider === 'RESEND') {
    try {
      await tryResend();
      return { success: true, provider: 'Resend' };
    } catch (err: any) {
      console.warn('Resend failed as primary, falling back to SMTP2GO:', err.message);
      try {
        await trySmtp2go();
        return { success: true, provider: 'SMTP2GO (降级回退通道)' };
      } catch (fallbackErr: any) {
        throw new Error(`[通道全断] 首选 Resend 失败(${err.message || '未知'})，且降级 SMTP2GO 亦失败(${fallbackErr.message || '未知'})`);
      }
    }
  } else {
    try {
      await trySmtp2go();
      return { success: true, provider: 'SMTP2GO' };
    } catch (err: any) {
      console.warn('SMTP2GO failed as primary, falling back to Resend:', err.message);
      try {
        await tryResend();
        return { success: true, provider: 'Resend (降级回退通道)' };
      } catch (fallbackErr: any) {
        throw new Error(`[通道全断] 首选 SMTP2GO 失败(${err.message || '未知'})，且降级 Resend 亦失败(${fallbackErr.message || '未知'})`);
      }
    }
  }
}
