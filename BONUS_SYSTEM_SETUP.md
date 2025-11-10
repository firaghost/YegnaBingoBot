# Bonus System Setup Guide

## Overview

The bonus system has been implemented with:
- ✅ Bottom navigation bar (Bingo Rooms, Bonus, Account)
- ✅ Account page with purple theme matching your design
- ✅ Bonus page with Welcome Bonus, First Deposit Bonus, and Daily Streak
- ✅ Real bonus balance from database (not hardcoded)

## Database Changes Required

### Run this SQL in Supabase:

```sql
-- File: supabase/add_bonus_balance.sql
```

This adds:
- `bonus_balance` - Bonus ETB that can be used for games
- `referral_code` - Unique code for inviting friends
- `referred_by` - Who referred this user
- `total_referrals` - Count of successful referrals
- `referral_earnings` - ETB earned from referrals
- `daily_streak` - Current daily play streak
- `last_play_date` - Last date user played

## Features Implemented

### 1. Bottom Navigation Bar
- **Location:** Fixed at bottom of screen
- **Pages:** Bingo Rooms (`/lobby`), Bonus (`/bonus`), Account (`/account`)
- **Design:** Purple gradient background with yellow accent for active tab
- **Component:** `app/components/BottomNav.tsx`

### 2. Account Page (`/account`)
**Features:**
- Account Overview with balance display
- Main Balance + Bonus Balance cards
- Deposit/Withdraw/Refresh buttons
- Recent Transactions list
- Preferences (Language, Sound Settings)
- Important Information (Terms, Support, FAQ)
- Logout functionality

**Design:**
- Purple gradient background
- Yellow accents for important elements
- Card-based layout with semi-transparent backgrounds

### 3. Bonus Page (`/bonus`)
**Features:**

#### Your Total Bonus
- Shows actual `bonus_balance` from database
- Play button to use bonus in games
- Green text for balance amount

#### Welcome Bonus
- 1.00 ETB for new users
- Shows "Bonus Already Claimed" if user has bonus
- Medal icon (🏅)

#### First Deposit Bonus
- Match deposit up to 100 ETB
- Links to deposit page
- Gift icon

#### Daily Streak Bonus
- Track 5-day play streak
- Visual progress with checkmarks
- Shows "X more days to bonus"
- Claim button when streak reaches 5 days

## User Interface Updates

### AuthUser Interface
Updated `lib/hooks/useAuth.ts` to include:
```typescript
export interface AuthUser {
  id: string
  telegram_id: string
  username: string
  balance: number
  bonus_balance: number          // NEW
  games_played: number
  games_won: number
  total_winnings: number
  referral_code: string          // NEW
  total_referrals: number        // NEW
  referral_earnings: number      // NEW
  daily_streak: number           // NEW
  last_play_date: string         // NEW
  created_at: string
}
```

## Setup Steps

### 1. Run Database Migration
```sql
-- In Supabase SQL Editor, run:
supabase/add_bonus_balance.sql
```

### 2. Update Existing Users
All existing users will automatically get:
- `bonus_balance = 7.00 ETB` (default)
- `referral_code = their telegram_id`
- `daily_streak = 0`

### 3. Deploy Code
```bash
git add .
git commit -m "Add bonus system and bottom navigation"
git push
```

### 4. Test Features

**Test Account Page:**
1. Go to `/account`
2. Verify bonus balance shows correctly
3. Test Deposit/Withdraw buttons
4. Check transactions list
5. Test logout

**Test Bonus Page:**
1. Go to `/bonus`
2. Verify total bonus shows from database
3. Check Welcome Bonus status
4. View Daily Streak progress
5. Test Play button

**Test Bottom Nav:**
1. Navigate between pages
2. Verify active tab highlighting
3. Check on mobile (fixed at bottom)

## Future Enhancements

### Referral System
- Add referral link sharing
- Track referral conversions
- Award 10 ETB per successful referral

### Daily Streak Logic
- Update `daily_streak` when user plays
- Reset if user misses a day
- Award bonus at 5-day streak

### Bonus Usage
- Deduct from `bonus_balance` when playing
- Track bonus vs main balance separately
- Show bonus usage in transactions

## Color Scheme

**Primary Colors:**
- Background: Purple gradient (`from-purple-900 via-purple-800 to-purple-900`)
- Accent: Yellow (`yellow-400`, `yellow-500`)
- Success: Green (`green-400`, `green-500`)
- Cards: Semi-transparent purple (`purple-800 bg-opacity-50`)
- Borders: Purple (`purple-700`) and Yellow (`yellow-500`)

**Text Colors:**
- Primary: White
- Secondary: Purple-200/300
- Accent: Yellow-400
- Success: Green-400
- Error: Red-400

## Files Modified

1. `app/components/BottomNav.tsx` - NEW
2. `app/account/page.tsx` - Redesigned
3. `app/bonus/page.tsx` - Redesigned
4. `app/lobby/page.tsx` - Added BottomNav
5. `lib/hooks/useAuth.ts` - Updated AuthUser interface
6. `supabase/add_bonus_balance.sql` - NEW

## Notes

- Bonus balance is now fetched from database, not hardcoded
- All pages use consistent purple theme
- Bottom navigation is fixed and always visible
- Mobile-responsive design
- Smooth transitions and hover effects
