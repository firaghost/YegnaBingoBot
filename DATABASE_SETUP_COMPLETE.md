# Complete Database Setup Guide

## 🚀 Run These SQL Files in Order

Execute these SQL files in your Supabase SQL Editor:

### 1. Fix All Core Issues
```sql
\i supabase/fix_all_issues.sql
```
This creates:
- Users table with proper structure
- Games table
- Rooms table
- Transactions table
- Player cards table
- RLS policies

### 2. Add Commission System
```sql
\i supabase/add_commission_system.sql
```
This adds:
- Commission fields to games table
- Commission calculation functions
- Admin settings for commission rate

### 3. Add Proof Upload System
```sql
\i supabase/add_proof_upload.sql
```
This adds:
- Proof URL field to transactions
- Payment method field
- Transaction reference field

### 4. Create Withdrawals Table (NEW - REQUIRED!)
```sql
\i supabase/create_withdrawals_table.sql
```
This creates:
- Withdrawals table with foreign key to users
- Withdrawal creation function
- Approve/reject withdrawal functions
- RLS policies

## 📦 Create Storage Bucket

In Supabase Dashboard → Storage:

1. **Create bucket**: `transaction-proofs`
2. **Make it Public**: Yes
3. **File size limit**: 5MB
4. **Allowed file types**: image/jpeg, image/png, image/jpg

## ✅ Verification Checklist

After running all SQL files, verify:

- [ ] `users` table exists with `telegram_id` column
- [ ] `games` table has `commission_rate`, `commission_amount`, `net_prize` columns
- [ ] `transactions` table has `proof_url`, `payment_method`, `transaction_reference` columns
- [ ] `withdrawals` table exists with foreign key to `users`
- [ ] `transaction-proofs` storage bucket exists and is public
- [ ] All RLS policies are enabled

## 🔧 Test Each Feature

### Test Deposits:
1. Go to `/deposit`
2. Enter amount and upload proof
3. Should create pending transaction ✅
4. Should show in admin panel ✅

### Test Withdrawals:
1. Go to `/withdraw`
2. Should show correct balance (not 5,250)
3. Enter amount and bank details
4. Should create pending withdrawal ✅
5. Should show in admin panel ✅

### Test Admin Panel:
1. Go to `/admin/deposits`
2. Should see pending deposits ✅
3. Can approve/reject ✅

4. Go to `/admin/withdrawals`
5. Should see pending withdrawals ✅
6. Can approve/reject ✅

## 🐛 Common Issues & Fixes

### Issue: "Could not find relationship between withdrawals and users"
**Fix**: Run `create_withdrawals_table.sql` - the table doesn't exist yet!

### Issue: Deposit/Withdrawal API returns 500 error
**Fix**: Already fixed - APIs now use `supabaseAdmin` client

### Issue: Wrong balance showing in withdrawal page
**Fix**: Already fixed - now uses `user?.balance` instead of hardcoded value

### Issue: Deposits/Withdrawals not showing in admin panel
**Fix**: Already fixed - admin APIs use `supabaseAdmin` to bypass RLS

## 🎯 All Fixed Issues Summary

✅ Bingo card generation - Fisher-Yates shuffle (international standard)
✅ Number calling - Race condition protection, no duplicates
✅ Transaction history - Shows all types (stake, win, deposit, withdrawal, bonus)
✅ Deposit API - Uses admin client, creates pending transactions
✅ Withdrawal API - Uses admin client, shows correct balance
✅ Withdrawals table - Created with proper foreign keys
✅ Admin panel - Can view and approve/reject deposits & withdrawals
✅ Countdown loop - Fixed, properly transitions to active game
✅ Winner detection - Shows results immediately
✅ Cell marking - Can't unmark once marked
✅ Broadcast - Works with HTTPS URLs on Vercel
✅ Bot commands - All registered and working via webhook

## 🚀 Deploy Checklist

Before deploying to Vercel:

1. ✅ Run all 4 SQL files in Supabase
2. ✅ Create `transaction-proofs` storage bucket
3. ✅ Set environment variables in Vercel:
   - `BOT_TOKEN`
   - `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_KEY` (service role key - IMPORTANT!)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (https://yegnagame.vercel.app)
   - `ADMIN_TELEGRAM_ID`
   - `ADMIN_PASSWORD`
4. ✅ Deploy to Vercel
5. ✅ Set Telegram webhook:
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://yegnagame.vercel.app/api/webhook
   ```

Your app is now fully functional! 🎉
