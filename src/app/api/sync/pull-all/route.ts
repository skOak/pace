import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
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

    // Fetch all user data concurrently
    const [tasks, execution_logs, daily_anchors, habit_templates, goals] = await Promise.all([
      prisma.task.findMany({ where: { userId } }),
      prisma.executionLog.findMany({ where: { userId } }),
      prisma.dailyAnchor.findMany({ where: { userId } }),
      prisma.habitTemplate.findMany({ where: { userId } }),
      prisma.goal.findMany({ 
        where: { userId },
        include: { comments: true }
      })
    ])

    // Reformat goals to match dexie
    const goal_comments = goals.flatMap(g => g.comments)
    const formattedGoals = goals.map((g: any) => {
      const { comments, userId, ...rest } = g
      return rest
    })

    return NextResponse.json({
      success: true,
      data: {
        tasks: tasks.map(({ userId, ...rest }: any) => rest),
        execution_logs: execution_logs.map(({ userId, ...rest }: any) => rest),
        daily_anchors: daily_anchors.map(({ userId, id, ...rest }: any) => rest),
        habit_templates: habit_templates.map(({ userId, ...rest }: any) => rest),
        goals: formattedGoals,
        goal_comments: goal_comments.map(({ id, goal_id, user_role, content, created_at }: any) => ({
          id, goal_id, user_role, content, created_at
        }))
      }
    })

  } catch (error) {
    console.error('Pull all error:', error)
    return NextResponse.json({ error: '加载云端数据失败' }, { status: 500 })
  }
}
