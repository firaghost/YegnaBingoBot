# Admin Panel Security Update

## Changes Made

The admin panel URL has been secured by changing it from an easily guessable path to an obscure one.

### Previous Admin URL
```
https://yegnagame.vercel.app/admin
```

### New Secured Admin URL
```
https://yegnagame.vercel.app/mgmt-portal-x7k9p2
```

## What Was Changed

1. **Folder Renamed**: `/app/admin` → `/app/mgmt-portal-x7k9p2`

2. **All Internal Links Updated**:
   - Main dashboard page (`page.tsx`)
   - Login page (`login/page.tsx`)
   - Deposits page (`deposits/page.tsx`)
   - Withdrawals page (`withdrawals/page.tsx`)
   - Users page (`users/page.tsx`)
   - Games page (`games/page.tsx`)
   - Rooms page (`rooms/page.tsx`)
   - Transactions page (`transactions/page.tsx`)
   - Broadcast page (`broadcast/page.tsx`)
   - Settings page (`settings/page.tsx`)

3. **Bot Handler Links Updated**:
   - Updated rejection links in `lib/bot-handlers.ts` for deposits and withdrawals
   - Admin panel buttons in Telegram bot now point to the new secure URL

## What Was NOT Changed

- **API Routes**: All API endpoints remain unchanged at `/api/admin/*`
  - `/api/admin/deposits`
  - `/api/admin/withdrawals`
  - These are backend API routes, not public-facing URLs

## Access Instructions

### For Admins:
- **New Login URL**: `https://yegnagame.vercel.app/mgmt-portal-x7k9p2/login`
- Default credentials: `admin` / `admin123` (change these in production!)

### Security Best Practices:
1. ✅ Admin URL is now obscure and hard to guess
2. ✅ Authentication is still required to access the panel
3. ⚠️ Keep this URL private and share only with authorized admins
4. ⚠️ Consider changing the URL periodically for maximum security
5. ⚠️ Make sure to update your bookmarks to the new URL

## Deployment Note

After deploying these changes:
1. Update any bookmarks you have for the admin panel
2. Inform all admin users of the new URL
3. The Telegram bot will automatically use the new URL for admin notifications
4. Old `/admin` URL will return a 404 error

## New Features Added

### Commission Balance Display
The admin dashboard now shows:
- **Total Commission Earned**: All-time commission revenue from games
- **Today's Commission**: Commission earned today
- Displayed in a highlighted purple card with a 💎 icon
- Updates in real-time when dashboard refreshes

Commission is automatically calculated from the `commission_amount` field in the games table based on the configured commission rate (default 10%).

## Date of Change
November 11, 2025
