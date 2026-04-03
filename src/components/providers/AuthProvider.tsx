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
          
          // Downward Sync: Cloud to Local Dexie
          try {
            const localProfile = await SettingsService.getProfile();
            if (localProfile?.name !== data.user.nickname || localProfile?.avatar !== data.user.avatar) {
               await SettingsService.setProfile(data.user.nickname || '', data.user.avatar || '');
               window.dispatchEvent(new Event('pace_profile_updated'));
            }
          } catch (e) {
            console.error('Downward profile sync failed', e)
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
