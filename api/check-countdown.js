import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Store active countdowns and games
const activeCountdowns = new Map();
const activeGames = new Map();

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameId } = req.body;

  if (!gameId) {
    return res.status(400).json({ error: 'Game ID is required' });
  }

  try {
    await checkAndStartCountdown(gameId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Countdown check error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function checkAndStartCountdown(gameId) {
  // Check if countdown already active
  if (activeCountdowns.has(gameId)) {
    console.log(`⏰ Countdown already active for game ${gameId}`);
    return;
  }

  // Get game and player count
  const { data: game, error } = await supabase
    .from('games')
    .select(`
      *,
      game_players (id)
    `)
    .eq('id', gameId)
    .single();

  if (error) throw error;

  const playerCount = game.game_players?.length || 0;

  // Start countdown if 2+ players and game is waiting
  if (playerCount >= 2 && game.status === 'waiting') {
    console.log(`🎮 Starting countdown for game ${gameId} with ${playerCount} players`);
    await startCountdown(gameId);
  }
}

async function startCountdown(gameId) {
  const countdownEnd = new Date(Date.now() + 60000); // 60 seconds

  // Update game with countdown end time
  await supabase
    .from('games')
    .update({ 
      countdown_end: countdownEnd.toISOString()
    })
    .eq('id', gameId);

  console.log(`⏰ Countdown started for game ${gameId}`);

  // Set timeout to auto-start game
  const timeout = setTimeout(async () => {
    await autoStartGame(gameId);
    activeCountdowns.delete(gameId);
  }, 60000);

  activeCountdowns.set(gameId, timeout);
}

async function autoStartGame(gameId) {
  console.log(`🚀 Auto-starting game ${gameId}`);

  // Call start-game API
  const response = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/start-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId })
  });

  if (response.ok) {
    const result = await response.json();
    console.log(`✅ Game auto-started: ${result.playersCharged} players`);
    
    // Start auto number calling
    await startAutoNumberCalling(gameId);
  }
}

async function startAutoNumberCalling(gameId) {
  console.log(`🔢 Starting auto number calling for game ${gameId}`);

  const interval = setInterval(async () => {
    try {
      const { data: game } = await supabase
        .from('games')
        .select('status, called_numbers')
        .eq('id', gameId)
        .single();

      if (game.status !== 'active') {
        clearInterval(interval);
        activeGames.delete(gameId);
        return;
      }

      const calledNumbers = game.called_numbers || [];
      if (calledNumbers.length >= 75) {
        clearInterval(interval);
        activeGames.delete(gameId);
        return;
      }

      // Generate next number
      const availableNumbers = [];
      for (let i = 1; i <= 75; i++) {
        if (!calledNumbers.includes(i)) availableNumbers.push(i);
      }

      if (availableNumbers.length === 0) {
        clearInterval(interval);
        return;
      }

      const nextNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
      const updatedNumbers = [...calledNumbers, nextNumber];

      await supabase
        .from('games')
        .update({ 
          called_numbers: updatedNumbers,
          last_number: nextNumber
        })
        .eq('id', gameId);

      console.log(`🔢 Called number ${nextNumber} (${updatedNumbers.length}/75)`);
    } catch (error) {
      console.error('Error calling number:', error);
    }
  }, 5000); // Every 5 seconds

  activeGames.set(gameId, interval);
}
