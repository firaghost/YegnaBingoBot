# Deposit & Withdrawal Management Fixes

## Issues Fixed

### 1. **Deposit Rejection Error (500 Internal Server Error)**
**Problem:** When rejecting a deposit, the API tried to set transaction status to `'rejected'`, but the database constraint only allows: `'pending'`, `'completed'`, `'failed'`.

**Solution:**
- Updated API to use `'failed'` status instead of `'rejected'`
- Added rejection reason storage in transaction metadata
- Rejection reason is now sent to users via Telegram notification

### 2. **Browser Popups Replaced with Modern UI**
**Problem:** Used browser `prompt()`, `alert()`, and `confirm()` dialogs - bad UX.

**Solution:**
- Created custom modal for rejection reason input
- Added confirmation dialog for approvals
- Implemented toast notifications for success/error messages
- Applied to both deposits and withdrawals pages

### 3. **Withdrawal Rejection Database Issue**
**Problem:** The `reject_withdrawal()` stored procedure tried to set transaction status to `'rejected'`, causing constraint violations.

**Solution:**
- Created SQL fix: `supabase/fix_withdrawal_rejection.sql`
- Updates function to use `'failed'` status for transactions

### 4. **Data Inconsistency in Deposits Page**
**Problem:** Desktop view accessed `deposit.proof_url` while mobile view accessed `deposit.metadata?.proof_url`.

**Solution:**
- Standardized both views to use `deposit.proof_url` (direct column)
- Fixed payment_method and transaction_reference to use direct columns

## Required Database Migration

Run this SQL in Supabase SQL Editor:

```bash
# Execute the fix
supabase/fix_withdrawal_rejection.sql
```

This updates the `reject_withdrawal` function to use the correct transaction status.

## Changes Made

### Files Modified:
1. **app/admin/deposits/page.tsx**
   - Replaced browser popups with modals
   - Added toast notifications
   - Fixed data field inconsistencies
   - Changed filter from 'rejected' to 'failed'

2. **app/admin/withdrawals/page.tsx**
   - Replaced browser popups with modals
   - Added toast notifications
   - Improved mobile responsiveness

3. **app/api/admin/deposits/route.ts**
   - Changed status from 'rejected' to 'failed'
   - Added rejection_reason parameter validation
   - Store rejection metadata (reason, timestamp, admin)
   - Include reason in Telegram notification

### Files Created:
1. **supabase/fix_withdrawal_rejection.sql**
   - Fixes `reject_withdrawal()` function
   - Updates transaction status to 'failed' instead of 'rejected'

## Testing Checklist

- [ ] Run the SQL migration in Supabase
- [ ] Test deposit approval flow
- [ ] Test deposit rejection flow with reason
- [ ] Test withdrawal approval flow
- [ ] Test withdrawal rejection flow with reason
- [ ] Verify Telegram notifications include rejection reasons
- [ ] Check mobile responsiveness
- [ ] Verify toast notifications display correctly

## Status Values Reference

### Transactions Table
- `pending` - Awaiting processing
- `completed` - Successfully processed
- `failed` - Rejected or failed

### Withdrawals Table
- `pending` - Awaiting admin review
- `approved` - Approved by admin
- `rejected` - Rejected by admin
- `completed` - Payment sent

## Notes

- The deposits page now shows "rejected" label for failed transactions (cosmetic)
- Rejection reasons are stored in transaction metadata for deposits
- Rejection reasons are stored in admin_note field for withdrawals
- Both systems now provide proper feedback to users via Telegram
