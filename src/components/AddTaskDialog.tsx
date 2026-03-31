'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Camera, Image as ImageIcon, PenLine, ListPlus } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { TaskStatus } from '@/lib/types';
import { TaskService } from '@/services/task-service';
import { StatsService } from '@/services/stats-service';
import { OcrService } from '@/services/ocr-service';
import { ImageCropper } from '@/components/ImageCropper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface AddTaskDialogProps {
  onTaskAdded?: () => void;
  defaultStatus?: TaskStatus;
}

export function AddTaskDialog({ onTaskAdded, defaultStatus = TaskStatus.PENDING }: AddTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [estTime, setEstTime] = useState<string>('25');
  const [actTime, setActTime] = useState<string>('15');
  const [isSchoolDone, setIsSchoolDone] = useState(false);
  const [tags, setTags] = useState<string>('');
  const [frequentTags, setFrequentTags] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [loading, setLoading] = useState(false);
  const [smartBufferSuggestion, setSmartBufferSuggestion] = useState<string | null>(null);
  
  // 批量添加状态
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [batchSelectedTags, setBatchSelectedTags] = useState<string[]>([]);
  const [tagInputText, setTagInputText] = useState('');

  // OCR 状态
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setSelectedImageUrl(url);
      setCropperOpen(true);
    }
    e.target.value = '';
  };

  const handleCropSave = async (base64Img: string) => {
    setIsProcessingOcr(true);
    try {
      const resultText = await OcrService.recognizeImage(base64Img);
      if (resultText && resultText.trim()) {
        setBatchText(prev => prev ? prev + '\n' + resultText : resultText);
        setBatchOpen(true);
        setCropperOpen(false);
      } else {
        alert('未识别到有效文本，请重试或检查图片是否清晰。');
      }
    } catch (e: any) {
      alert(e.message || 'OCR 识别出错');
    } finally {
      setIsProcessingOcr(false);
      // 可选：在这里清理 url，但保持弹窗可能需要重新裁剪（此处假设成功或失败后重置）
      if (!cropperOpen && selectedImageUrl) {
        URL.revokeObjectURL(selectedImageUrl);
        setSelectedImageUrl('');
      }
    }
  };
  const handleBatchTagClick = (tag: string) => {
    setBatchSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 忽略拼音输入法过程中的回车
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInputText.trim().replace(/^#/, '');
      if (val) {
        const newTags = val.split(/[,，]+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean);
        setBatchSelectedTags(prev => Array.from(new Set([...prev, ...newTags])));
      }
      setTagInputText('');
    } else if (e.key === 'Backspace' && tagInputText === '' && batchSelectedTags.length > 0) {
      setBatchSelectedTags(prev => prev.slice(0, -1));
    }
  };

  useEffect(() => {
    if (!batchOpen) {
      setBatchSelectedTags([]);
      setTagInputText('');
      setBatchText('');
    }
  }, [batchOpen]);

  useEffect(() => {
    if (open || batchOpen) {
      TaskService.getAll().then(allTasks => {
        const counts: Record<string, number> = {};
        allTasks.forEach(task => {
          task.tags.forEach(t => {
            counts[t] = (counts[t] || 0) + 1;
          });
        });
        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([tag]) => tag)
          .slice(0, 8); // 取前8个最常用的
        setFrequentTags(sorted);
      });
    }
  }, [open, batchOpen]);

  // 当标签发生变化时，防抖检查 Smart Buffer
  useEffect(() => {
    if (!open || !tags) {
       setSmartBufferSuggestion(null);
       return;
    }
    const currentTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    if (currentTags.length === 0) {
       setSmartBufferSuggestion(null);
       return;
    }
    
    const checkBuffer = async () => {
      for (const t of currentTags) {
        const result = await StatsService.checkSmartBuffer(t);
        if (result.active) {
           setSmartBufferSuggestion(`💡 根据最近的记录，做 #${t} 通常比预估多花 ${result.extraMinutes} 分钟。要不要把这次的预估调长一点？`);
           return;
        }
      }
      setSmartBufferSuggestion(null);
    };

    const timer = setTimeout(() => {
       checkBuffer();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [tags, open]);

  const handleTagClick = (t: string) => {
    const currentTags = tags.split(',').map(s => s.trim()).filter(Boolean);
    if (!currentTags.includes(t)) {
       setTags(currentTags.length > 0 ? `${tags}, ${t}` : t);
    }
  };

  const handleBatchSave = async () => {
    if (!batchText.trim()) return;

    setLoading(true);
    try {
      const rawLines = batchText.split('\n').map(l => l.trim()).filter(Boolean);
      const lines: string[] = [];
      const bulletRegex = /^(?:\[?(?:✓|v|√|校内完成)\]?)?\s*(?:[-*+]|\d+[.、])\s*(?:(?:✓|v|√)\s*)?$/i;
      const bulletPrefixRegex = /^(?:\[?(?:✓|v|√|校内完成)\]?)?\s*(?:[-*+]|\d+[.、])/i;

      for (let i = 0; i < rawLines.length; i++) {
        let line = rawLines[i];
        
        // 如果这行仅仅是个标号（如 "2." 或 "√ 2."），尝试合并下一行
        if (bulletRegex.test(line) && i + 1 < rawLines.length) {
          const nextLine = rawLines[i + 1];
          // 如果下一行不是一个新标号（也不是明确的组头），就合并，解决 OCR 换行断裂问题
          if (!bulletPrefixRegex.test(nextLine)) {
             line = line + ' ' + nextLine;
             i++;
          }
        }
        lines.push(line);
      }

      let currentGroupTag = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        let rawTitle = trimmed;
        let groupTagToAdd = '';

        // 判断当前行是否为子任务 (支持 - 或 * 或 + 或数字如 1. 1、 开头，允许包含前的 √)
        const subTaskMatch = line.match(/^(\s*(?:\[?(?:✓|v|√|校内完成)\]?\s*)?)(?:[-*+]|\d+[.、])\s*(.*)/i);
        if (subTaskMatch) {
          rawTitle = subTaskMatch[1] + subTaskMatch[2];
          groupTagToAdd = currentGroupTag; // 继承上方科目
        } else {
          // 当前不是子任务，判定它是普通的独立任务(Format 1)，还是科目组Header(Format 2)
          let isGroupHeader = false;
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            if (bulletPrefixRegex.test(nextLine)) {
              isGroupHeader = true;
            }
          }
          if (isGroupHeader) {
            // 解析Header可能自带的部分特殊符号（为了干净），一般就是纯文本，比如“语文”
            let headerName = trimmed.replace(/[:：\s]+$/, '');
            // 自动补全简略科目
            if (headerName === '语') headerName = '语文';
            if (headerName === '数') headerName = '数学';
            if (headerName === '英' || headerName === '外') headerName = '英语';
            
            currentGroupTag = headerName;
            continue; // 跳过，不创建任务
          } else {
            // 普通的第一种格式，清理掉先前的分组状态以防串连
            currentGroupTag = '';
          }
        }

        let isSchoolDone = false;
        let estTime = 25; // 默认时长
        let taskTags: string[] = [];
        let title = rawTitle;

        // 解析 [✓...] 或 ✓、√ 或 校内完成 (支持紧贴文本如 签字√)
        const schoolDoneMatch = title.match(/\[(✓|v|√|校内完成).*?\]/i) || title.match(/(✓|√|校内完成)/) || title.match(/(?:^|\s)v(?:\s|$)/i);
        if (schoolDoneMatch) {
          isSchoolDone = true;
          title = title.replace(schoolDoneMatch[0], '');
        }

        // 解析 [xxm] 或 xxm 或 xx分钟
        const timeMatch = title.match(/\[(\d+)\s*m?\]/i) || title.match(/(?:^|\s)(\d+)(m|分钟)(?:\s|$)/i);
        if (timeMatch) {
          estTime = parseInt(timeMatch[1] || timeMatch[2], 10);
          title = title.replace(timeMatch[0], '');
        }

        // 解析 [#标签1,标签2] 或 #标签1,标签2 (支持紧贴任务名，支持逗号后跟空格如 #课内, 数学)
        const tagMatch = title.match(/\[#(.*?)\]/) || title.match(/#([^\s,，]+(?:[,，]\s*[^\s,，]+)*)/);
        if (tagMatch) {
          const tagStr = tagMatch[1] || tagMatch[2];
          taskTags = tagStr.split(/[,，]+/).map(t => t.trim()).filter(Boolean);
          title = title.replace(tagMatch[0], '');
        }

        // 追加分组大标签并去重
        if (groupTagToAdd && !taskTags.includes(groupTagToAdd)) {
          taskTags.push(groupTagToAdd);
        }

        // 追加弹窗顶部统一选择的额外全局标签并去重
        batchSelectedTags.forEach(btag => {
          if (!taskTags.includes(btag)) {
            taskTags.push(btag);
          }
        });

        title = title.replace(/\s+/g, ' ').trim();
        if (!title) continue;

        await TaskService.create({
          title,
          est_time: isSchoolDone ? 0 : estTime,
          act_time: isSchoolDone ? estTime : 0, // 校内完成将其解析的时长作为实际时长
          tags: taskTags,
          is_school_done: isSchoolDone,
          status: isSchoolDone ? TaskStatus.COMPLETED : defaultStatus,
        });
      }

      setBatchText('');
      setBatchOpen(false);
      if (onTaskAdded) onTaskAdded();
    } catch (error) {
      console.error('Failed to parse batch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    setLoading(true);
    try {
      const tagArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await TaskService.create({
        title: title.trim(),
        description: description.trim() || undefined,
        est_time: isSchoolDone ? 0 : (parseInt(estTime, 10) || 0),
        act_time: isSchoolDone ? (parseInt(actTime, 10) || 0) : 0,
        tags: tagArray,
        is_school_done: isSchoolDone,
        status: isSchoolDone ? TaskStatus.COMPLETED : defaultStatus,
      });

      // 重置表单
      setTitle('');
      setEstTime('25');
      setActTime('15');
      setIsSchoolDone(false);
      setTags('');
      setDescription('');
      setShowDescription(false);
      setOpen(false);

      // 通知父组件刷新
      if (onTaskAdded) {
        onTaskAdded();
      }
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 隐藏的文件上传与拍照输入框 */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
        ref={cameraInputRef} 
        onChange={handleImageSelected} 
      />
      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleImageSelected} 
      />

      {/* 悬浮操作枢纽 */}
      <div className="fixed bottom-20 right-6 md:bottom-8 md:right-8 z-40">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 hover:scale-105 transition-transform" size="icon" />
            }
          >
            <Plus className="h-6 w-6 text-white" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" sideOffset={12} className="w-44 bg-white border-0 shadow-xl rounded-2xl p-2 animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 duration-200">
            <DropdownMenuItem 
              className="py-3 px-3 cursor-pointer text-gray-700 focus:bg-blue-50 focus:text-blue-700 rounded-xl font-medium transition-colors"
              onClick={() => cameraInputRef.current?.click()}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 mr-3">
                <Camera className="h-4 w-4 text-blue-600" />
              </div>
              <span>拍照录入</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              className="py-3 px-3 cursor-pointer text-gray-700 focus:bg-emerald-50 focus:text-emerald-700 rounded-xl font-medium transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 mr-3">
                <ImageIcon className="h-4 w-4 text-emerald-600" />
              </div>
              <span>相册上传</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              className="py-3 px-3 cursor-pointer text-gray-700 focus:bg-purple-50 focus:text-purple-700 rounded-xl font-medium transition-colors"
              onClick={() => setBatchOpen(true)}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 mr-3">
                <ListPlus className="h-4 w-4 text-purple-600" />
              </div>
              <span>批量添加</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              className="py-3 px-3 cursor-pointer text-gray-700 focus:bg-orange-50 focus:text-orange-700 rounded-xl font-medium transition-colors"
              onClick={() => setOpen(true)}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 mr-3">
                <PenLine className="h-4 w-4 text-orange-600" />
              </div>
              <span>手动填写</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 批量添加弹窗 */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>批量添加任务</DialogTitle>
            <DialogDescription>
              支持单行解析 (空格分隔) 或 树状层级解析：<br/>
              <code>语数英<br/>  - 修改试卷 45m<br/>  - 预习 #课内 30m ✓</code>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            
            {/* 批量应用全局标签输入框 */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500 ml-1">该批次附加的全局标签 (可选)</span>
              <div className="flex flex-wrap items-center gap-2 p-2 min-h-[42px] border border-input rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-shadow">
                {batchSelectedTags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-md font-medium">
                    #{tag}
                    <button 
                      type="button" 
                      onClick={() => handleBatchTagClick(tag)} 
                      className="text-blue-500 hover:text-blue-800 focus:outline-none ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInputText}
                  onChange={e => setTagInputText(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder={batchSelectedTags.length === 0 ? "输入全局标签名后按回车..." : ""}
                  className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                />
              </div>

              {/* 常用标签补全推荐 */}
              {frequentTags.filter(t => !batchSelectedTags.includes(t)).length > 0 && (
                <div className="flex flex-wrap gap-2 px-1 mt-1">
                  <span className="text-[10px] text-gray-400 mt-0.5">常用推荐:</span>
                  {frequentTags.filter(t => !batchSelectedTags.includes(t)).slice(0, 5).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleBatchTagClick(tag)}
                      className="px-2 py-0.5 text-[11px] rounded-full border border-dashed border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <textarea
              className="flex min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              placeholder={"数学\n  - 练习册复习 45m ✓\n语文\n  - 阅读报纸 #阅读 30m\n  - 背诵 15m"}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)}>取消</Button>
            <Button onClick={handleBatchSave} disabled={loading || !batchText.trim()}>
              {loading ? '解析中...' : '确认批量生成'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 单个添加弹窗 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>添加新任务</DialogTitle>
          <DialogDescription>
            录入一项新任务，它会自动排入你今天的节奏中。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">任务名称</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：完成数学试卷"
              className="col-span-3"
            />
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <input 
              type="checkbox" 
              id="is_school_done" 
              checked={isSchoolDone}
              onChange={(e) => setIsSchoolDone(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
            />
            <Label htmlFor="is_school_done" className="font-normal cursor-pointer text-gray-700">在校已完成 (直接记为完成不计时)</Label>
          </div>

          {!isSchoolDone ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="est_time">预估时长（分钟）</Label>
              <Input
                id="est_time"
                type="number"
                value={estTime}
                onChange={(e) => setEstTime(e.target.value)}
                className="col-span-3"
                min="1"
                max="1440"
                maxLength={4}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="act_time">实际用时（分钟）</Label>
              <Input
                id="act_time"
                type="number"
                value={actTime}
                onChange={(e) => setActTime(e.target.value)}
                className="col-span-3"
                min="1"
                max="1440"
                maxLength={4}
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="tags">标签（逗号分隔）</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="例如：数学,作业"
              className="col-span-3"
            />
            {frequentTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {frequentTags.map(tag => (
                  <button 
                    key={tag} 
                    type="button"
                    onClick={() => handleTagClick(tag)}
                    className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 border border-transparent transition-colors"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
            {smartBufferSuggestion && (
              <div className="text-sm text-orange-700 bg-orange-50/80 border border-orange-100 p-2.5 rounded-lg mt-2 font-medium animate-in fade-in slide-in-from-top-1">
                {smartBufferSuggestion}
              </div>
            )}
          </div>

          {/* 渐进式披露：详情（Markdown） */}
          {!showDescription ? (
            <button 
              type="button" 
              onClick={() => setShowDescription(true)}
              className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700 font-medium w-fit mt-2 group transition-all"
            >
              <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                 <PenLine className="w-3.5 h-3.5" />
              </div>
              添加任务指引或视频素材 (可选)
            </button>
          ) : (
            <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 mt-2">
              <Label htmlFor="description" className="flex items-center justify-between text-gray-700">
                <span className="flex items-center gap-1.5"><PenLine className="w-4 h-4 text-blue-500" /> 指南与素材 (支持 Markdown)</span>
                <button type="button" onClick={() => { setShowDescription(false); setDescription(''); }} className="text-xs text-gray-400 hover:text-red-500 font-medium">
                  清空并收起
                </button>
              </Label>
              <textarea
                id="description"
                className="flex min-h-[100px] max-h-[300px] w-full rounded-xl border border-input bg-blue-50/30 px-3 py-2 text-sm ring-offset-background placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 resize-y transition-shadow"
                placeholder="例如：课本第15页阅读，或者粘贴 B 站/YouTube 学习视频链接..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
          <Button onClick={handleSave} disabled={loading || !title.trim()}>
            {loading ? '保存中...' : '保存任务'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ImageCropper 
      open={cropperOpen} 
      onOpenChange={(open) => {
        if (!isProcessingOcr) setCropperOpen(open);
      }} 
      imageUrl={selectedImageUrl} 
      onCropSave={handleCropSave}
      isProcessing={isProcessingOcr}
    />
    </>
  );
}
