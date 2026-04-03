'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, ShieldAlert, Award, Ban, UserCheck } from 'lucide-react';

type User = {
  uid: string;
  phone: string;
  nickname: string;
  role: string;
  level: string;
  created_at: string;
};

export function UserManagementTable({ initialUsers, currentUserUid }: { initialUsers: User[], currentUserUid: string }) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // 避免每次按键刷新，加入简易防抖
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
    // 乐观更新
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...updates } : u));
    
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, ...updates }),
      });
      if (!res.ok) {
        // 如果失败，回滚拉取
        fetchUsers(search);
      }
    } catch (e) {
      fetchUsers(search);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">用户管理</h2>
        
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索手机号或昵称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64"
          />
        </div>
      </div>
      <div className="overflow-x-auto relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex justify-center items-center">
             <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        )}
        <table className="w-full text-sm text-left">
          <thead className="bg-white border-b border-gray-100">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-500">手机号 / ID</th>
              <th className="px-6 py-3 font-medium text-gray-500">昵称</th>
              <th className="px-6 py-3 font-medium text-gray-500">状态/角色</th>
              <th className="px-6 py-3 font-medium text-gray-500">会员等级</th>
              <th className="px-6 py-3 font-medium text-gray-500 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(user => {
               const isBanned = user.role === 'BANNED';
               return (
              <tr key={user.uid} className={`hover:bg-slate-50 transition-colors ${isBanned ? 'opacity-60' : ''}`}>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{user.phone}</div>
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
                <td className="px-6 py-4 text-right space-x-2">
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
            )})}
            {users.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">未找到用户</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
