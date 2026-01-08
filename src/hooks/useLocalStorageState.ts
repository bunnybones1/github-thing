import { useEffect, useState } from 'react'

export const useLocalStorageState = <T>(key: string, defaultValue: T) => {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue
    const stored = window.localStorage.getItem(key)
    if (stored === null) return defaultValue
    try {
      return JSON.parse(stored) as T
    } catch {
      return stored as T
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // Ignore write failures.
    }
  }, [key, state])

  return [state, setState] as const
}
