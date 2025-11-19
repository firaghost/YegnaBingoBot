import { useEffect, useState } from 'react'

/**
 * Hook to persist page state (tabs, filters, search, etc.) to localStorage
 * Automatically saves state on change and restores on mount
 */
export function usePageState<T>(pageKey: string, initialState: T): [T, (state: T) => void] {
  const [state, setState] = useState<T>(initialState)
  const [isHydrated, setIsHydrated] = useState(false)

  // Restore state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`page_state_${pageKey}`)
      if (stored) {
        setState(JSON.parse(stored))
      }
    } catch (error) {
      console.warn(`Failed to restore page state for ${pageKey}:`, error)
    }
    setIsHydrated(true)
  }, [pageKey])

  // Save state to localStorage whenever it changes (after hydration)
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(`page_state_${pageKey}`, JSON.stringify(state))
      } catch (error) {
        console.warn(`Failed to save page state for ${pageKey}:`, error)
      }
    }
  }, [state, pageKey, isHydrated])

  return [state, setState]
}

/**
 * Hook to persist a single value to localStorage
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue)
  const [isHydrated, setIsHydrated] = useState(false)

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const item = localStorage.getItem(key)
      if (item) {
        setStoredValue(JSON.parse(item))
      }
    } catch (error) {
      console.warn(`Failed to restore localStorage value for ${key}:`, error)
    }
    setIsHydrated(true)
  }, [key])

  // Save to localStorage whenever value changes
  const setValue = (value: T) => {
    try {
      setStoredValue(value)
      if (isHydrated) {
        localStorage.setItem(key, JSON.stringify(value))
      }
    } catch (error) {
      console.warn(`Failed to save localStorage value for ${key}:`, error)
    }
  }

  return [storedValue, setValue]
}
