'use client';

import { useState, useEffect, useCallback } from 'react';
import { TaskService } from '@/services/task-service';
import { TaskStatus, type Task } from '@/lib/types';

/**
 * Sprint 1 验证页面
 * 用于确认 IndexedDB 数据持久化正常工作
 */
export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);

  /** 加载所有任务 */
  const loadTasks = useCallback(async () => {
    try {
      const allTasks = await TaskService.getAll();
      setTasks(allTasks);
    } catch (error) {
      console.error('加载任务失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  /** 添加测试任务 */
  const handleAddTask = async () => {
    if (!title.trim()) return;

    try {
      await TaskService.create({
        title: title.trim(),
        est_time: 30,
        tags: ['测试'],
      });
      setTitle('');
      await loadTasks();
    } catch (error) {
      console.error('创建任务失败:', error);
    }
  };

  /** 删除任务 */
  const handleDelete = async (id: number) => {
    try {
      await TaskService.delete(id);
      await loadTasks();
    } catch (error) {
      console.error('删除任务失败:', error);
    }
  };

  /** 状态标签颜色 */
  const statusColor: Record<TaskStatus, string> = {
    [TaskStatus.DRAFT]: 'bg-gray-200 text-gray-700',
    [TaskStatus.PENDING]: 'bg-blue-100 text-blue-700',
    [TaskStatus.RUNNING]: 'bg-blue-500 text-white',
    [TaskStatus.PAUSED]: 'bg-yellow-200 text-yellow-800',
    [TaskStatus.COMPLETED]: 'bg-green-200 text-green-700',
    [TaskStatus.EXPIRED]: 'bg-orange-200 text-orange-700',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-500">加载中...</p>
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">🎯 Pace — Sprint 1 验证</h1>
      <p className="text-gray-500 mb-8">
        在此页面测试 IndexedDB 数据持久化。添加任务后刷新页面，数据应保持不变。
      </p>

      {/* 添加任务表单 */}
      <div className="flex gap-3 mb-8">
        <input
          id="task-title-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
          placeholder="输入任务名称..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
        />
        <button
          id="add-task-btn"
          onClick={handleAddTask}
          className="px-6 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium cursor-pointer"
        >
          添加任务
        </button>
      </div>

      {/* 任务列表 */}
      {tasks.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p>暂无任务，点击上方按钮添加</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-gray-100"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusColor[task.status]}`}
                >
                  {task.status}
                </span>
                <span className="font-medium text-gray-800">{task.title}</span>
                <span className="text-sm text-gray-400">
                  预估 {task.est_time} 分钟
                </span>
              </div>
              <button
                onClick={() => task.id !== undefined && handleDelete(task.id)}
                className="text-red-400 hover:text-red-600 transition-colors text-sm cursor-pointer"
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 统计信息 */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl text-sm text-gray-500">
        <p>📊 共 {tasks.length} 条任务 | 数据存储在浏览器 IndexedDB (PaceDB)</p>
        <p className="mt-1">
          💡 打开 DevTools → Application → IndexedDB → PaceDB 查看原始数据
        </p>
      </div>
    </main>
  );
}
