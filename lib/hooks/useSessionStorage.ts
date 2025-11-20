import { useState, useEffect } from 'react'

/**
 * Custom hook for managing session storage state
 * State persists only during the current session/tab
 * Resets to default when navigating away and returning
 * 
 * @param key - Storage key (should be unique per page)
 * @param defaultValue - Default value if not in session storage
 * @returns [value, setValue] - Current value and setter function
 */
export function useSessionStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return defaultValue
    }

    try {
      const item = sessionStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch (error) {
      console.error(`Error reading sessionStorage key "${key}":`, error)
      return defaultValue
    }
  })

  const setValue = (value: T) => {
    try {
      setStoredValue(value)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(key, JSON.stringify(value))
      }
    } catch (error) {
      console.error(`Error writing to sessionStorage key "${key}":`, error)
    }
  }

  return [storedValue, setValue]
}

/**
 * Hook for managing multiple session storage values at once
 * Useful for pages with multiple filters/state
 * 
 * @param pageKey - Unique key for the page (e.g., 'deposits', 'withdrawals')
 * @param defaultState - Object with default values for all state
 * @returns [state, setState] - Current state object and setter function
 */
export function usePageSessionStorage<T extends Record<string, any>>(
  pageKey: string,
  defaultState: T
): [T, (updates: Partial<T>) => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return defaultState
    }

    try {
      const storageKey = `${pageKey}_state`
      const item = sessionStorage.getItem(storageKey)
      return item ? { ...defaultState, ...JSON.parse(item) } : defaultState
    } catch (error) {
      console.error(`Error reading page state for "${pageKey}":`, error)
      return defaultState
    }
  })

  const updateState = (updates: Partial<T>) => {
    const newState = { ...state, ...updates }
    setState(newState)
    
    if (typeof window !== 'undefined') {
      try {
        const storageKey = `${pageKey}_state`
        sessionStorage.setItem(storageKey, JSON.stringify(newState))
      } catch (error) {
        console.error(`Error writing page state for "${pageKey}":`, error)
      }
    }
  }

  return [state, updateState]
}

/**
 * Hook for managing pagination state
 * Handles page number, page size, and sorting
 * 
 * @param pageKey - Unique key for the page
 * @returns Pagination state and setters
 */
export function usePaginationState(pageKey: string) {
  const [state, setState] = usePageSessionStorage(`${pageKey}_pagination`, {
    currentPage: 1,
    pageSize: 50,
    sortField: 'created_at',
    sortOrder: 'desc' as 'asc' | 'desc',
  })

  return {
    currentPage: state.currentPage,
    setCurrentPage: (page: number) => setState({ currentPage: page }),
    pageSize: state.pageSize,
    setPageSize: (size: number) => setState({ pageSize: size }),
    sortField: state.sortField,
    setSortField: (field: string) => setState({ sortField: field }),
    sortOrder: state.sortOrder,
    setSortOrder: (order: 'asc' | 'desc') => setState({ sortOrder: order }),
  }
}

/**
 * Hook for managing filter state
 * Handles search, filters, and other query parameters
 * 
 * @param pageKey - Unique key for the page
 * @param defaultFilters - Default filter values
 * @returns Filter state and setters
 */
export function useFilterState<T extends Record<string, any>>(
  pageKey: string,
  defaultFilters: T
) {
  const [filters, setFilters] = usePageSessionStorage(`${pageKey}_filters`, defaultFilters)

  const updateFilter = (key: keyof T, value: any) => {
    setFilters({ [key]: value } as Partial<T>)
  }

  const resetFilters = () => {
    setFilters(defaultFilters)
  }

  return {
    filters,
    updateFilter,
    setFilters,
    resetFilters,
  }
}

/**
 * Clear all session storage for a specific page
 * Useful for cleanup when leaving a page
 * 
 * @param pageKey - Unique key for the page
 */
export function clearPageSessionStorage(pageKey: string) {
  if (typeof window === 'undefined') return

  try {
    sessionStorage.removeItem(`${pageKey}_state`)
    sessionStorage.removeItem(`${pageKey}_pagination`)
    sessionStorage.removeItem(`${pageKey}_filters`)
  } catch (error) {
    console.error(`Error clearing session storage for "${pageKey}":`, error)
  }
}
