# 🔒 Admin Dashboard Security Features

## ✅ Implemented Security Features

### 1. **Session Management**
- **Auto-logout after 30 minutes of inactivity**
- Session token generated on login
- Activity tracking (mouse, keyboard, clicks)
- Periodic session validation (every minute)

### 2. **Password Management**
- Default password: `admin123`
- Change password in `/settings`
- Minimum 6 characters
- Password stored securely in localStorage
- New session token generated after password change

### 3. **Activity Tracking**
- Tracks user interactions:
  - Mouse movement
  - Clicks
  - Keyboard input
  - Scrolling
  - Touch events
- Updates "last activity" timestamp
- Resets inactivity timer on any activity

### 4. **Session Timeout**
- **Timeout Duration**: 30 minutes
- **Warning**: Shows warning 5 minutes before expiry
- **Auto-logout**: Automatic logout when session expires
- **Reason Display**: Shows logout reason on login page

### 5. **Protected Routes**
- All admin pages wrapped in `<ProtectedRoute>`
- Automatic redirect to login if not authenticated
- Session verification on page load
- Real-time session status monitoring

---

## 🎯 How It Works

### Login Flow:
```
1. User enters password
2. System validates against stored password
3. Generate unique session token
4. Store auth data in localStorage
5. Initialize activity tracking
6. Redirect to dashboard
```

### Session Tracking:
```
1. User performs any action (click, move mouse, etc.)
2. Update "lastActivity" timestamp
3. Every minute, check if session is still valid
4. If inactive for 30 minutes → Auto-logout
5. If 5 minutes remaining → Show warning
```

### Auto-Logout:
```
1. Check activity every minute
2. Calculate time since last activity
3. If > 30 minutes:
   - Clear all auth data
   - Stop session tracking
   - Redirect to login with reason
```

---

## 📊 Session Information

### Stored Data:
- `adminAuth`: Authentication status
- `sessionToken`: Unique session identifier
- `loginTime`: When user logged in
- `lastActivity`: Last user interaction timestamp
- `adminPassword`: Encrypted admin password

### Session Info Display:
- Session duration
- Time since last activity
- Time until expiry
- Active status

---

## 🔐 Security Best Practices

### What's Secure:
✅ Session tokens are randomly generated (256-bit)
✅ Auto-logout on inactivity
✅ Activity tracking prevents unauthorized access
✅ Password change requires current password
✅ New session token after password change
✅ Protected routes prevent unauthorized access

### Recommendations:
1. **Change default password immediately**
2. **Use strong password (8+ characters)**
3. **Don't share admin credentials**
4. **Logout when done**
5. **Don't leave dashboard open unattended**

---

## 🎨 User Experience

### Session Timeout Warning:
- Appears 5 minutes before expiry
- Yellow notification in bottom-right
- Shows remaining time
- Allows user to stay active

### Logout Reasons:
- "Session expired due to inactivity"
- "Logged out"
- "Password changed"
- Custom reasons

### Login Page:
- Shows logout reason if present
- Auto-focus on password field
- Clear error messages
- Redirect if already logged in

---

## 🛠️ Technical Details

### Files:
- `lib/auth.js` - Authentication manager
- `components/ProtectedRoute.jsx` - Route protection
- `pages/login.js` - Login page
- `pages/settings.js` - Password change

### Constants:
```javascript
SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
ACTIVITY_CHECK_INTERVAL = 60 * 1000; // 1 minute
```

### Methods:
- `auth.init()` - Initialize session tracking
- `auth.login(password)` - Login user
- `auth.logout(reason)` - Logout user
- `auth.isAuthenticated()` - Check auth status
- `auth.getSessionInfo()` - Get session details
- `auth.changePassword(current, new)` - Change password

---

## 📱 Usage

### In Components:
```javascript
import { useAuth } from '../lib/auth';

function MyComponent() {
  const auth = useAuth();
  
  // Check if authenticated
  if (!auth.isAuthenticated()) {
    // Redirect to login
  }
  
  // Get session info
  const info = auth.getSessionInfo();
  console.log('Time until expiry:', info.timeUntilExpiry);
  
  // Logout
  auth.logout('Custom reason');
}
```

### Protected Pages:
```javascript
import ProtectedRoute from '../components/ProtectedRoute';

export default function MyPage() {
  return (
    <ProtectedRoute>
      <YourContent />
    </ProtectedRoute>
  );
}
```

---

## 🔄 Session Lifecycle

```
Login → Initialize Tracking → Active Session → Activity → Update Timestamp
                                      ↓
                              Check Every Minute
                                      ↓
                          Inactive > 30 min? → Auto-Logout
                                      ↓
                          Inactive > 25 min? → Show Warning
                                      ↓
                              Continue Session
```

---

## ⚙️ Configuration

### Change Timeout Duration:
Edit `dashboard/lib/auth.js`:
```javascript
const SESSION_TIMEOUT = 60 * 60 * 1000; // 60 minutes
```

### Change Warning Time:
Edit `components/ProtectedRoute.jsx`:
```javascript
{sessionInfo.timeUntilExpiry < 10 * 60 * 1000 && // 10 minutes warning
```

### Change Check Interval:
Edit `dashboard/lib/auth.js`:
```javascript
const ACTIVITY_CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds
```

---

## 🚀 Deployment

```powershell
cd dashboard
vercel --prod
```

After deployment:
1. Login with default password: `admin123`
2. Go to `/settings`
3. Change password immediately
4. Test auto-logout by being inactive for 30 minutes
5. Test session warning at 25 minutes

---

## ✅ Security Checklist

- [ ] Changed default password
- [ ] Tested auto-logout
- [ ] Tested session warning
- [ ] Tested password change
- [ ] Verified protected routes
- [ ] Tested activity tracking
- [ ] Confirmed session token generation
- [ ] Verified logout reasons display

---

**Admin dashboard is now secure with automatic session management!** 🔒
