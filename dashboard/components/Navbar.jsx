import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Navbar({ onLogout }) {
  const router = useRouter();

  return (
    <nav className="bg-primary text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold">
              🎮 Bingo Vault Admin
            </Link>
            <div className="hidden md:flex space-x-4">
              <Link 
                href="/" 
                className={`px-3 py-2 rounded-md ${router.pathname === '/' ? 'bg-indigo-700' : 'hover:bg-indigo-600'}`}
              >
                Dashboard
              </Link>
              <Link 
                href="/payments" 
                className={`px-3 py-2 rounded-md ${router.pathname === '/payments' ? 'bg-indigo-700' : 'hover:bg-indigo-600'}`}
              >
                Payments
              </Link>
              <Link 
                href="/games" 
                className={`px-3 py-2 rounded-md ${router.pathname === '/games' ? 'bg-indigo-700' : 'hover:bg-indigo-600'}`}
              >
                Games
              </Link>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="btn bg-red-500 hover:bg-red-600 text-white"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
