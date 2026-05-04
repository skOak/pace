import prisma from './prisma';
import { sendEmail } from './emailService';

// 使用 globalThis 防止开发环境下热重载导致多个定时器堆叠
declare global {
  var feedbackNotifierTimer: NodeJS.Timeout | undefined;
  var notifiedFeedbacks: Set<string>;
}

export function startFeedbackNotifier() {
  if (globalThis.feedbackNotifierTimer) return;
  
  const isDev = process.env.NODE_ENV !== 'production';
  const intervalMs = isDev ? 10 * 1000 : 10 * 60 * 1000; // 开发环境 10 秒一测，生产环境 10 分钟

  console.log(`[Feedback Notifier] Background timer started (${isDev ? '10s' : '10m'} interval)`);

  globalThis.feedbackNotifierTimer = setInterval(async () => {
    try {
      const timeThreshold = new Date(Date.now() - intervalMs);

      // 1. 查询创建时间超过阈值、且仍然是待处理（OPEN 且无 reply）的反馈
      const pendingFeedbacks = await prisma.feedback.findMany({
        where: {
          status: 'OPEN',
          reply: null,
          created_at: {
            lte: timeThreshold
          }
        },
        include: { user: true },
        orderBy: { created_at: 'desc' }
      });

      if (pendingFeedbacks.length === 0) return;

      // 2. 从持久化配置中读取上一次已经通知过的反馈 ID 列表
      const configKey = 'NOTIFIED_FEEDBACK_IDS';
      const configRecord = await prisma.systemConfig.findUnique({ where: { key: configKey } });
      let previouslyNotifiedIds: string[] = [];
      if (configRecord && configRecord.value) {
        try { previouslyNotifiedIds = JSON.parse(configRecord.value); } catch (e) {}
      }

      // 3. 筛选出哪些是“新增的未通知反馈”
      const newFeedbacks = pendingFeedbacks.filter(fb => !previouslyNotifiedIds.includes(fb.id));

      // 4. 只有存在至少 1 条新反馈时，才触发汇总邮件
      if (newFeedbacks.length > 0) {
        // 生成汇总邮件内容 (包含所有待处理的)
        const html = `
          <h2>有新的用户反馈等待处理</h2>
          <p style="color:#d97706;font-weight:bold;">本次新增了 ${newFeedbacks.length} 条待处理反馈，目前积压的总计有 ${pendingFeedbacks.length} 条。</p>
          <hr style="border:0;border-top:1px solid #eee;margin:20px 0;" />
          
          ${pendingFeedbacks.map(fb => `
            <div style="margin-bottom: 20px; ${!previouslyNotifiedIds.includes(fb.id) ? 'border-left: 4px solid #ef4444; padding-left: 10px;' : 'border-left: 4px solid #ccc; padding-left: 10px; opacity: 0.8;'}">
              <p style="margin: 0 0 5px 0;">
                ${!previouslyNotifiedIds.includes(fb.id) ? '<strong style="color:#ef4444;">[新增]</strong> ' : ''}
                <strong>用户:</strong> ${fb.user?.nickname || fb.user?.email || fb.userId} 
                <span style="color:#888;font-size:12px;margin-left:10px;">${fb.created_at.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</span>
              </p>
              <blockquote style="background:#f9f9f9;padding:10px;margin:0;">
                ${fb.content.replace(/\n/g, '<br>')}
              </blockquote>
            </div>
          `).join('')}
          
          <p style="color:#666;font-size:12px;margin-top:20px;">此邮件为系统后台自动巡检发现并合并发送，请及时登录后台查阅或处理。</p>
        `;
        
        if (isDev) {
          console.log(`\n[Feedback Notifier Dev Mock] ------------------`);
          console.log(`Would send BATCH email for ${newFeedbacks.length} new feedbacks (Total: ${pendingFeedbacks.length})`);
          console.log(`To: pace-admin@hemin.vip | From: Pace通知 <noreply@hemin.vip>`);
          console.log(`Subject: 【Pace巡检提醒】有 ${pendingFeedbacks.length} 条未处理的用户反馈`);
          console.log(`-------------------------------------------------\n`);
        } else {
          await sendEmail({
            to: 'pace-admin@hemin.vip',
            from: 'Pace通知 <noreply@hemin.vip>',
            subject: `【Pace巡检提醒】有 ${pendingFeedbacks.length} 条未处理的用户反馈`,
            html
          });
        }

        // 5. 将当前所有 pending 的反馈 ID 覆写回持久化配置中
        // 这样已解决的反馈也会自然从这个名单中淘汰掉，保持轻量
        const currentPendingIds = pendingFeedbacks.map(f => f.id);
        await prisma.systemConfig.upsert({
          where: { key: configKey },
          update: { value: JSON.stringify(currentPendingIds) },
          create: { key: configKey, value: JSON.stringify(currentPendingIds) }
        });
        
        console.log(`[Feedback Notifier] Sent batched notification for ${newFeedbacks.length} new feedbacks.`);
      }
    } catch (err) {
      console.error('[Feedback Notifier Error] Failed to process batched feedback notification:', err);
    }
  }, intervalMs);
}
