import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import type { SyncQueueItem } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = payload.uid;
    const body = await req.json();
    const ops: SyncQueueItem[] = body.ops || [];

    if (ops.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    await prisma.$transaction(async (tx: any) => {
      for (const op of ops) {
        if (!op.table || !op.action || op.recordId === undefined) continue;

        const table = op.table;
        const action = op.action;
        const data = op.payload;
        // Stringify recordId for robust DB lookups where string id is expected
        const stringId = op.recordId.toString();
        // Numeric local id for tasks and execution logs
        const localId = typeof op.recordId === 'number' ? op.recordId : parseInt(stringId, 10);
        // Data normalization for legacy locally cached Numeric enums
        if (data && typeof data.status === 'number') {
           if (table === 'tasks') {
              const taskEnumMap = ['DRAFT', 'PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'EXPIRED'];
              data.status = taskEnumMap[data.status] || 'DRAFT';
           } else if (table === 'goals') {
              const goalEnumMap = ['ACTIVE', 'DONE', 'ARCHIVED'];
              data.status = goalEnumMap[data.status] || 'ACTIVE';
           }
        }

        try {
          if (table === 'tasks') {
            if (action === 'create' || action === 'update') {
              await tx.task.upsert({
                where: { userId_local_id: { userId, local_id: localId } },
                create: {
                  local_id: localId,
                  userId,
                  title: data.title || '无标题任务',
                  est_time: data.est_time || 0,
                  act_time: data.act_time || 0,
                  status: data.status || 'DRAFT',
                  tags: data.tags || [],
                  is_school_done: !!data.is_school_done,
                  date: data.date || new Date().toISOString().slice(0,10),
                  created_at: new Date(data.created_at || Date.now()),
                  updated_at: new Date(data.updated_at || Date.now()),
                  description: data.description,
                  difficulty: data.difficulty,
                  confidence: data.confidence,
                  initial_estimated_duration: data.initial_estimated_duration,
                  comments: data.comments,
                  template_id: data.template_id,
                  skip_reason: data.skip_reason,
                  goal_id: data.goal_id,
                  is_session: data.is_session
                },
                update: {
                  title: data.title,
                  est_time: data.est_time,
                  act_time: data.act_time,
                  status: data.status,
                  tags: data.tags,
                  is_school_done: data.is_school_done,
                  date: data.date,
                  updated_at: new Date(data.updated_at || Date.now()),
                  description: data.description,
                  difficulty: data.difficulty,
                  confidence: data.confidence,
                  initial_estimated_duration: data.initial_estimated_duration,
                  comments: data.comments,
                  template_id: data.template_id,
                  skip_reason: data.skip_reason,
                  goal_id: data.goal_id,
                  is_session: data.is_session
                }
              });
            } else if (action === 'delete') {
              await tx.task.deleteMany({
                where: { userId, local_id: localId }
              });
            }
          }
          else if (table === 'execution_logs') {
            if (action === 'create' || action === 'update') {
               // Must resolve task cloud ID first
               const parentTask = await tx.task.findUnique({
                 where: { userId_local_id: { userId, local_id: data.taskId } }
               });
               if (parentTask) {
                 await tx.executionLog.upsert({
                   where: { userId_local_id: { userId, local_id: localId } },
                   create: {
                     local_id: localId,
                     userId,
                     taskId: parentTask.id,
                     startTime: new Date(data.startTime),
                     endTime: data.endTime ? new Date(data.endTime) : null
                   },
                   update: {
                     startTime: new Date(data.startTime),
                     endTime: data.endTime ? new Date(data.endTime) : null
                   }
                 });
               }
            } else if (action === 'delete') {
               await tx.executionLog.deleteMany({
                 where: { userId, local_id: localId }
               });
            }
          }
          else if (table === 'daily_anchors') {
            if (action === 'create' || action === 'update') {
              await tx.dailyAnchor.upsert({
                where: { userId_date: { userId, date: data.date || stringId } },
                create: {
                   userId,
                   date: data.date || stringId,
                   time_woke_up: data.time_woke_up,
                   time_slept: data.time_slept
                },
                update: {
                   time_woke_up: data.time_woke_up,
                   time_slept: data.time_slept
                }
              });
            } else if (action === 'delete') {
               await tx.dailyAnchor.deleteMany({
                 where: { userId, date: stringId }
               });
            }
          }
          else if (table === 'habit_templates') {
             if (action === 'create' || action === 'update') {
               await tx.habitTemplate.upsert({
                 where: { id: stringId, userId },
                 create: {
                   id: stringId,
                   userId,
                   title: data.title || '',
                   target_days: data.target_days || [],
                   target_count_per_week: data.target_count_per_week,
                   icon: data.icon,
                   color: data.color,
                   created_at: new Date(data.created_at || Date.now()),
                   archived: data.archived || false
                 },
                 update: {
                   title: data.title,
                   target_days: data.target_days,
                   target_count_per_week: data.target_count_per_week,
                   icon: data.icon,
                   color: data.color,
                   archived: data.archived
                 }
               });
             } else if (action === 'delete') {
                await tx.habitTemplate.deleteMany({
                  where: { id: stringId, userId }
                });
             }
          }
          else if (table === 'goals') {
             if (action === 'create' || action === 'update') {
               await tx.goal.upsert({
                 where: { id: stringId, userId },
                 create: {
                   id: stringId,
                   userId,
                   title: data.title || '',
                   description: data.description,
                   status: data.status || 'IN_PROGRESS',
                   deadline: data.deadline,
                   created_at: new Date(data.created_at || Date.now()),
                   updated_at: new Date(data.updated_at || Date.now())
                 },
                 update: {
                   title: data.title,
                   description: data.description,
                   status: data.status,
                   deadline: data.deadline,
                   updated_at: new Date(data.updated_at || Date.now())
                 }
               });
             } else if (action === 'delete') {
                await tx.goal.deleteMany({
                  where: { id: stringId, userId }
                });
             }
          }
          else if (table === 'goal_comments') {
             if (action === 'create' || action === 'update') {
               await tx.goalComment.upsert({
                 where: { id: stringId, userId },
                 create: {
                   id: stringId,
                   userId,
                   goal_id: data.goal_id,
                   content: data.content || '',
                   created_at: new Date(data.created_at || Date.now())
                 },
                 update: {
                   content: data.content
                 }
               });
             } else if (action === 'delete') {
                await tx.goalComment.deleteMany({
                  where: { id: stringId, userId }
                });
             }
          }
        } catch (opError) {
          console.error(`Failed to process operation on ${table}:`, opError);
          // throw opError; // optionally fail the whole transaction
        }
      }
    });

    return NextResponse.json({ success: true, count: ops.length });
  } catch (err: any) {
    console.error('Incremental Push Error:', err);
    return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
  }
}
