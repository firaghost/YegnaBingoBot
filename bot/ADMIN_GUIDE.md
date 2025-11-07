# Admin System Guide

## Overview

The bot now has a complete inline admin panel that allows you to manage everything directly from Telegram without modifying code.

## Setup

### 1. Get Your Telegram User ID

Send `/start` to [@userinfobot](https://t.me/userinfobot) on Telegram to get your user ID.

### 2. Configure Admin Access

Add your Telegram user ID to the environment variables:

**Local (.env file):**
```env
ADMIN_TELEGRAM_IDS=your_telegram_user_id
```

**Vercel (Production):**
1. Go to your Vercel project
2. Settings → Environment Variables
3. Add: `ADMIN_TELEGRAM_IDS` = `your_telegram_user_id`
4. Redeploy

**Multiple Admins:**
```env
ADMIN_TELEGRAM_IDS=123456789,987654321,555666777
```

### 3. Configure Supabase

Make sure your `.env` has:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
```

## Admin Commands

### `/admin`
Opens the main admin panel with inline buttons:

- **📊 Statistics** - View system stats (users, balance, pending payments)
- **👥 Users** - User management (coming soon)
- **💰 Pending Deposits** - View and approve/reject deposits
- **💸 Pending Withdrawals** - View and approve/reject withdrawals
- **🎮 Active Games** - View active games (coming soon)
- **📢 Broadcast** - Send messages to all users
- **⚙️ Settings** - Bot settings (coming soon)
- **🔄 Refresh** - Refresh the panel

### `/broadcast <message>`
Send a message to all registered users.

**Example:**
```
/broadcast 🎉 Special promotion! Get 20% bonus on all deposits today!
```

## How to Manage Payments

### Deposits

1. Send `/admin` to open admin panel
2. Click **💰 Pending Deposits**
3. You'll see a list of pending deposits with:
   - Amount
   - User information
   - Transaction reference
   - Payment ID
4. Click **✅ Approve #N** to approve
5. Click **❌ Reject #N** to reject

**What happens when you approve:**
- Payment status changes to "approved"
- User balance is updated automatically
- User receives notification on Telegram
- Transaction is logged in history

### Withdrawals

1. Send `/admin` to open admin panel
2. Click **💸 Pending Withdrawals**
3. You'll see a list with:
   - Amount
   - User information
   - Payment method (Telebirr/CBE)
   - Account number
   - Current user balance
4. Click **✅ Approve #N** to approve
5. Click **❌ Reject #N** to reject

**What happens when you approve:**
- Payment status changes to "approved"
- User balance is deducted automatically
- User receives notification on Telegram
- Transaction is logged in history
- **You must manually transfer the money to the user's account**

## Notifications

### Automatic Notifications

Users receive automatic notifications for:
- ✅ Deposit approved
- ❌ Deposit rejected
- ✅ Withdrawal approved
- ❌ Withdrawal rejected
- 📢 Broadcast messages

### Admin Notifications (Coming Soon)

Admins will receive notifications for:
- New deposit requests
- New withdrawal requests
- Low balance alerts
- System errors

## Features

### ✅ Implemented

- Inline admin panel with buttons
- View system statistics
- Approve/reject deposits with one click
- Approve/reject withdrawals with one click
- Automatic user notifications
- Broadcast messages to all users
- Automatic balance updates
- Transaction history logging
- Multi-admin support

### 🚧 Coming Soon

- User management (ban, unban, adjust balance)
- Game management (view, cancel games)
- Settings panel (min deposit, min withdrawal, fees)
- Admin activity logs
- Revenue reports
- Referral system management

## Security

- Only users with IDs in `ADMIN_TELEGRAM_IDS` can access admin features
- All admin actions are logged
- Unauthorized access attempts are blocked
- Admin commands are not visible to regular users

## Troubleshooting

### "❌ Unauthorized" message

**Problem:** Your Telegram ID is not in the admin list.

**Solution:**
1. Get your ID from @userinfobot
2. Add it to `ADMIN_TELEGRAM_IDS` in environment variables
3. Redeploy (for Vercel) or restart bot (for local)

### Deposit/Withdrawal buttons not working

**Problem:** Missing Supabase credentials.

**Solution:**
1. Check `.env` has `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
2. Verify credentials are correct
3. Check Vercel environment variables (for production)

### Users not receiving notifications

**Problem:** Bot doesn't have permission to message users.

**Solution:**
- Users must have started the bot first (`/start`)
- Bot cannot message users who blocked it

### "Error loading deposits/withdrawals"

**Problem:** Database connection issue.

**Solution:**
1. Check Supabase credentials
2. Verify RLS policies allow service key access
3. Check Vercel logs for detailed errors

## Best Practices

1. **Always verify transaction details** before approving withdrawals
2. **Check user balance** before approving withdrawals
3. **Use broadcast sparingly** to avoid spam
4. **Keep admin IDs secure** - don't share them publicly
5. **Monitor statistics regularly** to track system health
6. **Transfer money promptly** after approving withdrawals

## Example Workflow

### Processing a Deposit

1. User sends money via Telebirr/CBE
2. User submits deposit request in bot
3. Admin receives notification (coming soon)
4. Admin opens `/admin` → **Pending Deposits**
5. Admin verifies transaction reference
6. Admin clicks **✅ Approve**
7. User balance updated automatically
8. User receives confirmation notification

### Processing a Withdrawal

1. User requests withdrawal in bot
2. Admin receives notification (coming soon)
3. Admin opens `/admin` → **Pending Withdrawals**
4. Admin verifies user balance
5. Admin clicks **✅ Approve**
6. User balance deducted automatically
7. **Admin transfers money to user's account**
8. User receives confirmation notification

## Support

If you encounter any issues:
1. Check Vercel function logs
2. Check bot console output (local development)
3. Verify all environment variables are set
4. Ensure database schema is up to date
