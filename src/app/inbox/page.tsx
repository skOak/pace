'use client';

import { useState, useEffect, useCallback } from 'react';
import { TaskService } from '@/services/task-service';
import { TaskStatus, type Task } from '@/lib/types';
import { ensureDbReady } from '@/lib/db';
import { DbErrorScreen } from '@/components/DbErrorScreen';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Inbox, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function InboxPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      await ensureDbReady();
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('数据读取超时')), 5000));
      // 获取所有草稿任务
      const allTasks = await Promise.race([
        TaskService.getByStatus(TaskStatus.DRAFT),
        timeoutPromise
      ]) as Task[];
      setTasks(allTasks);
    } catch (error: any) {
      console.error('加载任务失败:', error);
      setDbError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleDeleteConfirm = async () => {
    if (!taskToDelete?.id) return;
    try {
      await TaskService.delete(taskToDelete.id);
      setTaskToDelete(null);
      await loadTasks();
    } catch (error) {
      console.error('删除任务失败:', error);
    }
  };

  const handleMoveToToday = async (id: number) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await TaskService.update(id, { status: TaskStatus.PENDING, date: today });
      await loadTasks();
    } catch (error) {
      console.error('移动任务失败:', error);
    }
  };

  if (dbError) {
    return <DbErrorScreen />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-400 font-medium">加载收集箱中...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8 animate-in mt-4 pb-24">
      {/* 顶部标题区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <Inbox className="h-8 w-8 text-blue-500" />
            收集箱
          </h1>
          <p className="text-gray-500 mt-1">
            快速捕获任何想法与待办 {tasks.length > 0 && `(${tasks.length})`}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {tasks.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <p className="text-4xl mb-4">📭</p>
            <p className="text-gray-500 font-medium">收集箱空空如也</p>
            <p className="text-sm text-gray-400 mt-1">点击右下角按钮添加一个想法</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {tasks.map((task) => (
              <Card key={task.id} className="border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800">{task.title}</h3>
                    {task.tags.length > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {task.tags.map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* 操作区 */}
                  <div className="flex items-center gap-2 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-red-500 h-8 w-8"
                      onClick={() => setTaskToDelete(task)}
                      title="删除草稿"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 px-3 gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 font-medium"
                      onClick={() => task.id && handleMoveToToday(task.id)}
                      title="排入今天"
                    >
                      <ArrowRight className="h-4 w-4" />
                      今天
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      </div>

      {/* 添加草稿的 FAB 置于动画外层 */}
      <AddTaskDialog onTaskAdded={loadTasks} defaultStatus={TaskStatus.DRAFT} />

      {/* 删除草稿确认对话框 */}
      <Dialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确定删除草稿？</DialogTitle>
            <DialogDescription>
              草稿 <strong>{taskToDelete?.title}</strong> 将被永久删除。此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setTaskToDelete(null)}>取消</Button>
            <Button variant="destructive" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteConfirm}>确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
