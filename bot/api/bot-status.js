// Simple endpoint to check bot status
export default async function handler(req, res) {
  try {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    
    if (!BOT_TOKEN) {
      return res.status(500).json({ 
        error: 'BOT_TOKEN not configured',
        timestamp: new Date().toISOString()
      });
    }

    // Get bot info
    const botInfoResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getMe`
    );
    const botInfo = await botInfoResponse.json();

    // Get webhook info
    const webhookResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
    );
    const webhookInfo = await webhookResponse.json();

    return res.status(200).json({
      status: 'Bot is configured',
      timestamp: new Date().toISOString(),
      bot: botInfo.result,
      webhook: webhookInfo.result,
      environment: {
        hasToken: !!BOT_TOKEN,
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_SERVICE_KEY,
        hasMiniAppUrl: !!process.env.MINI_APP_URL
      }
    });
  } catch (error) {
    return res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
