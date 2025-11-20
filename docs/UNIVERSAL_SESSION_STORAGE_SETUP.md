# Universal Session Storage Setup - Complete Guide

## ✅ What's Been Created

### 1. **New Utility Hook** (`lib/hooks/useSessionStorage.ts`)
A comprehensive set of hooks for managing session storage across all pages:

- `useSessionStorage<T>` - Single value management
- `usePageSessionStorage<T>` - Multiple related values
- `usePaginationState` - Pre-built pagination hook
- `useFilterState<T>` - Pre-built filter hook
- `clearPageSessionStorage` - Cleanup function

### 2. **Documentation**
- `docs/SESSION_STORAGE_GUIDE.md` - Complete usage guide with examples
- `docs/MIGRATION_TEMPLATE.md` - Step-by-step migration instructions

### 3. **Already Migrated**
- ✅ `app/mgmt-portal-x7k9p2/users/page.tsx` - Uses sessionStorage

---

## 🚀 Quick Start

### For New Pages
```typescript
import { usePageSessionStorage } from '@/lib/hooks/useSessionStorage'

export default function MyPage() {
  const [state, setState] = usePageSessionStorage('mypage', {
    search: '',
    filter: 'all',
    page: 1,
    pageSize: 50,
  })

  return (
    <input
      value={state.search}
      onChange={(e) => setState({ search: e.target.value })}
    />
  )
}
```

### For Existing Pages (Migration)
See `docs/MIGRATION_TEMPLATE.md` for detailed instructions.

---

## 📋 Pages Needing Migration

### High Priority (Data-heavy, lots of filters)
1. **deposits/page.tsx**
   - Filters: status (all/pending/completed/failed)
   - Search: username, telegram ID
   - Pagination: page, pageSize

2. **withdrawals/page.tsx**
   - Filters: status, type
   - Search: username, telegram ID
   - Pagination: page, pageSize

3. **transactions/page.tsx**
   - Filters: type, status, date range
   - Search: username, transaction ID
   - Pagination: page, pageSize

4. **games/page.tsx**
   - Filters: status, room
   - Search: game ID, player name
   - Pagination: page, pageSize

### Medium Priority (Some filters)
5. **rooms/page.tsx**
   - Search: room name
   - Pagination: page, pageSize

6. **bots/page.tsx**
   - Filters: status
   - Search: bot name
   - Pagination: page, pageSize

7. **banks/page.tsx**
   - Search: bank name
   - Pagination: page, pageSize

8. **suspended-users/page.tsx**
   - Search: username
   - Pagination: page, pageSize

### Low Priority (Minimal state)
9. **broadcast/page.tsx**
10. **system-status/page.tsx**
11. **settings/page.tsx**

---

## 🔄 How It Works

### Session Storage Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│ User Opens Page (e.g., /deposits)                       │
│ ↓                                                        │
│ sessionStorage checked for 'deposits_state'             │
│ ↓                                                        │
│ Found? → Use saved state                                │
│ Not found? → Use default state                          │
│ ↓                                                        │
│ User applies filters → State saved to sessionStorage    │
│ ↓                                                        │
│ User navigates away → sessionStorage persists           │
│ ↓                                                        │
│ User returns to /deposits → State restored              │
│ ↓                                                        │
│ User closes tab/browser → sessionStorage cleared        │
│ ↓                                                        │
│ User reopens /deposits → Defaults shown (fresh start)   │
└─────────────────────────────────────────────────────────┘
```

### Key Differences

| Scenario | localStorage (❌ Old) | sessionStorage (✅ New) |
|----------|---|---|
| Refresh page | State persists | State persists |
| Navigate away & return | State persists | State resets |
| Close tab | State persists | State cleared |
| Close browser | State persists | State cleared |
| Professional? | ❌ No | ✅ Yes |

---

## 📝 Migration Checklist

### Before Starting
- [ ] Read `docs/SESSION_STORAGE_GUIDE.md`
- [ ] Read `docs/MIGRATION_TEMPLATE.md`
- [ ] Understand the difference between localStorage and sessionStorage

### For Each Page
- [ ] Update import: `useLocalStorage` → `usePageSessionStorage`
- [ ] Consolidate state into single object
- [ ] Replace all state references with `state.key`
- [ ] Replace all setters with `setState({ key: value })`
- [ ] Test: Refresh → State persists ✅
- [ ] Test: Navigate away → State resets ✅
- [ ] Test: Close tab → State cleared ✅

### After All Pages
- [ ] Remove old `usePageState.ts` hook if no longer used
- [ ] Update any documentation
- [ ] Test all admin pages work correctly

---

## 🛠️ Implementation Examples

### Example 1: Simple Page (Rooms)
```typescript
import { usePageSessionStorage } from '@/lib/hooks/useSessionStorage'

export default function RoomsPage() {
  const [state, setState] = usePageSessionStorage('rooms', {
    search: '',
    page: 1,
    pageSize: 50,
  })

  return (
    <div>
      <input
        value={state.search}
        onChange={(e) => setState({ search: e.target.value, page: 1 })}
        placeholder="Search rooms..."
      />
      <Pagination
        page={state.page}
        onPageChange={(page) => setState({ page })}
      />
    </div>
  )
}
```

### Example 2: Complex Page (Transactions)
```typescript
import { usePaginationState, useFilterState } from '@/lib/hooks/useSessionStorage'

export default function TransactionsPage() {
  const pagination = usePaginationState('transactions')
  const { filters, updateFilter } = useFilterState('transactions', {
    search: '',
    type: 'all',
    status: 'all',
    dateFrom: null,
    dateTo: null,
  })

  return (
    <div>
      <input
        value={filters.search}
        onChange={(e) => updateFilter('search', e.target.value)}
      />
      <select
        value={filters.type}
        onChange={(e) => updateFilter('type', e.target.value)}
      >
        <option value="all">All Types</option>
        <option value="deposit">Deposit</option>
        <option value="withdrawal">Withdrawal</option>
      </select>
      <Pagination {...pagination} />
    </div>
  )
}
```

---

## ✨ Benefits

✅ **Professional UX** - Matches industry-standard web apps  
✅ **Clean State** - Fresh start when navigating away  
✅ **Persistent During Session** - Filters saved while browsing  
✅ **Automatic Cleanup** - No manual cleanup needed  
✅ **Type-Safe** - Full TypeScript support  
✅ **Reusable** - Same hooks across all pages  
✅ **Easy to Test** - Clear, predictable behavior  

---

## 🧪 Testing Guide

### Test 1: State Persists on Refresh
1. Open `/deposits`
2. Apply filter: "pending"
3. Refresh page (F5)
4. ✅ Filter should still be "pending"

### Test 2: State Resets on Navigation
1. Open `/deposits`
2. Apply filter: "pending"
3. Navigate to `/games`
4. Navigate back to `/deposits`
5. ✅ Filter should be back to "all" (default)

### Test 3: State Clears on Tab Close
1. Open `/deposits` in new tab
2. Apply filter: "pending"
3. Close the tab
4. Open `/deposits` in new tab
5. ✅ Filter should be "all" (default)

### Test 4: Multiple Tabs Independent
1. Open `/deposits` in Tab A
2. Apply filter: "pending"
3. Open `/deposits` in Tab B
4. Apply filter: "completed"
5. Switch to Tab A
6. ✅ Tab A should show "pending"
7. Switch to Tab B
8. ✅ Tab B should show "completed"

---

## 🔗 Resources

- **Hook Documentation**: `docs/SESSION_STORAGE_GUIDE.md`
- **Migration Guide**: `docs/MIGRATION_TEMPLATE.md`
- **Hook Source**: `lib/hooks/useSessionStorage.ts`

---

## ❓ FAQ

**Q: Why sessionStorage instead of localStorage?**  
A: sessionStorage resets when leaving the page, providing a professional UX. localStorage persists forever, which is not ideal for page state.

**Q: Do I need to manually clear sessionStorage?**  
A: No, it's automatically cleared when the tab closes.

**Q: Can I use this for user preferences?**  
A: No, use localStorage for preferences. Use sessionStorage for page state (filters, pagination).

**Q: What if I need to persist across tabs?**  
A: Use localStorage instead. But for page state, sessionStorage is better.

**Q: How do I test this?**  
A: See "Testing Guide" section above.

---

## 📞 Support

For issues or questions:
1. Check `docs/SESSION_STORAGE_GUIDE.md`
2. Check `docs/MIGRATION_TEMPLATE.md`
3. Review `lib/hooks/useSessionStorage.ts` source code
4. Check browser console for errors
