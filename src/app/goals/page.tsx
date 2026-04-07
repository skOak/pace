'use client';

import { useEffect, useState } from 'react';
import { Target, Plus } from 'lucide-react';
import { GoalService } from '@/services/goal-service';
import { type Goal } from '@/lib/types';
import { GoalCard } from '@/components/goals/goal-card';
import { GoalEditorDialog } from '@/components/goals/goal-editor-dialog';

export default function GoalsPage() {
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [completedGoals, setCompletedGoals] = useState<Goal[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const allGoals = await GoalService.getAll();
      
      allGoals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setActiveGoals(allGoals.filter(g => g.status === 'ACTIVE' || !g.status));
      // 将完成或者归档的目标都当作已结束
      setCompletedGoals(allGoals.filter(g => g.status === 'DONE' || g.status === 'ARCHIVED'));
    } catch (err) {
      console.error('Failed to load goals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  return (
    <div className="flex-1 p-4 md:p-8 pt-6 max-w-5xl mx-auto w-full space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
            目标 (Goals)
          </h2>
          <p className="text-muted-foreground mt-1">
            将长期挑战拆解为微小的行动片段，稳步向前。
          </p>
        </div>
        <button
          onClick={() => setIsEditorOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all hover:shadow hover:-translate-y-0.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="font-medium">新目标</span>
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : activeGoals.length === 0 && completedGoals.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
            <Target className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">还没有长期目标</h3>
          <p className="text-sm text-gray-500 max-w-sm mb-6">
            设定一个大目标（例如读完一本书、完成一次大作业），然后通过记录进度来循序渐进地完成它。
          </p>
          <button
            onClick={() => setIsEditorOpen(true)}
            className="flex items-center gap-2 px-6 py-2 bg-white hover:bg-gray-50 text-blue-600 border border-gray-200 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            开始设定第一个目标
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {activeGoals.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {activeGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} onUpdate={fetchGoals} />
              ))}
            </div>
          )}

          {completedGoals.length > 0 && (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                已结束的目标
              </h3>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 opacity-70 hover:opacity-100 transition-opacity">
                {completedGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} onUpdate={fetchGoals} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <GoalEditorDialog
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        onGoalSaved={fetchGoals}
      />
    </div>
  );
}
