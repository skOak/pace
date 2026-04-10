import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: '未经授权' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload?.uid) {
      return NextResponse.json({ error: '无效会话' }, { status: 401 })
    }

    const userId = payload.uid as string
    const body = await req.json()

    const {
      tasks = [],
      execution_logs = [],
      daily_anchors = [],
      habit_templates = [],
      goals = [],
      goal_comments = []
    } = body

    await prisma.$transaction(async (tx: any) => {
      // 1. Wipe existing cloud data for this user to ensure clean handover
      await tx.task.deleteMany({ where: { userId } })
      await tx.dailyAnchor.deleteMany({ where: { userId } })
      await tx.habitTemplate.deleteMany({ where: { userId } })
      await tx.goal.deleteMany({ where: { userId } })
      // (ExecutionLogs and GoalComments are cascade deleted)

      // 2. Insert Goals (UUIDs can be preserved directly)
      if (goals.length > 0) {
        await tx.goal.createMany({
          data: goals.map((g: any) => {
            const goalEnumMap = ['ACTIVE', 'DONE', 'ARCHIVED'];
            const normalizedStatus = typeof g.status === 'number' ? (goalEnumMap[g.status] || 'ACTIVE') : g.status;
            return {
              id: g.id,
              title: g.title,
              description: g.description,
              total_estimated_duration: g.total_estimated_duration,
              deadline: g.deadline,
              difficulty: g.difficulty,
              confidence: g.confidence,
              status: normalizedStatus,
              created_at: new Date(g.created_at),
              updated_at: g.updated_at ? new Date(g.updated_at) : null,
              userId
            };
          })
        })
      }

      // 3. Insert Goal Comments
      if (goal_comments.length > 0) {
        await tx.goalComment.createMany({
          data: goal_comments.map((gc: any) => ({
            id: gc.id,
            goal_id: gc.goal_id,
            user_role: gc.user_role,
            content: gc.content,
            created_at: new Date(gc.created_at)
          }))
        })
      }

      // 4. Insert Habit Templates (UUIDs preserved)
      if (habit_templates.length > 0) {
        await tx.habitTemplate.createMany({
          data: habit_templates.map((ht: any) => ({
            id: ht.id,
            title: ht.title,
            estimated_duration: ht.estimated_duration,
            tags: ht.tags || [],
            frequency_type: ht.frequency_type,
            frequency_rule: ht.frequency_rule || [],
            end_type: ht.end_type,
            end_date: ht.end_date,
            end_occurrences: ht.end_occurrences,
            generated_count: ht.generated_count,
            status: ht.status,
            description: ht.description,
            difficulty: ht.difficulty,
            confidence: ht.confidence,
            created_at: new Date(ht.created_at),
            userId
          }))
        })
      }

      // 5. Insert Daily Anchors
      if (daily_anchors.length > 0) {
        await tx.dailyAnchor.createMany({
          data: daily_anchors.map((da: any) => ({
            date: da.date,
            start_anchor: da.start_anchor ? new Date(da.start_anchor) : null,
            end_anchor: da.end_anchor ? new Date(da.end_anchor) : null,
            userId
          }))
        })
      }

      // 6. Insert Tasks sequentially to remap the numeric IDs
      const taskIdMap = new Map<number, number>()
      for (const task of tasks) {
        const taskEnumMap = ['DRAFT', 'PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'EXPIRED'];
        const normalizedStatus = typeof task.status === 'number' ? (taskEnumMap[task.status] || 'DRAFT') : task.status;
        const newTask = await tx.task.create({
          data: {
            local_id: task.id,
            title: task.title,
            est_time: task.est_time,
            act_time: task.act_time,
            status: normalizedStatus,
            tags: task.tags || [],
            is_school_done: task.is_school_done,
            date: task.date,
            created_at: new Date(task.created_at),
            updated_at: new Date(task.updated_at),
            description: task.description,
            difficulty: task.difficulty,
            confidence: task.confidence,
            initial_estimated_duration: task.initial_estimated_duration,
            comments: task.comments,
            template_id: task.template_id,
            skip_reason: task.skip_reason,
            goal_id: task.goal_id,
            is_session: task.is_session,
            userId
          }
        })
        if (task.id !== undefined) {
          taskIdMap.set(task.id, newTask.id)
        }
      }

      // 7. Insert Execution Logs using remapped Task IDs
      if (execution_logs.length > 0) {
        const mappedLogs = execution_logs
          .filter((log: any) => taskIdMap.has(log.taskId))
          .map((log: any) => ({
            local_id: log.id,
            taskId: taskIdMap.get(log.taskId)!,
            startTime: new Date(log.startTime),
            endTime: log.endTime ? new Date(log.endTime) : null,
            userId
          }))

        if (mappedLogs.length > 0) {
          await tx.executionLog.createMany({
            data: mappedLogs
          })
        }
      }
    }, {
      timeout: 30000 // 30s timeout for large imports
    })

    return NextResponse.json({ success: true, message: '数据同步至云端成功' })

  } catch (error) {
    console.error('Import local error:', error)
    // 发生合并错误时，主动在核心链路切断已派发的 Cookie，防止产生“半只脚进入服务端但本地数据丢在门外”的僵尸状态
    const cookieStore = await cookies()
    cookieStore.delete('auth_token')
    return NextResponse.json({ error: '合并数据失败，请稍后重试，当前身份已安全释放' }, { status: 500 })
  }
}
