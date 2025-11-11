# Support Contact Settings - Setup Guide

## Overview
The support contact information (email, telegram, phone) is now configurable by admins through the admin settings panel.

## Database Setup

### 1. Run the SQL Migration
Execute the following SQL file in your Supabase SQL editor:
```bash
supabase/add_support_settings.sql
```

This will add three new settings to the `admin_settings` table:
- `support_email` - Support email address
- `support_telegram` - Support Telegram username
- `support_phone` - Support phone number

### 2. Verify Installation
After running the SQL, verify the settings exist:
```sql
SELECT setting_key, setting_value, description 
FROM admin_settings 
WHERE setting_key IN ('support_email', 'support_telegram', 'support_phone');
```

## How to Configure

### For Admins:
1. Login to admin panel
2. Navigate to **Admin → Settings**
3. Scroll to **"📧 Support Contact Information"** section
4. Edit the three fields:
   - **Support Email**: Email address for support
   - **Support Telegram**: Telegram username (include @)
   - **Support Phone**: Phone number with country code
5. Click **"Save Settings"** button
6. Changes are immediately visible to all users

### For Users:
1. Go to **Account** page
2. Scroll to **"Settings & Support"** section
3. Click **"Contact Support"**
4. Modal shows current support contact information
5. Click any contact method to reach support

## Technical Details

### Database Table: `admin_settings`
```sql
- setting_key: 'support_email' | 'support_telegram' | 'support_phone'
- setting_value: The actual contact information
- description: Human-readable description
- updated_at: Last update timestamp
```

### Frontend Implementation
- **Account Page** (`app/account/page.tsx`):
  - Fetches support info on page load
  - Displays in modal when user clicks "Contact Support"
  - Falls back to defaults if not configured

- **Admin Settings** (`app/admin/settings/page.tsx`):
  - Three input fields for editing
  - Saves to `admin_settings` table
  - Validates and updates on save

### Default Values
If not configured, the system uses these defaults:
- Email: `support@bingox.com`
- Telegram: `@bingox_support`
- Phone: `+251 911 234 567`

## Features
✅ Fully configurable by admin
✅ Real-time updates (no cache)
✅ Clickable links (email, telegram, phone)
✅ Professional modal UI
✅ Mobile responsive
✅ Fallback to defaults if not set

## Testing
1. **Test Admin Panel**:
   - Change support email in admin settings
   - Save settings
   - Verify success message

2. **Test User View**:
   - Go to Account page as user
   - Click "Contact Support"
   - Verify new email is displayed
   - Click email link to test

3. **Test All Contact Methods**:
   - Email: Opens default email client
   - Telegram: Opens Telegram app/web
   - Phone: Opens phone dialer on mobile
