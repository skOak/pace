'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Search, ShieldAlert, Award, Ban, UserCheck, ChevronDown, ChevronRight, Activity, MapPin, Monitor, Clock, Target, CalendarDays, CheckCircle } from 'lucide-react';

type User = {
  uid: string;
  email: string;
  nickname: string;
  role: string;
  level: string;
  created_at: string;
  last_ip?: string;
  last_ua?: string;
  first_active_at?: string;
  last_active_at?: string;
  _count?: {
    tasks: number;
    habitTemplates: number;
    goals: number;
  }
};

export function UserManagementTable({ initialUsers, currentUserUid }: { initialUsers: User[], currentUserUid: string }) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchUsers(search);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const fetchUsers = async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (uid: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...updates } : u));
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, ...updates }),
      });
      if (!res.ok) fetchUsers(search);
    } catch (e) {
      fetchUsers(search);
    }
  };

  const toggleExpand = (uid: string) => {
    setExpandedRow(expandedRow === uid ? null : uid);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '未知';
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', { 
      year: 'numeric', month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">用户管理与活跃监控</h2>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索邮箱或昵称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64"
          />
        </div>
      </div>
      <div className="overflow-x-auto relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex justify-center z-10 items-center">
             <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        )}
        <table className="w-full text-sm text-left">
          <thead className="bg-white border-b border-gray-100">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-500 w-12"></th>
              <th className="px-6 py-3 font-medium text-gray-500">邮箱 / ID</th>
              <th className="px-6 py-3 font-medium text-gray-500">昵称</th>
              <th className="px-6 py-3 font-medium text-gray-500">状态/角色</th>
              <th className="px-6 py-3 font-medium text-gray-500">会员等级</th>
              <th className="px-6 py-3 font-medium text-gray-500 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(user => {
               const isBanned = user.role === 'BANNED';
               const isExpanded = expandedRow === user.uid;
               return (
               <React.Fragment key={user.uid}>
              <tr className={`hover:bg-slate-50 transition-colors cursor-pointer ${isBanned ? 'opacity-60' : ''}`} onClick={() => toggleExpand(user.uid)}>
                <td className="px-6 py-4 text-gray-400">
                  {isExpanded ? <ChevronDown className="w-5 h-5"/> : <ChevronRight className="w-5 h-5"/>}
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{user.email}</div>
                  <div className="font-mono text-xs text-gray-400 mt-1">{user.uid.slice(0, 8)}...</div>
                </td>
                <td className="px-6 py-4">{user.nickname || '-'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium 
                    ${isBanned ? 'bg-red-100 text-red-700' : user.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}
                  `}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${user.level === 'PRO' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-700'}`}>
                    {user.level} {user.level === 'PRO' && <Award className="w-3 h-3 inline-block ml-0.5 relative -top-[1px]"/>}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2" onClick={e => e.stopPropagation()}>
                   {user.level === 'FREE' ? (
                     <button onClick={() => updateUser(user.uid, { level: 'PRO' })} className="text-amber-600 hover:text-amber-700 text-xs font-medium border border-amber-200 bg-amber-50 px-2 py-1 rounded">设为 PRO</button>
                   ) : (
                     <button onClick={() => updateUser(user.uid, { level: 'FREE' })} className="text-gray-500 hover:text-gray-700 text-xs font-medium border border-gray-200 px-2 py-1 rounded">降级 FREE</button>
                   )}
                   
                   {user.uid !== currentUserUid && (
                     isBanned ? (
                       <button onClick={() => updateUser(user.uid, { role: 'USER' })} className="text-green-600 hover:text-green-700 text-xs font-medium px-2 py-1 rounded flex items-center gap-1 inline-flex"><UserCheck className="w-3 h-3"/> 解封</button>
                     ) : (
                       <button onClick={() => updateUser(user.uid, { role: 'BANNED' })} className="text-red-500 hover:text-red-600 text-xs font-medium px-2 py-1 rounded flex items-center gap-1 inline-flex"><Ban className="w-3 h-3"/> 封禁</button>
                     )
                   )}
                </td>
              </tr>
              {isExpanded && (
                <tr className="bg-slate-50 border-b border-gray-100">
                  <td colSpan={6} className="px-10 py-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                       <div className="space-y-4">
                          <h4 className="font-semibold text-gray-700 flex items-center gap-2 mb-3 border-b border-gray-200 pb-2"><Activity className="w-4 h-4 text-blue-500"/> 使用度统计</h4>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-3 rounded-lg border border-gray-200 text-center">
                              <div className="text-xs text-gray-500 flex items-center justify-center gap-1"><CheckCircle className="w-3 h-3"/> 任务数</div>
                              <div className="text-xl font-bold mt-1 text-gray-800">{user._count?.tasks || 0}</div>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-gray-200 text-center">
                              <div className="text-xs text-gray-500 flex items-center justify-center gap-1"><CalendarDays className="w-3 h-3"/> 习惯数</div>
                              <div className="text-xl font-bold mt-1 text-gray-800">{user._count?.habitTemplates || 0}</div>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-gray-200 text-center">
                              <div className="text-xs text-gray-500 flex items-center justify-center gap-1"><Target className="w-3 h-3"/> 目标数</div>
                              <div className="text-xl font-bold mt-1 text-gray-800">{user._count?.goals || 0}</div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 pt-2 text-xs text-gray-600">
                             <div className="flex justify-between items-center bg-white p-2 border border-gray-100 rounded">
                               <span className="text-gray-400">首次使用时间</span>
                               <span className="font-medium text-gray-800">{formatDate(user.first_active_at || user.created_at)}</span>
                             </div>
                             <div className="flex justify-between items-center bg-white p-2 border border-gray-100 rounded">
                               <span className="text-gray-400">最近活跃时间</span>
                               <span className="font-medium text-gray-800">{formatDate(user.last_active_at)}</span>
                             </div>
                          </div>
                       </div>
                       
                       <div className="space-y-4">
                          <h4 className="font-semibold text-gray-700 flex items-center gap-2 mb-3 border-b border-gray-200 pb-2"><Monitor className="w-4 h-4 text-purple-500"/> 设备特征采集</h4>
                          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
                            <div className="p-3">
                               <div className="text-xs text-gray-400 flex items-center gap-1 mb-1"><MapPin className="w-3 h-3"/> 最近登录 IP</div>
                               <div className="font-mono text-xs text-gray-800 break-all">{user.last_ip || '暂无数据'}</div>
                            </div>
                            <div className="p-3">
                               <div className="text-xs text-gray-400 flex items-center gap-1 mb-1"><Monitor className="w-3 h-3"/> 最近 User-Agent</div>
                               <div className="text-xs text-gray-600 leading-relaxed font-mono line-clamp-3" title={user.last_ua || '暂无数据'}>
                                 {user.last_ua || '暂无数据'}
                               </div>
                            </div>
                          </div>
                       </div>
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            )})}
            {users.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">未找到用户</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
