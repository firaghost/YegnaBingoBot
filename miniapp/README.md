# 🎮 Bingo Vault Mini App

Telegram Mini App for Bingo Vault game.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd miniapp
npm install
```

### 2. Set Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://mrayxghardqswonihwjs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001)

## 📦 Deploy to Vercel

```bash
# From miniapp directory
vercel

# Add environment variables when prompted:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY

# Deploy to production
vercel --prod
```

## 🎯 Features

- ✅ Game selection interface (5, 7, 10, 20, 50, 100 Birr)
- ✅ Number selection grid (1-100)
- ✅ Bingo card display
- ✅ Telegram Web App integration
- ✅ Real-time balance display
- ✅ Responsive design
- ✅ Amharic language support

## 📱 Pages

- `/` - Game selection
- `/game/[fee]` - Number selection
- `/bingo/[fee]` - Bingo card display

## 🎨 Design

- Primary Color: #2563EB (Blue)
- Secondary Color: #1E40AF (Dark Blue)
- Accent Color: #F97316 (Orange)
- Danger Color: #EF4444 (Red)

## 🔗 Integration

After deploying, update bot environment variable:

```env
MINI_APP_URL=https://your-miniapp.vercel.app
```

Then redeploy the bot.

## 🧪 Testing

Test locally without Telegram:
- App will use mock user data
- All features work except Telegram-specific APIs

Test in Telegram:
- Use BotFather to set Mini App URL
- Test via /play command in bot

## 📝 Notes

- Built with Next.js 14
- Uses Telegram Web App SDK
- Connects to Supabase database
- Mobile-first responsive design
