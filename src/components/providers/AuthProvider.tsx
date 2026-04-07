'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { SettingsService } from '@/services/settings-service'

export type AuthStatus = 'loading' | 'anonymous' | 'loggedIn'

export type User = {
  uid: string
  phone: string
  nickname: string
  avatar: string
  role: string
  level: string
}

type AuthContextType = {
  status: AuthStatus
  user: User | null
  refreshAuth: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)

  const refreshAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        if (data.user) {
          setUser(data.user)
          setStatus('loggedIn')
          
          // Silent tracking for admin activity stats
          fetch('/api/track/active', { method: 'POST' }).catch(() => {});
          
          // Downward Sync: Cloud to Local Dexie
          try {
            const localProfile = await SettingsService.getProfile();
            if (localProfile?.name !== data.user.nickname || localProfile?.avatar !== data.user.avatar) {
               await SettingsService.setProfile(data.user.nickname || '', data.user.avatar || '');
               window.dispatchEvent(new Event('pace_profile_updated'));
            }

            // If Dexie is empty (e.g. just logged in or new device), pull from cloud
            const { db } = await import('@/lib/db');
            const { SyncService } = await import('@/lib/sync-service');
            const taskCount = await db.tasks.count();
            if (taskCount === 0) {
              const pullRes = await fetch('/api/sync/pull-all');
              if (pullRes.ok) {
                 SyncService.setPullingState(true);
                 try {
                   const { data: pullData } = await pullRes.json();
                   await db.transaction('rw', 
                     [db.tasks, db.execution_logs, db.daily_anchors, db.habit_templates, db.goals, db.goal_comments], 
                     async () => {
                       if (pullData.tasks?.length) await db.tasks.bulkPut(pullData.tasks);
                       if (pullData.execution_logs?.length) await db.execution_logs.bulkPut(pullData.execution_logs);
                       if (pullData.daily_anchors?.length) await db.daily_anchors.bulkPut(pullData.daily_anchors);
                       if (pullData.habit_templates?.length) await db.habit_templates.bulkPut(pullData.habit_templates);
                       if (pullData.goals?.length) await db.goals.bulkPut(pullData.goals);
                       if (pullData.goal_comments?.length) await db.goal_comments.bulkPut(pullData.goal_comments);
                   });
                   console.log("已成功从云端拉取并恢复所有数据到本地 Dexie");
                 } finally {
                   SyncService.setPullingState(false);
                 }
              }
            }
          } catch (e) {
            console.error('Downward profile or data sync failed', e)
          }

          return
        }
      }
      setUser(null)
      setStatus('anonymous')
    } catch (e) {
      setUser(null)
      setStatus('anonymous')
    }
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setStatus('anonymous')
    // Data wipe (db.clear) will be orchestrated where we import the Dexie db instance.
  }

  useEffect(() => {
    import('@/lib/sync-service').then(m => m.SyncService.bootstrapSyncHooks());
    refreshAuth()
  }, [])

  return (
    <AuthContext.Provider value={{ status, user, refreshAuth, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
