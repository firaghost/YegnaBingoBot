import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    const isAuth = localStorage.getItem('adminAuth');
    
    if (!isAuth) {
      // Not authenticated, go to login
      router.push('/login');
    } else {
      // Authenticated, go to games
      router.push('/games');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}
