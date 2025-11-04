# 🚀 Mini App Deployment Guide

## ✅ What's Been Built

### Mini App Features:
1. ✅ **Game Selection Page** - Choose from 5, 7, 10, 20, 50, 100 Birr games
2. ✅ **Number Selection Grid** - Interactive 1-100 number grid
3. ✅ **Bingo Card Display** - Visual bingo card with BINGO letters
4. ✅ **Telegram Integration** - Full Web App SDK support
5. ✅ **Responsive Design** - Mobile-first, matches screenshots
6. ✅ **Amharic Support** - Ethiopian language interface

### Bot Updates:
1. ✅ **Complete Menu System** - All 18 commands
2. ✅ **Contact Sharing** - Phone number registration
3. ✅ **5 Birr Entry Fee** - Reduced from 10 Birr
4. ✅ **Mini App Launch Button** - Opens game interface

---

## 📋 Deployment Steps

### Step 1: Install Mini App Dependencies

```powershell
cd miniapp
npm install
```

### Step 2: Create Environment File

Create `miniapp/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://mrayxghardqswonihwjs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yYXl4Z2hhcmRxc3dvbmlod2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNDAwMjMsImV4cCI6MjA3NzgxNjAyM30.fccY-cedgjsgsAIefDPFOuF6jtm-vdaA7VYcIFhm1jU
```

### Step 3: Test Locally

```powershell
npm run dev
```

Open http://localhost:3001 and test:
- Game selection works
- Number grid is interactive
- Bingo card displays correctly

### Step 4: Deploy Mini App to Vercel

```powershell
# From miniapp directory
vercel

# When prompted:
# Project name: bingo-vault-miniapp
# Directory: ./
```

Add environment variables:
```
NEXT_PUBLIC_SUPABASE_URL=https://mrayxghardqswonihwjs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yYXl4Z2hhcmRxc3dvbmlod2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNDAwMjMsImV4cCI6MjA3NzgxNjAyM30.fccY-cedgjsgsAIefDPFOuF6jtm-vdaA7VYcIFhm1jU
```

Deploy:
```powershell
vercel --prod
```

**Save the URL!** (e.g., `https://bingo-vault-miniapp.vercel.app`)

---

### Step 5: Update Bot with Mini App URL

Add to bot environment variables in Vercel:

```
MINI_APP_URL=https://bingo-vault-miniapp.vercel.app
```

Then redeploy bot:
```powershell
cd ..
vercel --prod
```

Update webhook with new bot URL.

---

### Step 6: Configure Bot Menu Button

Set the Mini App as menu button:

```powershell
# Set menu button
$body = @{
    menu_button = @{
        type = "web_app"
        text = "🎮 Play Bingo"
        web_app = @{
            url = "https://bingo-vault-miniapp.vercel.app"
        }
    }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "https://api.telegram.org/bot7940176711:AAH7nSFkV92xMHmXTN__B_AaNl4CwjzVQJw/setChatMenuButton" -Method Post -ContentType "application/json" -Body $body
```

---

## 🧪 Testing Complete Flow

### 1. Test Registration
- Send `/start` to bot
- Share contact
- Receive 5 Birr bonus

### 2. Test Menu
- Click "Menu" button
- See all 18 commands
- Try different commands

### 3. Test Mini App
- Click `/play` or menu button
- Mini App opens
- See game selection
- Select a game
- Choose numbers
- View bingo card

---

## 📊 Project Structure

```
YegnaBingoBot/
├── bot/                    # Telegram Bot
│   ├── commands/
│   │   ├── start.js       # Contact sharing
│   │   ├── play.js        # Mini App launch
│   │   └── menu.js        # All commands
│   └── ...
├── miniapp/               # Mini App (NEW!)
│   ├── pages/
│   │   ├── index.js       # Game selection
│   │   ├── game/[fee].js  # Number selection
│   │   └── bingo/[fee].js # Bingo card
│   ├── components/
│   ├── lib/
│   │   ├── telegram.js    # Telegram SDK
│   │   └── supabase.js    # Database
│   └── styles/
└── dashboard/             # Admin Dashboard
```

---

## 🎯 What Works Now

### Bot:
- ✅ Contact sharing registration
- ✅ 5 Birr welcome bonus
- ✅ Complete menu with 18 commands
- ✅ Mini App launch button
- ✅ All commands respond

### Mini App:
- ✅ Game selection (6 options)
- ✅ Number grid (1-100)
- ✅ Bingo card display
- ✅ Balance display
- ✅ Telegram integration
- ✅ Responsive design

---

## 🔄 What's Next (Optional Enhancements)

### Phase 3: Real-time Game Logic
- [ ] Live number calling
- [ ] Winner detection
- [ ] Prize distribution
- [ ] Multiple players view
- [ ] Game history

### Phase 4: Advanced Features
- [ ] Tournaments
- [ ] Leaderboards
- [ ] Chat during game
- [ ] Sound effects
- [ ] Animations

---

## 🆘 Troubleshooting

### Mini App not loading?
- Check Vercel deployment logs
- Verify environment variables
- Test URL directly in browser

### Bot not launching Mini App?
- Verify `MINI_APP_URL` is set
- Check bot is redeployed
- Test menu button configuration

### Numbers not selecting?
- Check browser console for errors
- Verify Telegram SDK loaded
- Test in different browser

---

## 📝 Deployment Checklist

- [ ] Mini App dependencies installed
- [ ] Environment variables set
- [ ] Mini App deployed to Vercel
- [ ] Bot `MINI_APP_URL` updated
- [ ] Bot redeployed
- [ ] Webhook updated
- [ ] Menu button configured
- [ ] Tested `/start` registration
- [ ] Tested `/play` Mini App launch
- [ ] Tested complete game flow

---

## 🎉 You're Done!

Your complete Bingo Vault system is now live with:
- ✅ Telegram Bot with full menu
- ✅ Visual Mini App interface
- ✅ Admin Dashboard
- ✅ Supabase Database
- ✅ All deployed on Vercel

**Total deployment time: ~30 minutes**

Enjoy your Bingo game! 🎮
