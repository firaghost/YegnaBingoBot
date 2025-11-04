import { useState, useEffect } from 'react';

export default function GameManager({ game, onCallNumber, onEndGame, onStartGame }) {
  const [loading, setLoading] = useState(false);
  const calledNumbers = game?.called_numbers || [];
  const lastNumber = calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1] : null;

  const handleCallNumber = async () => {
    setLoading(true);
    await onCallNumber(game.id);
    setLoading(false);
  };

  const handleStartGame = async () => {
    if (!confirm('Start this game?')) return;
    setLoading(true);
    await onStartGame(game.id);
    setLoading(false);
  };

  const handleEndGame = async () => {
    if (!confirm('End this game? Make sure to verify the winner first.')) return;
    setLoading(true);
    await onEndGame(game.id);
    setLoading(false);
  };

  const getBingoLetter = (num) => {
    if (num >= 1 && num <= 15) return 'B';
    if (num >= 16 && num <= 30) return 'I';
    if (num >= 31 && num <= 45) return 'N';
    if (num >= 46 && num <= 60) return 'G';
    if (num >= 61 && num <= 75) return 'O';
    return '';
  };

  return (
    <div className="card">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800">
            Game #{game.id.slice(0, 8)}
          </h3>
          <p className="text-sm text-gray-500">
            Created: {new Date(game.created_at).toLocaleString()}
          </p>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-bold ${
          game.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
          game.status === 'active' ? 'bg-green-100 text-green-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {game.status.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-indigo-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Prize Pool</p>
          <p className="text-2xl font-bold text-primary">{game.prize_pool} Birr</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Numbers Called</p>
          <p className="text-2xl font-bold text-secondary">{calledNumbers.length} / 75</p>
        </div>
      </div>

      {lastNumber && (
        <div className="bg-gradient-to-r from-primary to-secondary text-white p-6 rounded-lg mb-6 text-center">
          <p className="text-sm mb-2">Last Number Called</p>
          <p className="text-5xl font-bold">
            {getBingoLetter(lastNumber)}-{lastNumber}
          </p>
        </div>
      )}

      {calledNumbers.length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Called Numbers:</p>
          <div className="flex flex-wrap gap-2">
            {calledNumbers.map((num, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-gray-100 rounded-full text-sm font-medium"
              >
                {getBingoLetter(num)}-{num}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {game.status === 'waiting' && (
          <button
            onClick={handleStartGame}
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? 'Starting...' : '🎮 Start Game'}
          </button>
        )}

        {game.status === 'active' && (
          <>
            <button
              onClick={handleCallNumber}
              disabled={loading || calledNumbers.length >= 75}
              className="btn btn-primary w-full"
            >
              {loading ? 'Calling...' : '🎲 Call Next Number'}
            </button>
            <button
              onClick={handleEndGame}
              disabled={loading}
              className="btn btn-danger w-full"
            >
              {loading ? 'Ending...' : '🏁 End Game'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
