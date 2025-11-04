import { 
  notifyDepositApproved, 
  notifyDepositRejected, 
  notifyWithdrawalApproved, 
  notifyWithdrawalRejected 
} from '../services/notificationService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, type, status, amount, reason, method, accountNumber } = req.body;

  try {
    if (type === 'deposit') {
      if (status === 'approved') {
        await notifyDepositApproved(userId, amount);
      } else if (status === 'rejected') {
        await notifyDepositRejected(userId, amount, reason);
      }
    } else if (type === 'withdrawal') {
      if (status === 'approved') {
        await notifyWithdrawalApproved(userId, amount, method, accountNumber);
      } else if (status === 'rejected') {
        await notifyWithdrawalRejected(userId, amount, reason);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Notification error:', error);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}
