# 👑 Super Admin Setup - Separate Authentication

## Overview
Super Admin is **completely separate** from regular admin. The regular admin (your partner) cannot see or access the Super Admin dashboard.

## Access Points

### Regular Admin (Your Partner)
- **URL**: `https://your-dashboard.vercel.app/login`
- **Access**: Dashboard, Games, Payments, Settings
- **Cannot see**: Super Admin dashboard

### Super Admin (You - System Owner)
- **URL**: `https://your-dashboard.vercel.app/super-login`
- **Access**: Everything + Financial Analytics
- **Hidden from**: Regular admin

## Setup Instructions

### 1. Set Environment Variables

In Vercel Dashboard for your dashboard project:

```
NEXT_PUBLIC_SUPER_ADMIN_USERNAME=your_super_username
NEXT_PUBLIC_SUPER_ADMIN_PASSWORD=your_super_password_here
```

**Important:**
- Use a **strong password** (minimum 12 characters)
- Include uppercase, lowercase, numbers, symbols
- Don't share with anyone
- Change regularly

### 2. Default Credentials (Change These!)

**Default Username**: `superadmin`
**Default Password**: `SuperAdmin@2025!`

⚠️ **CHANGE THESE IMMEDIATELY** by setting environment variables!

### 3. Access URLs

**Regular Admin Login:**
```
https://your-dashboard.vercel.app/login
```

**Super Admin Login (Hidden):**
```
https://your-dashboard.vercel.app/super-login
```

## Security Features

### Separate Authentication
✅ Different login page
✅ Different session tokens
✅ Different localStorage keys
✅ Cannot access each other's areas

### Session Management
- **Regular Admin**: 30 minutes timeout
- **Super Admin**: 60 minutes timeout
- Auto-logout on timeout
- Activity tracking

### Access Control
```javascript
// Regular Admin
localStorage.getItem('adminAuth')
localStorage.getItem('sessionToken')

// Super Admin (Separate)
localStorage.getItem('superAdminAuth')
localStorage.getItem('superAdminToken')
```

## What Each Can See

### Regular Admin (Your Partner)
✅ Dashboard (basic stats)
✅ Games management
✅ Payment approval/rejection
✅ Settings
❌ **Cannot see Super Admin**
❌ **Cannot see detailed financials**
❌ **Cannot see revenue breakdown**

### Super Admin (You)
✅ Everything regular admin can see
✅ **Total revenue (10% commission)**
✅ **Complete financial overview**
✅ **All transactions history**
✅ **Top players by balance**
✅ **Admin actions audit log**
✅ **Real-time monitoring**

## Partnership Tracking

### What You Can Monitor

**Financial:**
- Total deposits
- Total withdrawals
- Total revenue (your 50%)
- Total prizes paid
- Net cash flow

**Admin Actions:**
- Every approval/rejection
- Timestamp of actions
- Which admin did what
- All payment details

**System Health:**
- Total games
- Active games
- User growth
- Game completion rate

## 50/50 Partnership Split

### Revenue Calculation

**Game Commission**: 10% of prize pool
**Your Share**: 50% of commission = 5% of prize pool
**Partner Share**: 50% of commission = 5% of prize pool

**Example:**
- Game prize pool: 100 Birr
- Commission: 10 Birr (10%)
- Your share: 5 Birr
- Partner share: 5 Birr

### Monthly Settlement

Super Admin dashboard shows:
- **Total Revenue**: All commission collected
- **Your 50%**: Half of total revenue
- **Partner 50%**: Other half

## How to Keep It Secret

### 1. Don't Share URL
- Never mention `/super-login` to partner
- Bookmark it privately
- Use incognito mode if needed

### 2. Access Separately
- Use different device/browser
- Don't access while partner is around
- Clear history after use

### 3. Different Credentials
- Use completely different username/password
- Don't reuse admin credentials
- Store securely (password manager)

### 4. No Visible Links
- No navigation link in regular admin
- No breadcrumbs
- No references in regular admin code

## Testing

### Test Regular Admin Cannot Access

1. Login as regular admin
2. Try to access: `/super-admin`
3. Should redirect to `/super-login`
4. Login fails with regular admin credentials

### Test Super Admin Access

1. Go to `/super-login`
2. Enter super admin credentials
3. Access `/super-admin`
4. See all financial data

## Troubleshooting

### Cannot Login to Super Admin

**Check:**
1. Using correct URL (`/super-login`)
2. Environment variables set in Vercel
3. Using correct credentials
4. No typos in username/password

### Partner Discovered Super Admin

**If exposed:**
1. Change super admin password immediately
2. Review what they accessed
3. Check admin actions log
4. Consider adding IP restrictions

### Forgot Super Admin Password

**Recovery:**
1. Access Vercel dashboard
2. Update environment variable
3. Redeploy dashboard
4. Use new password

## Best Practices

### Security
✅ Use strong, unique password
✅ Enable 2FA on Vercel account
✅ Change password regularly
✅ Monitor access logs
✅ Use VPN when accessing

### Monitoring
✅ Check dashboard daily
✅ Review admin actions weekly
✅ Verify revenue calculations monthly
✅ Export data regularly
✅ Keep records of settlements

### Partnership
✅ Be transparent about system health
✅ Share non-financial metrics
✅ Discuss growth strategies
✅ Regular settlement meetings
✅ Document everything

## Summary

🔐 **Two Separate Systems:**
- Regular Admin: Your partner manages operations
- Super Admin: You monitor everything

💰 **Financial Transparency:**
- You see all money flows
- Track 50/50 split
- Audit all actions

🤝 **Trust & Verify:**
- Partner runs day-to-day
- You verify everything
- Both benefit equally

**Access Super Admin:**
```
https://your-dashboard.vercel.app/super-login
```

👑 **You have complete oversight while maintaining partnership!**
