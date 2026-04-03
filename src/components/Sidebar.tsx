'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Home, Inbox, Settings, PieChart, Repeat, Target, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskService } from '@/services/task-service';
import { SettingsService } from '@/services/settings-service';
import { TaskStatus } from '@/lib/types';
import { useAuth } from '@/components/providers/AuthProvider';
import { LoginHandoverDialog } from './auth/LoginHandoverDialog';
import { Cloud, WifiOff, LogOut } from 'lucide-react';
import { db } from '@/lib/db';
import { ConfirmDialog } from './ConfirmDialog';

const navItems = [
  { name: '今天', href: '/', icon: Home },
  { name: '收集箱', href: '/inbox', icon: Inbox },
  { name: '目标', href: '/goals', icon: Target },
  { name: '习惯', href: '/habits', icon: Repeat },
  { name: '洞察', href: '/insights', icon: PieChart },
  { name: '设置', href: '/settings', icon: Settings },
  { name: '指南', href: '/guide', icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();
  const { status, user, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [completedRatio, setCompletedRatio] = useState(0);
  const [profileName, setProfileName] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');

  const fetchProfile = async () => {
    const profile = await SettingsService.getProfile();
    if (profile) {
      setProfileName(profile.name || '');
      setProfileAvatar(profile.avatar || '');
    }
  };

  useEffect(() => {
    fetchProfile();
    window.addEventListener('pace_profile_updated', fetchProfile);
    return () => window.removeEventListener('pace_profile_updated', fetchProfile);
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchProgress = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const allTasks = await TaskService.getByDate(today);
        if (!mounted) return;
        
        if (allTasks.length === 0) {
          setCompletedRatio(0);
          return;
        }
        
        const completedCount = allTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
        setCompletedRatio(Math.round((completedCount / allTasks.length) * 100));
      } catch (err) {
        console.error('Failed to fetch sidebar progress', err);
      }
    };

    fetchProgress();
    // 采用短轮询方式保持侧边栏进度条与主数据的高频同步 (纯本地 IndexedDB 查询性能无损)
    const timer = setInterval(fetchProgress, 2000); 
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    await db.delete(); // Hard delete IDB completely
    window.location.reload();
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 md:w-72 flex-col border-r bg-background/80 backdrop-blur-xl md:flex shadow-sm">
      <div className="flex flex-col px-6 py-4 border-b gap-3">
        <div className="flex h-12 items-center gap-3">
          {user?.avatar || profileAvatar ? (
            <img src={user?.avatar || profileAvatar} alt="Avatar" className="w-8 h-8 rounded-full border border-gray-200 object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-teal-400 shrink-0" />
          )}
          <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent line-clamp-1 flex-1">
            {profileName || user?.nickname || 'Pace'}
          </h1>
        </div>

        {/* Auth Status Check & Handover */}
        <div className="flex items-center justify-between bg-gray-100 rounded-lg p-2 text-xs font-medium">
          {status === 'loggedIn' ? (
            <div className="flex items-center gap-1.5 text-green-600">
               <Cloud className="w-3.5 h-3.5" /> 云端同步 ({user?.role === 'ASSISTANT' ? '协助' : '标准'})
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-gray-500">
               <WifiOff className="w-3.5 h-3.5" /> 纯离线模式
            </div>
          )}
          
          {status === 'loggedIn' ? (
             <button onClick={() => setLogoutConfirmOpen(true)} className="text-gray-400 hover:text-red-500 transition-colors" title="注销"><LogOut className="w-3.5 h-3.5"/></button>
          ) : (
             <button onClick={() => setLoginOpen(true)} className="text-blue-500 hover:text-blue-600 transition-colors px-1 py-0.5">云接管</button>
          )}
        </div>
      </div>
      
      <LoginHandoverDialog open={loginOpen} onOpenChange={setLoginOpen} />
      <ConfirmDialog 
        open={logoutConfirmOpen} 
        onOpenChange={setLogoutConfirmOpen}
        title="确认注销？"
        description="注销账号将会清空当前本地的所有已同步离线缓存并退回纯离线模式，确认退出？"
        confirmText="注销并清空"
        isDestructive={true}
        onConfirm={handleLogout}
      />

      <nav className="flex-1 space-y-2 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-blue-50 text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:bg-gray-100/50 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive ? 'text-blue-500' : 'text-gray-400')} />
              {item.name}
            </Link>
          );
        })}
      </nav>
      {/* Bottom section if needed */}
      <div className="p-4 border-t border-gray-100">
        <div className="rounded-xl bg-gray-50 p-4">
          <div className="flex justify-between items-center text-xs font-medium text-gray-500 mb-2">
            <span>找到你的节奏 (Find your Pace)</span>
            {completedRatio > 0 && <span className="text-blue-500">{completedRatio}%</span>}
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${completedRatio}%` }}
            ></div>
          </div>
        </div>
      </div>
    </aside>
  );
}
