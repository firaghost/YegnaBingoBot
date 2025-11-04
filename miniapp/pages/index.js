import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getUserId, telegram, hapticFeedback } from '../lib/telegram';
import { getUserByTelegramId } from '../lib/supabase';
import Head from 'next/head';

const GAME_OPTIONS = [
  { id: 1, fee: 5, players: 14, status: 'live' },
  { id: 2, fee: 7, players: 0, status: 'new' },
  { id: 3, fee: 10, players: 0, status: 'new' },
  { id: 4, fee: 20, players: 0, status: 'new' },
  { id: 5, fee: 50, players: 0, status: 'new' },
  { id: 6, fee: 100, players: 0, status: 'new' },
];

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const telegramUserId = getUserId();
      
      if (!telegramUserId) {
        // For testing without Telegram
        setUser({ id: 'test', balance: 5, username: 'Test User' });
        setLoading(false);
        return;
      }

      const userData = await getUserByTelegramId(telegramUserId);
      setUser(userData);
      setLoading(false);
    }

    loadUser();
  }, []);

  const handleJoinGame = (game) => {
    hapticFeedback('medium');
    
    if (!user) {
      telegram?.showAlert('Please register first!');
      return;
    }

    if (user.balance < game.fee) {
      telegram?.showAlert(`Insufficient balance! You need ${game.fee} Birr to join this game.`);
      return;
    }

    router.push(`/game/${game.fee}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-secondary to-primary flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Cheers Bingo - Select Game</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-secondary to-primary pb-20">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-primary/90 backdrop-blur-sm px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">ተመላሽ</h1>
              <p className="text-xs text-blue-200">Cheers Bingo</p>
            </div>
            <div className="bg-yellow-500 px-4 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💰</span>
                <span className="font-bold text-white">{user?.balance || 0}.00 ETB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Game Options */}
        <div className="px-4 py-6 space-y-4">
          <h2 className="text-white text-lg font-semibold mb-4">ስፖንሰር 1 - 5</h2>
          
          {GAME_OPTIONS.map((game) => (
            <div
              key={game.id}
              className="game-card relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl font-bold text-white">
                      {game.fee} ብር
                    </div>
                    {game.status === 'live' && (
                      <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                        ቀጥታ ({game.players})
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2 text-sm text-blue-200">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      {game.players} - ብር ደረጃ
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleJoinGame(game)}
                  className="btn btn-primary px-8 py-3 text-lg"
                >
                  ይግቡ
                </button>
              </div>

              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-600/10 rounded-full -ml-12 -mb-12"></div>
            </div>
          ))}
        </div>

        {/* Bottom Info */}
        <div className="px-4 py-4 text-center text-blue-200 text-sm">
          <p>Cheers Bingo ስፖንሰር አስር Challenge ላይደሰታ</p>
          <p className="mt-1">@CheersBingoBot</p>
        </div>
      </div>
    </>
  );
}
