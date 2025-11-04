// API endpoint to trigger payment notifications
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, type, status, amount, reason, method, accountNumber } = req.body;

  try {
    // Call the bot's notification service
    const botUrl = process.env.BOT_URL || 'http://localhost:3001';
    const response = await fetch(`${botUrl}/api/notify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, type, status, amount, reason, method, accountNumber })
    });

    if (!response.ok) {
      throw new Error('Failed to send notification');
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Notification error:', error);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}
