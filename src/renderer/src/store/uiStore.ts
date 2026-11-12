import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'

interface UIState {
  theme: Theme
  sidebarCollapsed: boolean
  toggleTheme: () => void
  setSidebarCollapsed: (v: boolean) => void
}

/** Light mode is a class on <html>, same as GSPIS Admin (see index.css). */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('light', theme === 'light')
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      sidebarCollapsed: false,
      toggleTheme: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
        set({ theme: next })
        applyTheme(next)
      },
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v })
    }),
    {
      name: 'lis-ui',
      // v1 made light the default: reset the theme saved by earlier builds once
      version: 1,
      migrate: (persisted) => ({ ...(persisted as UIState), theme: 'light' }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      }
    }
  )
)
