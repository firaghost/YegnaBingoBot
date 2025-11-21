import './telegram-bot'

console.log('🚀 Starting Telegram Bot...')
console.log('📱 Bot Token:', process.env.BOT_TOKEN ? '✓ Configured' : '✗ Missing')
console.log('🌐 Mini App URL:', process.env.MINI_APP_URL || 'http://localhost:3000')
