import prisma from './prisma';
import { sendEmail } from './emailService';

// 使用 globalThis 防止开发环境下热重载导致多个定时器堆叠
declare global {
  var feedbackNotifierTimer: NodeJS.Timeout | undefined;
  var notifiedFeedbacks: Set<string>;
}

export function startFeedbackNotifier() {
  if (globalThis.feedbackNotifierTimer) return;
  
  globalThis.notifiedFeedbacks = globalThis.notifiedFeedbacks || new Set<string>();

  const isDev = process.env.NODE_ENV !== 'production';
  const intervalMs = isDev ? 10 * 1000 : 10 * 60 * 1000; // 开发环境 10 秒一测，生产环境 10 分钟

  console.log(`[Feedback Notifier] Background timer started (${isDev ? '10s' : '10m'} interval)`);

  globalThis.feedbackNotifierTimer = setInterval(async () => {
    try {
      const timeThreshold = new Date(Date.now() - intervalMs);

      // 每次巡检：查询创建时间超过阈值、且仍然是待处理（OPEN 且无 reply）的反馈
      const pendingFeedbacks = await prisma.feedback.findMany({
        where: {
          status: 'OPEN',
          reply: null,
          created_at: {
            lte: timeThreshold
          }
        },
        include: { user: true }
      });

      for (const fb of pendingFeedbacks) {
        // 如果在内存的 Set 中没发过通知，才发邮件
        if (!globalThis.notifiedFeedbacks.has(fb.id)) {
          const html = `
            <h2>新的用户反馈未处理超时提醒</h2>
            <p><strong>用户:</strong> ${fb.user?.nickname || fb.user?.email || fb.userId}</p>
            <p><strong>提交时间:</strong> ${fb.created_at.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
            <p><strong>反馈内容:</strong></p>
            <blockquote style="background:#f9f9f9;padding:10px;border-left:5px solid #ccc;margin-left:0;">
              ${fb.content.replace(/\n/g, '<br>')}
            </blockquote>
            <p style="color:#666;font-size:12px;margin-top:20px;">此邮件为系统后台自动巡检发现（距提交已过 ${isDev ? '10 秒' : '10 分钟'}），请及时登录后台查阅或处理。</p>
          `;
          
          if (isDev) {
            console.log(`\n[Feedback Notifier Dev Mock] ------------------`);
            console.log(`Would send email for feedback ID: ${fb.id}`);
            console.log(`To: pace-admin@hemin.vip | From: Pace通知 <noreply@hemin.vip>`);
            console.log(`Subject: 【Pace巡检提醒】有未处理的用户反馈等待处理`);
            console.log(`Content (HTML omitted for brevity)`);
            console.log(`-------------------------------------------------\n`);
          } else {
            await sendEmail({
              to: 'pace-admin@hemin.vip',
              from: 'Pace通知 <noreply@hemin.vip>',
              subject: '【Pace巡检提醒】有未处理的用户反馈等待处理',
              html
            });
          }

          // 记录到内存标志位，避免重复发送
          globalThis.notifiedFeedbacks.add(fb.id);
          console.log(`[Feedback Notifier] Sent delayed notification for feedback ID: ${fb.id}`);
        }
      }
    } catch (err) {
      console.error('[Feedback Notifier Error] Failed to process delayed feedback notification:', err);
    }
  }, intervalMs);
}
