# Session Storage Management Guide

## Overview
Session storage automatically persists page state (filters, pagination, search) **only during the current session**. When you navigate away and return, the state resets to defaults - providing a professional, clean user experience.

## Key Difference: sessionStorage vs localStorage

| Feature | sessionStorage | localStorage |
|---------|---|---|
| **Persistence** | Current tab/session only | Permanent (until cleared) |
| **Behavior** | Resets when leaving page | Persists forever |
| **Use Case** | Page state (filters, pagination) | User preferences |
| **Professional** | ✅ Yes | ❌ No (for page state) |

## Available Hooks

### 1. `useSessionStorage<T>` - Single Value
For managing a single state value.

```typescript
import { useSessionStorage } from '@/lib/hooks/useSessionStorage'

const [searchTerm, setSearchTerm] = useSessionStorage('deposits_search', '')
const [filter, setFilter] = useSessionStorage('deposits_filter', 'all')
```

### 2. `usePageSessionStorage<T>` - Multiple Values
For managing multiple related state values at once.

```typescript
import { usePageSessionStorage } from '@/lib/hooks/useSessionStorage'

const [state, setState] = usePageSessionStorage('deposits', {
  search: '',
  filter: 'all',
  page: 1,
  pageSize: 50,
})

// Update individual values
setState({ search: 'john' })
setState({ page: 2, pageSize: 100 })
```

### 3. `usePaginationState` - Pagination & Sorting
Pre-built hook for common pagination needs.

```typescript
import { usePaginationState } from '@/lib/hooks/useSessionStorage'

const {
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  sortField,
  setSortField,
  sortOrder,
  setSortOrder,
} = usePaginationState('deposits')
```

### 4. `useFilterState<T>` - Filters & Search
Pre-built hook for managing filters.

```typescript
import { useFilterState } from '@/lib/hooks/useSessionStorage'

const { filters, updateFilter, setFilters, resetFilters } = useFilterState('deposits', {
  search: '',
  status: 'all',
  dateRange: null,
})

// Update single filter
updateFilter('search', 'john')

// Reset all filters
resetFilters()
```

## Implementation Examples

### Example 1: Deposits Page (Simple)
```typescript
'use client'
import { useSessionStorage } from '@/lib/hooks/useSessionStorage'

export default function DepositsPage() {
  const [searchTerm, setSearchTerm] = useSessionStorage('deposits_search', '')
  const [filter, setFilter] = useSessionStorage('deposits_filter', 'all')
  const [page, setPage] = useSessionStorage('deposits_page', 1)

  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search..."
      />
      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="all">All</option>
        <option value="pending">Pending</option>
        <option value="completed">Completed</option>
      </select>
    </div>
  )
}
```

### Example 2: Games Page (Advanced)
```typescript
'use client'
import { usePageSessionStorage } from '@/lib/hooks/useSessionStorage'

export default function GamesPage() {
  const [state, setState] = usePageSessionStorage('games', {
    search: '',
    filter: 'all',
    page: 1,
    pageSize: 50,
    sortField: 'created_at',
    sortOrder: 'desc',
  })

  const handleSearch = (value: string) => {
    setState({ search: value, page: 1 }) // Reset to page 1 on search
  }

  const handleSort = (field: string) => {
    const newOrder = state.sortField === field && state.sortOrder === 'desc' ? 'asc' : 'desc'
    setState({ sortField: field, sortOrder: newOrder })
  }

  return (
    <div>
      <input
        value={state.search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search games..."
      />
      <table>
        <thead>
          <tr>
            <th onClick={() => handleSort('created_at')}>Date</th>
            <th onClick={() => handleSort('prize_pool')}>Prize Pool</th>
          </tr>
        </thead>
      </table>
    </div>
  )
}
```

### Example 3: Transactions Page (With Pagination Hook)
```typescript
'use client'
import { usePaginationState, useFilterState } from '@/lib/hooks/useSessionStorage'

export default function TransactionsPage() {
  const pagination = usePaginationState('transactions')
  const { filters, updateFilter, resetFilters } = useFilterState('transactions', {
    search: '',
    type: 'all',
    status: 'all',
  })

  return (
    <div>
      <input
        value={filters.search}
        onChange={(e) => updateFilter('search', e.target.value)}
        placeholder="Search..."
      />
      <select
        value={filters.type}
        onChange={(e) => updateFilter('type', e.target.value)}
      >
        <option value="all">All Types</option>
        <option value="deposit">Deposit</option>
        <option value="withdrawal">Withdrawal</option>
      </select>

      <Pagination
        currentPage={pagination.currentPage}
        pageSize={pagination.pageSize}
        onPageChange={pagination.setCurrentPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </div>
  )
}
```

## Migration Guide

### Before (localStorage - ❌ Not Professional)
```typescript
const [search, setSearch] = useState(() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('deposits_search') || ''
  }
  return ''
})

useEffect(() => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('deposits_search', search)
  }
}, [search])
```

### After (sessionStorage - ✅ Professional)
```typescript
const [search, setSearch] = useSessionStorage('deposits_search', '')
```

## Best Practices

1. **Use Unique Keys**: Always use page-specific keys
   ```typescript
   // ✅ Good
   useSessionStorage('deposits_search', '')
   useSessionStorage('withdrawals_search', '')
   
   // ❌ Bad
   useSessionStorage('search', '')
   ```

2. **Group Related State**: Use `usePageSessionStorage` for related values
   ```typescript
   // ✅ Good
   const [state, setState] = usePageSessionStorage('deposits', {
     search: '',
     filter: 'all',
     page: 1,
   })
   
   // ❌ Bad
   const [search, setSearch] = useSessionStorage('deposits_search', '')
   const [filter, setFilter] = useSessionStorage('deposits_filter', 'all')
   const [page, setPage] = useSessionStorage('deposits_page', 1)
   ```

3. **Reset on Navigation**: Filters reset automatically when leaving the page
   ```typescript
   // No cleanup needed - sessionStorage handles it!
   ```

4. **Type Safety**: Always type your state
   ```typescript
   type DepositsState = {
     search: string
     filter: 'all' | 'pending' | 'completed'
     page: number
   }
   
   const [state, setState] = usePageSessionStorage<DepositsState>('deposits', {
     search: '',
     filter: 'all',
     page: 1,
   })
   ```

## Pages to Update

Priority order for implementation:

1. **High Priority** (Data-heavy, lots of filters):
   - `deposits/page.tsx`
   - `withdrawals/page.tsx`
   - `transactions/page.tsx`
   - `games/page.tsx`
   - `users/page.tsx` (already done ✅)

2. **Medium Priority** (Some filters):
   - `rooms/page.tsx`
   - `bots/page.tsx`
   - `banks/page.tsx`
   - `suspended-users/page.tsx`

3. **Low Priority** (Minimal state):
   - `broadcast/page.tsx`
   - `system-status/page.tsx`
   - `settings/page.tsx`

## Testing

To verify session storage works correctly:

1. **Open page** → Apply filters → Refresh → Filters persist ✅
2. **Navigate away** → Return to page → Filters reset ✅
3. **Close tab** → Reopen → Filters reset ✅
4. **Open in new tab** → Filters reset ✅

## Troubleshooting

### State not persisting?
- Check that you're using the correct hook
- Verify the key is unique
- Check browser console for errors

### State not resetting?
- Make sure you're using `sessionStorage`, not `localStorage`
- Check that you navigated away (not just refreshed)
- Clear browser cache if needed

### TypeScript errors?
- Add proper type annotations: `useSessionStorage<string>('key', '')`
- Use `usePageSessionStorage<YourType>('key', defaults)`
