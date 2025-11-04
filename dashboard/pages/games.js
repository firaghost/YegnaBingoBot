import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Navbar from '../components/Navbar';
import GameManager from '../components/GameManager';
import { supabase } from '../lib/supabaseClient';

export default function Games() {
  const router = useRouter();
  const [games, setGames] = useState([]);
  const [players, setPlayers] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    const isAuth = localStorage.getItem('adminAuth');
    if (!isAuth) {
      router.push('/login');
      return;
    }
    fetchGames();
  }, [filter]);

  const fetchGames = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('games')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'active') {
        query = query.in('status', ['waiting', 'active']);
      } else if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setGames(data || []);

      // Fetch players for each game
      if (data && data.length > 0) {
        const playersData = {};
        for (const game of data) {
          const { data: gamePlayers } = await supabase
            .from('game_players')
            .select(`
              *,
              users (
                username,
                telegram_id
              )
            `)
            .eq('game_id', game.id);
          playersData[game.id] = gamePlayers || [];
        }
        setPlayers(playersData);
      }
    } catch (error) {
      console.error('Error fetching games:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async (gameId) => {
    try {
      const { error } = await supabase
        .from('games')
        .update({
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('id', gameId);

      if (error) throw error;

      alert('Game started!');
      fetchGames();
    } catch (error) {
      console.error('Error starting game:', error);
      alert('Error starting game');
    }
  };

  const handleCallNumber = async (gameId) => {
    try {
      // Get current game
      const { data: game } = await supabase
        .from('games')
        .select('called_numbers')
        .eq('id', gameId)
        .single();

      const calledNumbers = game?.called_numbers || [];

      // Generate new number
      const available = [];
      for (let i = 1; i <= 75; i++) {
        if (!calledNumbers.includes(i)) {
          available.push(i);
        }
      }

      if (available.length === 0) {
        alert('All numbers have been called!');
        return;
      }

      const newNumber = available[Math.floor(Math.random() * available.length)];
      const updatedNumbers = [...calledNumbers, newNumber];

      // Update game
      const { error } = await supabase
        .from('games')
        .update({
          called_numbers: updatedNumbers
        })
        .eq('id', gameId);

      if (error) throw error;

      // Get letter for number
      const getLetter = (num) => {
        if (num >= 1 && num <= 15) return 'B';
        if (num >= 16 && num <= 30) return 'I';
        if (num >= 31 && num <= 45) return 'N';
        if (num >= 46 && num <= 60) return 'G';
        if (num >= 61 && num <= 75) return 'O';
        return '';
      };

      alert(`Called: ${getLetter(newNumber)}-${newNumber}`);
      fetchGames();
    } catch (error) {
      console.error('Error calling number:', error);
      alert('Error calling number');
    }
  };

  const handleEndGame = async (gameId) => {
    try {
      const { error } = await supabase
        .from('games')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString()
        })
        .eq('id', gameId);

      if (error) throw error;

      alert('Game ended!');
      fetchGames();
    } catch (error) {
      console.error('Error ending game:', error);
      alert('Error ending game');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    router.push('/login');
  };

  return (
    <>
      <Head>
        <title>Games - Bingo Vault Admin</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        <Navbar onLogout={handleLogout} />
        
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800">Game Management</h1>
            <button
              onClick={fetchGames}
              className="btn btn-secondary"
            >
              🔄 Refresh
            </button>
          </div>

          <div className="mb-6">
            <div className="flex space-x-2">
              <button
                onClick={() => setFilter('active')}
                className={`btn ${filter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Active
              </button>
              <button
                onClick={() => setFilter('waiting')}
                className={`btn ${filter === 'waiting' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Waiting
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={`btn ${filter === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Completed
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              >
                All
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="text-xl text-gray-600">Loading games...</div>
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-xl text-gray-600">No games found</div>
            </div>
          ) : (
            <div className="space-y-6">
              {games.map((game) => (
                <div key={game.id}>
                  <GameManager
                    game={game}
                    onCallNumber={handleCallNumber}
                    onEndGame={handleEndGame}
                    onStartGame={handleStartGame}
                  />
                  
                  {players[game.id] && players[game.id].length > 0 && (
                    <div className="card mt-4">
                      <h3 className="text-lg font-bold text-gray-800 mb-4">
                        Players ({players[game.id].length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {players[game.id].map((player) => (
                          <div
                            key={player.id}
                            className="bg-gray-50 p-4 rounded-lg"
                          >
                            <p className="font-medium text-gray-800">
                              {player.users?.username || 'Unknown'}
                            </p>
                            <p className="text-sm text-gray-600">
                              ID: {player.users?.telegram_id}
                            </p>
                            {player.is_winner && (
                              <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded">
                                🏆 WINNER
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
