// Admin Authentication & Session Management

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // Check every minute

class AuthManager {
  constructor() {
    this.activityTimeout = null;
    this.checkInterval = null;
    this.isInitialized = false;
  }

  // Initialize session tracking
  init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    
    this.isInitialized = true;
    this.updateLastActivity();
    this.startActivityTracking();
    this.startSessionCheck();
  }

  // Update last activity timestamp
  updateLastActivity() {
    const now = Date.now();
    localStorage.setItem('lastActivity', now.toString());
  }

  // Start tracking user activity
  startActivityTracking() {
    // Track mouse movement, clicks, keyboard
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, () => this.updateLastActivity(), { passive: true });
    });
  }

  // Check session validity periodically
  startSessionCheck() {
    this.checkInterval = setInterval(() => {
      if (!this.isSessionValid()) {
        this.logout('Session expired due to inactivity');
      }
    }, ACTIVITY_CHECK_INTERVAL);
  }

  // Check if session is still valid
  isSessionValid() {
    const lastActivity = localStorage.getItem('lastActivity');
    const isAuth = localStorage.getItem('adminAuth');
    
    if (!isAuth || !lastActivity) {
      return false;
    }

    const timeSinceActivity = Date.now() - parseInt(lastActivity);
    return timeSinceActivity < SESSION_TIMEOUT;
  }

  // Check if user is authenticated
  isAuthenticated() {
    const isAuth = localStorage.getItem('adminAuth');
    const sessionToken = localStorage.getItem('sessionToken');
    
    if (!isAuth || !sessionToken) {
      return false;
    }

    return this.isSessionValid();
  }

  // Login user
  login(password) {
    const storedPassword = localStorage.getItem('adminPassword') || 'admin123';
    
    if (password !== storedPassword) {
      return { success: false, error: 'Invalid password' };
    }

    // Generate session token
    const sessionToken = this.generateSessionToken();
    
    localStorage.setItem('adminAuth', 'true');
    localStorage.setItem('sessionToken', sessionToken);
    localStorage.setItem('loginTime', Date.now().toString());
    this.updateLastActivity();
    
    return { success: true };
  }

  // Logout user
  logout(reason = 'Logged out') {
    // Clear all auth data
    localStorage.removeItem('adminAuth');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('lastActivity');
    localStorage.removeItem('loginTime');
    
    // Clear intervals
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    this.isInitialized = false;
    
    // Redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = `/login?reason=${encodeURIComponent(reason)}`;
    }
  }

  // Generate random session token
  generateSessionToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Get session info
  getSessionInfo() {
    const loginTime = localStorage.getItem('loginTime');
    const lastActivity = localStorage.getItem('lastActivity');
    
    if (!loginTime || !lastActivity) {
      return null;
    }

    const now = Date.now();
    const sessionDuration = now - parseInt(loginTime);
    const timeSinceActivity = now - parseInt(lastActivity);
    const timeUntilExpiry = SESSION_TIMEOUT - timeSinceActivity;

    return {
      sessionDuration,
      timeSinceActivity,
      timeUntilExpiry,
      isActive: timeUntilExpiry > 0
    };
  }

  // Change password
  changePassword(currentPassword, newPassword) {
    const storedPassword = localStorage.getItem('adminPassword') || 'admin123';
    
    if (currentPassword !== storedPassword) {
      return { success: false, error: 'Current password is incorrect' };
    }

    if (newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    localStorage.setItem('adminPassword', newPassword);
    
    // Generate new session token for security
    const newToken = this.generateSessionToken();
    localStorage.setItem('sessionToken', newToken);
    
    return { success: true };
  }

  // Cleanup on page unload
  cleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

// Create singleton instance
const authManager = new AuthManager();

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => authManager.cleanup());
}

export default authManager;

// Helper hook for React components
export function useAuth() {
  return {
    isAuthenticated: () => authManager.isAuthenticated(),
    login: (password) => authManager.login(password),
    logout: (reason) => authManager.logout(reason),
    getSessionInfo: () => authManager.getSessionInfo(),
    changePassword: (current, newPass) => authManager.changePassword(current, newPass),
    init: () => authManager.init()
  };
}
