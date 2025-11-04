import { notifyGameWin, notifyGameLoss } from '../services/notificationService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, gameId, result, prizeAmount, winnerId } = req.body;

  try {
    if (result === 'win') {
      await notifyGameWin(userId, gameId, prizeAmount);
    } else if (result === 'loss') {
      await notifyGameLoss(userId, gameId, winnerId);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Notification error:', error);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}
