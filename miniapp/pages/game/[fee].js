import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getUserId, hapticFeedback, setMainButton, hideMainButton, setBackButton } from '../../lib/telegram';
import { getUserByTelegramId, supabase } from '../../lib/supabase';
export default function GamePage() {
  const router = useRouter();
  const { fee } = router.query;
  const [user, setUser] = useState(null);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWaitingPopup, setShowWaitingPopup] = useState(false);
  const [activeTab, setActiveTab] = useState('Balance');
  const [gameInfo, setGameInfo] = useState({ prizePool: 0, playerCount: 0, status: 'new' });

  useEffect(() => {
    async function loadUser() {
      const telegramUserId = getUserId();
      const userData = await getUserByTelegramId(telegramUserId) || { id: 'test', balance: 5 };
      setUser(userData);
      setLoading(false);
    }

    loadUser();

    // Set back button
    setBackButton(() => {
      router.back();
    });

    return () => {
      hideMainButton();
    };
  }, [router]);

  useEffect(() => {
    async function loadGameInfo() {
      if (!fee) return;
      
      const { data: game } = await supabase
        .from('games')
        .select(`
          id,
          entry_fee,
          prize_pool,
          status,
          game_players (id)
        `)
        .eq('entry_fee', parseInt(fee))
        .in('status', ['waiting', 'active'])
        .single();
      
      if (game) {
        const totalPool = game.prize_pool || 0;
        const commission = totalPool * 0.10; // 10% commission
        const playerPrize = totalPool - commission;
        
        setGameInfo({
          prizePool: totalPool,
          playerPrize: playerPrize,
          commission: commission,
          playerCount: game.game_players?.length || 0,
          status: game.status
        });
      } else {
        setGameInfo({
          prizePool: 0,
          playerPrize: 0,
          commission: 0,
          playerCount: 0,
          status: 'new'
        });
      }
    }
    
    loadGameInfo();
    // Refresh every 5 seconds
    const interval = setInterval(loadGameInfo, 5000);
    return () => clearInterval(interval);
  }, [fee]);

  useEffect(() => {
    if (selectedNumbers.length > 0) {
      setMainButton(`ተግባር ይግቡ (${selectedNumbers.length}/1)`, () => {
        handleSubmit();
      });
    } else {
      hideMainButton();
    }
  }, [selectedNumbers]);

  const handleNumberClick = (number) => {
    hapticFeedback('light');
    
    if (selectedNumbers.includes(number)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== number));
    } else {
      if (selectedNumbers.length < 1) {
        setSelectedNumbers([...selectedNumbers, number]);
      }
    }
  };

  const handleSubmit = async () => {
    if (selectedNumbers.length === 0) {
      telegram?.showAlert('Please select at least one number!');
      return;
    }

    hapticFeedback('medium');
    setLoading(true);
    
    try {
      // Generate bingo card from selected numbers
      const card = generateBingoCard(selectedNumbers);
      
      // Find or create game
      const { getGamesByFee, createGame, joinGame: joinGameFunc } = await import('../../lib/supabase');
      
      let game = await getGamesByFee(parseInt(fee));
      
      // Check if there's an active game
      if (game && game.status === 'active') {
        telegram?.showAlert('A game is currently in progress. Please wait for it to finish!');
        setLoading(false);
        return;
      }
      
      // If no waiting game exists, create one
      if (!game || game.status === 'completed') {
        game = await createGame(parseInt(fee));
      }
      
      if (!game) {
        telegram?.showAlert('Failed to create game');
        setLoading(false);
        return;
      }
      
      // Join the game with selected numbers
      const result = await joinGameFunc(game.id, user.id, card, parseInt(fee), selectedNumbers);
      
      if (!result.success) {
        telegram?.showAlert(result.error || 'Failed to join game');
        setLoading(false);
        return;
      }
      
      // Show waiting popup - stay on this page
      setShowWaitingPopup(true);
      
      // Subscribe to game updates to detect when it starts
      const channel = supabase
        .channel(`game:${game.id}`)
        .on('postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${game.id}` },
          (payload) => {
            if (payload.new.status === 'active') {
              // Game started! Transition to playing
              setShowWaitingPopup(false);
              router.push(`/play/${game.id}`);
            }
          }
        )
        .subscribe();
    } catch (error) {
      console.error('Error joining game:', error);
      telegram?.showAlert('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  function generateBingoCard(selectedNumbers) {
    const card = [];
    
    for (let col = 0; col < 5; col++) {
      const columnNumbers = [];
      const min = col * 15 + 1;
      const max = min + 14;
      
      for (let row = 0; row < 5; row++) {
        if (col === 2 && row === 2) {
          columnNumbers.push('#');
        } else {
          const num = Math.floor(Math.random() * (max - min + 1)) + min;
          columnNumbers.push(num);
        }
      }
      card.push(columnNumbers);
    }
    
    return card;
  }

  const numbers = Array.from({ length: 100 }, (_, i) => i + 1);

  return (
    <>
      <Head>
        <title>Select Numbers - Bingo</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-secondary to-primary pb-20">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-primary/90 backdrop-blur-sm px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">ተመላሽ</h1>
            <div className="bg-yellow-500 px-4 py-2 rounded-lg">
              <span className="font-bold text-white">{fee || 5}.00 ETB</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-primary/50 px-4 py-2">
          <div className="flex gap-2 justify-between">
            <button
              onClick={() => setActiveTab('Balance')}
              className={`flex-1 px-3 py-2 rounded-lg font-semibold transition-all ${
                activeTab === 'Balance'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-800/50 text-blue-200'
              }`}
            >
              <div className="text-xs opacity-75">Balance</div>
              <div className="text-sm font-bold">{user?.balance || 0} ETB</div>
            </button>
            
            <button
              onClick={() => setActiveTab('Coins')}
              className={`flex-1 px-3 py-2 rounded-lg font-semibold transition-all ${
                activeTab === 'Coins'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-800/50 text-blue-200'
              }`}
            >
              <div className="text-xs opacity-75">Coins</div>
              <div className="text-sm font-bold">#</div>
            </button>
            
            <button
              onClick={() => setActiveTab('Derash')}
              className={`flex-1 px-3 py-2 rounded-lg font-semibold transition-all ${
                activeTab === 'Derash'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-800/50 text-blue-200'
              }`}
            >
              <div className="text-xs opacity-75">Derash</div>
              <div className="text-sm font-bold">{gameInfo.playerPrize?.toFixed(2) || 0} ETB</div>
            </button>
            
            <button
              onClick={() => setActiveTab('Stake')}
              className={`flex-1 px-3 py-2 rounded-lg font-semibold transition-all ${
                activeTab === 'Stake'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-800/50 text-blue-200'
              }`}
            >
              <div className="text-xs opacity-75">Players</div>
              <div className="text-sm font-bold">{gameInfo.playerCount}</div>
            </button>
          </div>
        </div>

        {/* Selection Info */}
        <div className="px-4 py-4 text-center">
          <p className="text-white font-semibold text-lg">
            Num of cart selected - {selectedNumbers.length}/1
          </p>
        </div>

        {/* Number Grid */}
        <div className="px-4">
          <div className="grid grid-cols-9 gap-2">
            {numbers.map((number) => (
              <button
                key={number}
                onClick={() => handleNumberClick(number)}
                className={`number-cell ${
                  selectedNumbers.includes(number)
                    ? 'number-cell-selected'
                    : 'number-cell-unselected'
                }`}
              >
                {number}
              </button>
            ))}
          </div>
        </div>

        {/* Submit Button (for non-Telegram environment) */}
        {typeof window !== 'undefined' && !window.Telegram?.WebApp && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-primary/90 backdrop-blur-sm">
            <button
              onClick={handleSubmit}
              disabled={selectedNumbers.length === 0 || loading}
              className="btn btn-primary w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Joining...' : `ተግባር ይግቡ (${selectedNumbers.length}/1)`}
            </button>
          </div>
        )}

        {/* Waiting Popup */}
        {showWaitingPopup && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
              <div className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <span className="text-4xl">⏳</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Joined Successfully!
              </h3>
              <p className="text-gray-600 mb-4">
                Waiting for game to start...
              </p>
              <div className="flex items-center justify-center space-x-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
