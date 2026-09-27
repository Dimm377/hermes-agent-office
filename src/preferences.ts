import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

function readStored(key: string): string | null {
  try { return window.localStorage.getItem(key) } catch { return null }
}

function writeStored(key: string, value: string): void {
  try { window.localStorage.setItem(key, value) } catch { /* storage may be blocked */ }
}

export function initialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = readStored('mc.theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/** Theme and sidebar preferences, remembered per browser. */
export function usePreferences() {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [sidebarHidden, setSidebarHidden] = useState(() => typeof window !== 'undefined' && readStored('mc.sidebar') === 'hidden')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writeStored('mc.theme', theme)
  }, [theme])
  useEffect(() => { writeStored('mc.sidebar', sidebarHidden ? 'hidden' : 'shown') }, [sidebarHidden])

  return {
    theme,
    toggleTheme: () => setTheme((value) => (value === 'dark' ? 'light' : 'dark')),
    sidebarHidden,
    toggleSidebar: () => setSidebarHidden((value) => !value),
  }
}
