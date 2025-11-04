import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getUserId, hapticFeedback, setMainButton, hideMainButton, setBackButton } from '../../lib/telegram';
import { getUserByTelegramId } from '../../lib/supabase';

export default function GamePage() {
  const router = useRouter();
  const { fee } = router.query;
  const [user, setUser] = useState(null);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [activeTab, setActiveTab] = useState('Balance');

  useEffect(() => {
    async function loadUser() {
      const telegramUserId = getUserId();
      const userData = await getUserByTelegramId(telegramUserId) || { id: 'test', balance: 5 };
      setUser(userData);
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
      return;
    }

    hapticFeedback('medium');
    
    // Generate bingo card from selected numbers
    const card = generateBingoCard(selectedNumbers);
    
    // Find or create game
    const { getGamesByFee, createGame, joinGame: joinGameFunc } = await import('../../lib/supabase');
    
    let game = await getGamesByFee(parseInt(fee));
    
    if (!game || game.status !== 'waiting') {
      game = await createGame(parseInt(fee));
    }
    
    if (!game) {
      alert('Failed to create game');
      return;
    }
    
    // Join the game
    const result = await joinGameFunc(game.id, user.id, card, parseInt(fee));
    
    if (!result.success) {
      alert(result.error || 'Failed to join game');
      return;
    }
    
    // Redirect to game play page
    router.push(`/play/${game.id}`);
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
          <div className="flex gap-2">
            {['Balance', 'Coins', 'Derash', 'Stake'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-800/50 text-blue-200'
                }`}
              >
                {tab}
              </button>
            ))}
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
              disabled={selectedNumbers.length === 0}
              className="btn btn-primary w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ተግባር ይግቡ ({selectedNumbers.length}/1)
            </button>
          </div>
        )}
      </div>
    </>
  );
}
