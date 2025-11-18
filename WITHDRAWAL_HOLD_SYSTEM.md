# Withdrawal Hold System - Implementation Guide

## Problem Statement

**Scenario:** User has 70 ETB balance and requests withdrawal of 60 ETB. While the withdrawal is pending approval, the user loses 20 ETB in a game. The system then approves the withdrawal, deducting 60 ETB from their remaining 50 ETB balance, resulting in a negative balance or overdraft.

**Root Cause:** The current system does not reserve/hold money when a withdrawal is requested. Money can be spent in games even though it's pending withdrawal.

## Solution: Withdrawal Hold System

A new system that:
1. **Holds money** when withdrawal is requested (reserves it)
2. **Prevents spending** held money in games
3. **Releases hold** when withdrawal is approved or rejected
4. **Calculates available balance** = Total Balance - Pending Withdrawal Hold

## Database Changes

### New Column
```sql
ALTER TABLE users
ADD COLUMN pending_withdrawal_hold DECIMAL DEFAULT 0;
```

This tracks the total amount of money currently held for pending withdrawals.

### New Functions

#### 1. `get_available_balance(p_user_id UUID)`
Returns the amount of money a user can actually spend:
```
Available Balance = Total Balance - Pending Withdrawal Hold
```

#### 2. `create_withdrawal()` - UPDATED
**Before:** Only checked if balance >= withdrawal amount  
**After:** 
- Checks if available balance >= withdrawal amount
- **Holds the money** by incrementing `pending_withdrawal_hold`
- User cannot spend this money in games

#### 3. `approve_withdrawal()` - NEW
- Updates withdrawal status to 'approved'
- **Deducts** the amount from balance
- **Releases** the hold from `pending_withdrawal_hold`
- Creates completion transaction

#### 4. `reject_withdrawal()` - NEW
- Updates withdrawal status to 'rejected'
- **Releases** the hold from `pending_withdrawal_hold` (no balance deduction)
- User gets their money back to spend

#### 5. `deduct_stake_with_bonus()` - UPDATED
**Before:** Checked if (bonus + main balance) >= stake  
**After:**
- Checks if (bonus + available main balance) >= stake
- Available main = main balance - pending withdrawal hold
- Prevents spending held money in games

## Workflow Example

### Scenario: User with 70 ETB, requests 60 ETB withdrawal

**Step 1: User requests withdrawal of 60 ETB**
```
Total Balance: 70 ETB
Pending Hold: 0 ETB
Available: 70 ETB ✅ (can withdraw 60)

After request:
Total Balance: 70 ETB (unchanged)
Pending Hold: 60 ETB (reserved)
Available: 10 ETB (can only spend this)
```

**Step 2: User tries to play game with 20 ETB stake**
```
Available Balance: 10 ETB
Requested Stake: 20 ETB
Result: ❌ REJECTED - Insufficient available balance
```

**Step 3: User plays game with 5 ETB stake (within available)**
```
Available Balance: 10 ETB
Requested Stake: 5 ETB
Result: ✅ APPROVED

After game:
Total Balance: 65 ETB (70 - 5 loss)
Pending Hold: 60 ETB (unchanged)
Available: 5 ETB
```

**Step 4: Admin approves withdrawal of 60 ETB**
```
Before approval:
Total Balance: 65 ETB
Pending Hold: 60 ETB

After approval:
Total Balance: 5 ETB (65 - 60 deducted)
Pending Hold: 0 ETB (released)
Available: 5 ETB
```

**Step 5: User can now spend remaining 5 ETB**
```
Available Balance: 5 ETB ✅
```

## API Changes

### Withdraw Route (`/api/wallet/withdraw`)

**Response on insufficient available balance:**
```json
{
  "error": "Insufficient available balance",
  "details": {
    "totalBalance": 70,
    "pendingWithdrawalHold": 60,
    "availableBalance": 10,
    "requestedAmount": 60
  }
}
```

## Admin Approval/Rejection

### Approve Withdrawal
```typescript
await supabase.rpc('approve_withdrawal', {
  p_withdrawal_id: withdrawalId
})
```
- Money is deducted from balance
- Hold is released
- Withdrawal status → 'approved'

### Reject Withdrawal
```typescript
await supabase.rpc('reject_withdrawal', {
  p_withdrawal_id: withdrawalId
})
```
- Money is NOT deducted
- Hold is released
- Withdrawal status → 'rejected'
- User can spend the money again

## Database Views

### `user_balance_info` View
Shows complete balance information:
```sql
SELECT
  id,
  username,
  balance,
  pending_withdrawal_hold,
  available_balance,  -- balance - pending_withdrawal_hold
  updated_at
FROM user_balance_info
WHERE id = user_id;
```

## Implementation Steps

1. **Run migration:**
   ```bash
   psql -d your_db < supabase/add_withdrawal_hold_system.sql
   ```

2. **Update withdrawal API:**
   - File: `app/api/wallet/withdraw/route.ts`
   - Already updated to check available balance

3. **Update game join logic:**
   - Uses `deduct_stake_with_bonus()` which now checks available balance
   - No additional changes needed

4. **Update admin approval logic:**
   - Call `approve_withdrawal()` or `reject_withdrawal()` RPC
   - These handle hold release automatically

## Benefits

✅ **Prevents overdrafts** - Users can't spend held money  
✅ **Fair system** - Money is reserved when withdrawal requested  
✅ **Atomic operations** - Database handles all updates together  
✅ **Transparent** - Users see available vs total balance  
✅ **Flexible** - Rejections automatically release holds  
✅ **Auditable** - All transactions are logged  

## Testing Checklist

- [ ] User requests withdrawal of 60 ETB (balance 70)
- [ ] Available balance shows 10 ETB
- [ ] User cannot play game with 20 ETB stake
- [ ] User can play game with 5 ETB stake
- [ ] After loss, available balance updates correctly
- [ ] Admin approves withdrawal
- [ ] Balance is deducted correctly
- [ ] Hold is released
- [ ] User can spend remaining balance
- [ ] Rejection releases hold without deduction
