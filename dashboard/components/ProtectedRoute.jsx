import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth';

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const auth = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [sessionInfo, setSessionInfo] = useState(null);

  useEffect(() => {
    // Initialize auth system
    auth.init();

    // Check authentication
    if (!auth.isAuthenticated()) {
      router.push('/login');
      return;
    }

    setIsChecking(false);

    // Update session info every minute
    const updateSessionInfo = () => {
      const info = auth.getSessionInfo();
      setSessionInfo(info);
    };

    updateSessionInfo();
    const interval = setInterval(updateSessionInfo, 60000);

    return () => clearInterval(interval);
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      
      {/* Session Timeout Warning */}
      {sessionInfo && sessionInfo.timeUntilExpiry < 5 * 60 * 1000 && sessionInfo.timeUntilExpiry > 0 && (
        <div className="fixed bottom-4 right-4 bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded-lg shadow-lg max-w-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800 font-medium">
                Session expiring soon
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                {Math.floor(sessionInfo.timeUntilExpiry / 60000)} minutes remaining
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
