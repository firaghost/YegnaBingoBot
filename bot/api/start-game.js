import { startGame } from '../services/gameService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameId } = req.body;

  if (!gameId) {
    return res.status(400).json({ error: 'Game ID is required' });
  }

  try {
    const result = await startGame(gameId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({
      success: true,
      game: result.game,
      playersCharged: result.playersCharged
    });
  } catch (error) {
    console.error('Start game API error:', error);
    return res.status(500).json({ error: 'Failed to start game' });
  }
}
