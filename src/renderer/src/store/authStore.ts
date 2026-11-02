import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '../types'
import { signOut } from '../lib/auth'
import { userCan, type PrivilegeAction } from '../lib/permissions'

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  setUser: (user: AuthUser) => void
  logout: () => void
  /** Whether the account may do `action` (default: view) in the module `privilege`. */
  hasPrivilege: (privilege: string, action?: PrivilegeAction) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      logout: () => {
        // Clear local state first so the SIGNED_OUT event this triggers is a no-op.
        set({ user: null, isAuthenticated: false })
        void signOut()
      },
      hasPrivilege: (privilege, action = 'view') => userCan(get().user, privilege, action)
    }),
    // main/index.ts clears this key (and the Supabase session) when the window closes.
    { name: 'lis-auth' }
  )
)
