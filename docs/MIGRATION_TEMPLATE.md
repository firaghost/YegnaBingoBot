# Session Storage Migration Template

This template shows how to migrate any admin page from localStorage to sessionStorage.

## Step 1: Update Imports

**Before:**
```typescript
import { useLocalStorage } from '@/lib/hooks/usePageState'
```

**After:**
```typescript
import { usePageSessionStorage } from '@/lib/hooks/useSessionStorage'
```

## Step 2: Replace State Declarations

**Before:**
```typescript
const [filter, setFilter] = useLocalStorage('deposits_filter', 'all')
const [searchTerm, setSearchTerm] = useLocalStorage('deposits_search', '')
const [currentPage, setCurrentPage] = useLocalStorage('deposits_page', 1)
const [pageSize, setPageSize] = useLocalStorage('deposits_pageSize', 10)
```

**After:**
```typescript
const [state, setState] = usePageSessionStorage('deposits', {
  filter: 'all',
  searchTerm: '',
  currentPage: 1,
  pageSize: 10,
})
```

## Step 3: Update All References

Replace all individual state references with the state object:

| Old | New |
|-----|-----|
| `filter` | `state.filter` |
| `setFilter(value)` | `setState({ filter: value })` |
| `searchTerm` | `state.searchTerm` |
| `setSearchTerm(value)` | `setState({ searchTerm: value })` |
| `currentPage` | `state.currentPage` |
| `setCurrentPage(value)` | `setState({ currentPage: value })` |
| `pageSize` | `state.pageSize` |
| `setPageSize(value)` | `setState({ pageSize: value })` |

## Example: Complete Migration

### Before (localStorage - ❌)
```typescript
'use client'
import { useState } from 'react'
import { useLocalStorage } from '@/lib/hooks/usePageState'

export default function DepositsPage() {
  const [filter, setFilter] = useLocalStorage('deposits_filter', 'all')
  const [searchTerm, setSearchTerm] = useLocalStorage('deposits_search', '')
  const [currentPage, setCurrentPage] = useLocalStorage('deposits_page', 1)
  const [pageSize, setPageSize] = useLocalStorage('deposits_pageSize', 10)

  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="all">All</option>
        <option value="pending">Pending</option>
      </select>
      <button onClick={() => setCurrentPage(1)}>First Page</button>
    </div>
  )
}
```

### After (sessionStorage - ✅)
```typescript
'use client'
import { useState } from 'react'
import { usePageSessionStorage } from '@/lib/hooks/useSessionStorage'

export default function DepositsPage() {
  const [state, setState] = usePageSessionStorage('deposits', {
    filter: 'all',
    searchTerm: '',
    currentPage: 1,
    pageSize: 10,
  })

  return (
    <div>
      <input
        value={state.searchTerm}
        onChange={(e) => setState({ searchTerm: e.target.value })}
      />
      <select 
        value={state.filter} 
        onChange={(e) => setState({ filter: e.target.value })}
      >
        <option value="all">All</option>
        <option value="pending">Pending</option>
      </select>
      <button onClick={() => setState({ currentPage: 1 })}>First Page</button>
    </div>
  )
}
```

## Pages to Migrate (Priority Order)

### High Priority (Data-heavy)
- [ ] `deposits/page.tsx`
- [ ] `withdrawals/page.tsx`
- [ ] `transactions/page.tsx`
- [ ] `games/page.tsx`
- [ ] `users/page.tsx` ✅ (Already done)

### Medium Priority
- [ ] `rooms/page.tsx`
- [ ] `bots/page.tsx`
- [ ] `banks/page.tsx`
- [ ] `suspended-users/page.tsx`

### Low Priority
- [ ] `broadcast/page.tsx`
- [ ] `system-status/page.tsx`
- [ ] `settings/page.tsx`

## Quick Find & Replace Guide

Use your IDE's Find & Replace (Ctrl+H) for each page:

### 1. Replace import
```
Find: import { useLocalStorage } from '@/lib/hooks/usePageState'
Replace: import { usePageSessionStorage } from '@/lib/hooks/useSessionStorage'
```

### 2. Replace state declarations (example for deposits)
```
Find: const [filter, setFilter] = useLocalStorage('deposits_filter', 'all')
      const [searchTerm, setSearchTerm] = useLocalStorage('deposits_search', '')
      const [currentPage, setCurrentPage] = useLocalStorage('deposits_page', 1)
      const [pageSize, setPageSize] = useLocalStorage('deposits_pageSize', 10)

Replace: const [state, setState] = usePageSessionStorage('deposits', {
           filter: 'all',
           searchTerm: '',
           currentPage: 1,
           pageSize: 10,
         })
```

### 3. Replace all references
```
Find: setFilter(
Replace: setState({ filter:

Find: setSearchTerm(
Replace: setState({ searchTerm:

Find: setCurrentPage(
Replace: setState({ currentPage:

Find: setPageSize(
Replace: setState({ pageSize:

Find: filter
Replace: state.filter

Find: searchTerm
Replace: state.searchTerm

Find: currentPage
Replace: state.currentPage

Find: pageSize
Replace: state.pageSize
```

## Testing Checklist

After migration, verify:

- [ ] **Refresh page** → State persists ✅
- [ ] **Apply filters** → State saved ✅
- [ ] **Change pagination** → State saved ✅
- [ ] **Navigate away** → State clears ✅
- [ ] **Return to page** → Defaults shown ✅
- [ ] **Close tab** → State cleared ✅
- [ ] **Open new tab** → Defaults shown ✅

## Troubleshooting

### State not updating?
- Make sure you're using `setState({ key: value })` not `setState(value)`
- Check that the key matches your state object

### TypeScript errors?
- Add type annotation: `usePageSessionStorage<YourType>('key', defaults)`
- Ensure all keys in defaults match your usage

### Still using localStorage somewhere?
- Search for `localStorage` in the file
- Replace with `sessionStorage` or use the hook instead
