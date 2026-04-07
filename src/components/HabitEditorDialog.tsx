'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PenLine, Trash2, Star, StarHalf } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HabitService } from '@/services/habit-service';
import type { HabitTemplate } from '@/lib/types';
import { cn } from '@/lib/utils';

interface HabitEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit?: HabitTemplate | null;
  onSave: (habitId: string) => void;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MONTHDAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export function HabitEditorDialog({ open, onOpenChange, habit, onSave }: HabitEditorDialogProps) {
  const [title, setTitle] = useState('');
  const [estTime, setEstTime] = useState<string>('25');
  const [tags, setTags] = useState('');
  
  const [frequencyType, setFrequencyType] = useState<'Weekly' | 'Monthly'>('Weekly');
  const [weeklyRule, setWeeklyRule] = useState<number[]>([1, 2, 3, 4, 5]);
  const [monthlyRule, setMonthlyRule] = useState<number[]>([1]);
  
  const [endType, setEndType] = useState<'never' | 'date' | 'occurrences'>('never');
  const [endDate, setEndDate] = useState<string>('');
  const [endOccurrences, setEndOccurrences] = useState<string>('10');
  
  const [status, setStatus] = useState<'active' | 'paused' | 'archived'>('active');
  const [description, setDescription] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [difficulty, setDifficulty] = useState<number>(3);
  const [confidence, setConfidence] = useState<boolean>(true);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (habit) {
        setTitle(habit.title);
        setEstTime(habit.estimated_duration.toString());
        setTags(habit.tags.join(', '));
        
        setFrequencyType(habit.frequency_type);
        if (habit.frequency_type === 'Weekly') {
          setWeeklyRule([...habit.frequency_rule]);
        } else {
          setMonthlyRule([...habit.frequency_rule]);
        }
        
        setEndType(habit.end_type || 'never');
        setEndDate(habit.end_date || '');
        setEndOccurrences(habit.end_occurrences ? habit.end_occurrences.toString() : '10');
        
        setStatus(habit.status || 'active');
        setDescription(habit.description || '');
        setShowDescription(!!habit.description);
        setDifficulty(habit.difficulty ?? 3);
        setConfidence(habit.confidence ?? true);
      } else {
        setTitle('');
        setEstTime('25');
        setTags('');
        setFrequencyType('Weekly');
        setWeeklyRule([1, 2, 3, 4, 5]);
        setMonthlyRule([1]);
        setEndType('never');
        setEndDate('');
        setEndOccurrences('10');
        setStatus('active');
        setDescription('');
        setShowDescription(false);
        setDifficulty(3);
        setConfidence(true);
      }
    }
  }, [open, habit]);

  const toggleRule = (val: number) => {
    if (frequencyType === 'Weekly') {
      setWeeklyRule(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val].sort((a, b) => a - b));
    } else {
      setMonthlyRule(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val].sort((a, b) => a - b));
    }
  };

  const setWeeklyPreset = (type: 'everyday' | 'schooldays' | 'weekends' | 'clear') => {
    if (type === 'everyday') setWeeklyRule([1, 2, 3, 4, 5, 6, 7]);
    if (type === 'schooldays') setWeeklyRule([1, 2, 3, 4, 5]);
    if (type === 'weekends') setWeeklyRule([6, 7]);
    if (type === 'clear') setWeeklyRule([]);
  };

  const getSummaryText = () => {
    const currentRule = frequencyType === 'Weekly' ? weeklyRule : monthlyRule;
    if (currentRule.length === 0) return '未选择任何日期，模板将不会自动生成任务';
    
    if (frequencyType === 'Weekly') {
      if (currentRule.length === 7) return '每天自动在“今天”生成任务';
      if (currentRule.join(',') === '1,2,3,4,5') return '每逢上学日 (周一至五) 自动生成';
      if (currentRule.join(',') === '6,7') return '每逢周末自动生成';
      
      const days = currentRule.map(d => WEEKDAYS[d - 1]).join(', ');
      return `每逢周 [${days}] 自动在“今天”生成任务`;
    } else {
      return `每月 [${currentRule.join(', ')}] 日自动在“今天”生成任务`;
    }
  };

  const handleSave = async () => {
    const currentRule = frequencyType === 'Weekly' ? weeklyRule : monthlyRule;
    if (!title.trim() || currentRule.length === 0) return;

    setLoading(true);
    try {
      const tagArray = tags.split(/[,，\s;；]+/).map(t => t.trim()).filter(Boolean);
      const estTimeNum = parseInt(estTime, 10) || 25;
      
      const habitData = {
        title: title.trim(),
        estimated_duration: estTimeNum,
        tags: tagArray,
        description: description.trim() || undefined,
        difficulty,
        confidence,
        frequency_type: frequencyType,
        frequency_rule: currentRule,
        end_type: endType,
        end_date: endType === 'date' ? endDate : undefined,
        end_occurrences: endType === 'occurrences' ? (parseInt(endOccurrences, 10) || 1) : undefined,
        status
      };

      if (habit) {
        await HabitService.update(habit.id, habitData);
        onSave(habit.id);
      } else {
        const newId = await HabitService.create(habitData);
        onSave(newId);
      }
      
      onOpenChange(false);
    } catch (e) {
      console.error('Failed to save habit', e);
    } finally {
      setLoading(false);
    }
  };

  const currentRule = frequencyType === 'Weekly' ? weeklyRule : monthlyRule;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{habit ? '编辑习惯模板' : '创建习惯模板'}</DialogTitle>
          <DialogDescription>
            设定期望培养的习惯节奏，应用会在对应日期自动生成任务。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">习惯名称</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：背单词 50 个"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col gap-2 flex-1">
              <Label htmlFor="estTime">常规预估时长 (分钟)</Label>
              <Input
                id="estTime"
                type="number"
                value={estTime}
                onChange={(e) => setEstTime(e.target.value)}
                min="1"
                max="1440"
              />
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <Label htmlFor="tags">分类标签</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="例如：英语, 课内"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center justify-between">
              <Label>重复规则</Label>
              <div className="bg-gray-100 p-1 rounded-lg flex items-center gap-1">
                <button 
                  className={cn("text-xs px-3 py-1 rounded-md transition-colors", frequencyType === 'Weekly' ? "bg-white text-blue-600 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700")}
                  onClick={() => setFrequencyType('Weekly')}
                >
                  按周
                </button>
                <button 
                  className={cn("text-xs px-3 py-1 rounded-md transition-colors", frequencyType === 'Monthly' ? "bg-white text-blue-600 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700")}
                  onClick={() => setFrequencyType('Monthly')}
                >
                  按月
                </button>
              </div>
            </div>

            {frequencyType === 'Weekly' ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center gap-1">
                  {WEEKDAYS.map((day, idx) => {
                    const val = idx + 1;
                    const selected = weeklyRule.includes(val);
                    return (
                      <button
                        key={val}
                        onClick={() => toggleRule(val)}
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                          selected ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50" onClick={() => setWeeklyPreset('everyday')}>每天</button>
                  <button className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50" onClick={() => setWeeklyPreset('schooldays')}>上学日</button>
                  <button className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50" onClick={() => setWeeklyPreset('weekends')}>周末</button>
                  <button className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-400 hover:bg-gray-100 ml-auto" onClick={() => setWeeklyPreset('clear')}>清空</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1.5">
                {MONTHDAYS.map(day => {
                  const selected = monthlyRule.includes(day);
                  return (
                    <button
                      key={day}
                      onClick={() => toggleRule(day)}
                      className={cn(
                        "h-8 rounded-md flex items-center justify-center text-xs font-medium transition-all",
                        selected ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            )}
            
            <p className="text-xs text-blue-700 bg-blue-50 p-2 rounded-lg font-medium border border-blue-100 mt-1">
              {getSummaryText()}
            </p>
          </div>
          
          <div className="flex flex-col gap-2 mt-2 pt-4 border-t border-gray-100">
            <Label>结束重复</Label>
            <div className="flex gap-2 mt-1">
               <button 
                  className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors", endType === 'never' ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50")}
                  onClick={() => setEndType('never')}
               >
                 一直重复
               </button>
               <button 
                  className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors", endType === 'date' ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50")}
                  onClick={() => setEndType('date')}
               >
                 按日期结束
               </button>
               <button 
                  className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors", endType === 'occurrences' ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50")}
                  onClick={() => setEndType('occurrences')}
               >
                 按次数结束
               </button>
            </div>
            {endType === 'date' && (
              <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                 <Input 
                   type="date" 
                   value={endDate}
                   onChange={(e) => setEndDate(e.target.value)}
                   className="w-full sm:w-1/2"
                 />
              </div>
            )}
            {endType === 'occurrences' && (
              <div className="mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                 <span className="text-sm text-gray-600">共重复</span>
                 <Input 
                   type="number" 
                   value={endOccurrences}
                   onChange={(e) => setEndOccurrences(e.target.value)}
                   className="w-20"
                   min="1"
                 />
                 <span className="text-sm text-gray-600">次后结束</span>
              </div>
            )}
          </div>

          {/* 选项组：难度与信心 */}
          <div className="flex items-center justify-between gap-4 mt-2">
            <div className="flex flex-col gap-2">
              <Label>任务难度指数</Label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={cn(
                      "w-7 h-7 flex items-center justify-center rounded-full transition-all border",
                      difficulty >= level ? "bg-orange-100 border-orange-200 text-orange-500" : "bg-gray-50 border-gray-100 text-gray-300 hover:bg-gray-100"
                    )}
                  >
                    <Star className={cn("w-4 h-4", difficulty >= level && "fill-current")} />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <Label>信心指标</Label>
              <button
                type="button"
                onClick={() => setConfidence(!confidence)}
                className={cn(
                  "px-4 h-8 rounded-full text-xs font-medium border flex items-center justify-center transition-all",
                  confidence 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                    : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                )}
              >
                {confidence ? '成竹在胸 ✌️' : '需要反思 🤔'}
              </button>
            </div>
          </div>

          {/* 渐进式披露：详情（Markdown） */}
          {!showDescription ? (
            <button 
              type="button" 
              onClick={() => setShowDescription(true)}
              className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700 font-medium w-fit mt-1 group transition-all"
            >
              <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                 <PenLine className="w-3.5 h-3.5" />
              </div>
              添加习惯详情指引或视频素材 (可选)
            </button>
          ) : (
            <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 mt-1">
              <Label htmlFor="description" className="flex items-center justify-between text-gray-700">
                <span className="flex items-center gap-1.5"><PenLine className="w-4 h-4 text-blue-500" /> 指南与素材 (Markdown)</span>
                <button type="button" onClick={() => { setShowDescription(false); setDescription(''); }} className="text-xs text-gray-400 hover:text-red-500 font-medium">
                  清空并收起
                </button>
              </Label>
              <MarkdownEditor
                id="description"
                className="bg-blue-50/30"
                placeholder="例如：每日打卡动作要点，支持贴入 B 站视频链接、随时可点击下方按钮上传附件..."
                value={description}
                onValueChange={setDescription}
              />
            </div>
          )}

          {habit && (
            <div className="flex flex-col gap-2 mt-2 pt-4 border-t border-gray-100">
              <Label className="text-gray-700">执行状态</Label>
              <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setStatus('active')}
                  className={cn(
                    "text-xs px-4 py-1.5 rounded-md transition-all font-medium flex items-center gap-1.5",
                    status === 'active' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  🚀 激活中
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('paused')}
                  className={cn(
                    "text-xs px-4 py-1.5 rounded-md transition-all font-medium flex items-center gap-1.5",
                    status === 'paused' ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  🏖️ 临时放假
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {status === 'active' 
                  ? '系统将根据规则为你自动生成打卡任务。' 
                  : '放假期间，该习惯将暂停自动生成任务，历史数据仍会保留。'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center w-full justify-end gap-2">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>取消</Button>
          <Button className="w-full sm:w-auto" onClick={handleSave} disabled={loading || !title.trim() || currentRule.length === 0}>
            {loading ? '保存中...' : '保存习惯'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
