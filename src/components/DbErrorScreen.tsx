import { hardResetDatabase } from '@/lib/db';
import { Database, RefreshCcw, ShieldAlert } from 'lucide-react';

export function DbErrorScreen() {
  const handleReset = async () => {
    if (confirm("警告：此操作将永久清空本机所有的 Pace 任务数据且不可恢复！只有在您彻底卡死无法使用时才建议执行。是否继续？")) {
      try {
        await hardResetDatabase();
        window.location.reload();
      } catch (e) {
        alert("格式化失败，请前往系统设置彻底清空浏览器网站数据。");
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center animate-in fade-in duration-500">
      <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-sm border border-red-100">
        <ShieldAlert className="w-10 h-10" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">本地数据库挂起</h1>
      <p className="text-gray-500 mb-8 max-w-sm leading-relaxed text-sm">
        Safari 底层数据库引擎发生了死锁或文件损坏。请先尝试<strong className="text-gray-800">上滑彻底杀掉后台进程</strong>后重新打开。
      </p>
      
      <div className="space-y-4 w-full max-w-xs">
        <button 
          onClick={() => window.location.reload()} 
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-medium shadow-sm hover:bg-blue-700 transition-colors"
        >
          <RefreshCcw className="w-4 h-4" /> 刷新重试
        </button>
        <button 
          onClick={handleReset} 
          className="w-full flex items-center justify-center gap-2 py-3 bg-white text-red-600 border border-red-200 rounded-xl font-medium shadow-sm hover:bg-red-50 transition-colors"
        >
          <Database className="w-4 h-4" /> 强制全盘格式化自救
        </button>
      </div>
    </div>
  );
}
