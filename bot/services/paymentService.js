import { supabase } from '../utils/supabaseClient.js';

/**
 * Submit a payment receipt for verification
 */
export async function submitPayment(userId, receiptNumber, imageUrl = null, amount = null) {
  try {
    const { data, error } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        receipt_number: receiptNumber,
        image_url: imageUrl,
        amount: amount,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, payment: data };
  } catch (error) {
    console.error('Error submitting payment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user by Telegram ID
 */
export async function getUserByTelegramId(telegramId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

/**
 * Create a new user with optional starting bonus
 */
export async function createUser(telegramId, username, startingBalance = 0) {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert({
        telegram_id: telegramId,
        username: username,
        balance: startingBalance,
        status: 'active' // New users with bonus are active
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, user: data };
  } catch (error) {
    console.error('Error creating user:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's pending payments
 */
export async function getPendingPayments(userId) {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting pending payments:', error);
    return [];
  }
}

/**
 * Update user balance
 */
export async function updateUserBalance(userId, amount) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ balance: amount })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, user: data };
  } catch (error) {
    console.error('Error updating balance:', error);
    return { success: false, error: error.message };
  }
}
