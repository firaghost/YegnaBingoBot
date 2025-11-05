import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getUserId, hapticFeedback, setBackButton } from '../../lib/telegram';
import { getUserByTelegramId } from '../../lib/supabase';

// Generate a Bingo card from selected numbers
function generateBingoCard(selectedNumbers) {
  // For demo, create a 5x5 card with selected number highlighted
  const card = [];
  const letters = ['B', 'I', 'N', 'G', 'O'];
  
  for (let col = 0; col < 5; col++) {
    const columnNumbers = [];
    const min = col * 15 + 1;
    const max = min + 14;
    
    for (let row = 0; row < 5; row++) {
      if (col === 2 && row === 2) {
        // FREE space
        columnNumbers.push('#');
      } else {
        // Random number in range
        const num = Math.floor(Math.random() * (max - min + 1)) + min;
        columnNumbers.push(num);
      }
    }
    card.push(columnNumbers);
  }
  
  return card;
}

export default function BingoPage() {
  const router = useRouter();
  const { fee, numbers } = router.query;
  const [user, setUser] = useState(null);
  const [bingoCard, setBingoCard] = useState([]);
  const [calledNumbers, setCalledNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState(null);

  useEffect(() => {
    async function loadUser() {
      const telegramUserId = getUserId();
      const userData = await getUserByTelegramId(telegramUserId) || { id: 'test', balance: 5 };
      setUser(userData);
    }

    loadUser();

    // Generate bingo card
    const selected = numbers ? numbers.split(',').map(Number) : [];
    const card = generateBingoCard(selected);
    setBingoCard(card);
    
    if (selected.length > 0) {
      setSelectedNumber(selected[0]);
    }

    // Set back button
    setBackButton(() => {
      router.back();
    });
  }, [router, numbers]);

  const handleCellClick = (number) => {
    if (number === '#') return;
    hapticFeedback('light');
    setSelectedNumber(number);
  };

  const letters = ['B', 'I', 'N', 'G', 'O'];

  return (
    <>
      <Head>
        <title>Bingo Card - Play</title>
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
                className="px-4 py-2 rounded-lg font-semibold bg-blue-600 text-white"
              >
                {tab === 'Balance' ? `${fee || 5} ETB` : tab === 'Coins' ? '#' : tab === 'Derash' ? '-' : '5'}
              </button>
            ))}
          </div>
        </div>

        {/* Selection Info */}
        <div className="px-4 py-4 text-center">
          <p className="text-white font-semibold text-lg">
            Num of cart selected - /1
          </p>
        </div>

        {/* Number Grid (smaller, for reference) */}
        <div className="px-4 mb-4">
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: 100 }, (_, i) => i + 1).map((number) => (
              <div
                key={number}
                className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold ${
                  number === selectedNumber
                    ? 'bg-danger text-white ring-2 ring-white'
                    : 'bg-blue-700 text-white'
                }`}
              >
                {number}
              </div>
            ))}
          </div>
        </div>

        {/* BINGO Letters */}
        <div className="px-4 mb-2">
          <div className="grid grid-cols-5 gap-2">
            {letters.map((letter, index) => (
              <div
                key={letter}
                className="text-center font-bold text-2xl"
                style={{ color: ['#EF4444', '#FCD34D', '#60A5FA', '#F97316', '#EF4444'][index] }}
              >
                {letter}
              </div>
            ))}
          </div>
        </div>

        {/* Bingo Card */}
        <div className="px-4">
          <div className="bg-primary/50 p-4 rounded-xl">
            {bingoCard.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                {[0, 1, 2, 3, 4].map((row) => (
                  <React.Fragment key={row}>
                    {[0, 1, 2, 3, 4].map((col) => {
                      const number = bingoCard[col][row];
                      const isCalled = calledNumbers.includes(number);
                      const isSelected = number === selectedNumber;
                      const isFree = number === '#';
                      
                      return (
                        <button
                          key={`${row}-${col}`}
                          onClick={() => handleCellClick(number)}
                          className={`bingo-cell ${
                            isCalled || isSelected
                              ? 'bingo-cell-called'
                              : 'bingo-cell-uncalled'
                          } ${isSelected ? 'ring-4 ring-white' : ''}`}
                        >
                          {isFree ? '★' : number}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Called Numbers Display */}
        <div className="px-4 mt-6">
          <div className="bg-primary/50 p-4 rounded-xl">
            <h3 className="text-white font-semibold mb-2">Called Numbers:</h3>
            <div className="flex flex-wrap gap-2">
              {calledNumbers.length === 0 ? (
                <p className="text-blue-200 text-sm">Waiting for game to start...</p>
              ) : (
                calledNumbers.map((num) => (
                  <span key={num} className="bg-danger text-white px-3 py-1 rounded-full font-bold">
                    {num}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Prevent static generation - this page needs dynamic routing
export async function getServerSideProps() {
  return {
    props: {}
  };
}
