# ============================================
# BingoX Level System & Leaderboard Setup
# PowerShell Script for Windows
# ============================================

Write-Host "🎮 BingoX Level System & Leaderboard Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if required files exist
$requiredFiles = @(
    "supabase\levels_and_leaderboard_system.sql",
    "lib\level-handlers.ts",
    "app\api\game\complete\route.ts",
    "app\api\leaderboard\route.ts"
)

Write-Host "📋 Checking required files..." -ForegroundColor Yellow
$missingFiles = @()
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file" -ForegroundColor Green
    } else {
        Write-Host "❌ $file" -ForegroundColor Red
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ Missing required files. Please ensure all files are created first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📊 All required files found!" -ForegroundColor Green
Write-Host ""

# Check environment variables
Write-Host "🔧 Checking environment configuration..." -ForegroundColor Yellow

if (-not $env:SUPABASE_URL) {
    Write-Host "⚠️  SUPABASE_URL not found in environment" -ForegroundColor Yellow
}

if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
    Write-Host "⚠️  SUPABASE_SERVICE_ROLE_KEY not found in environment" -ForegroundColor Yellow
}

if (-not $env:BOT_TOKEN) {
    Write-Host "⚠️  BOT_TOKEN not found in environment" -ForegroundColor Yellow
}

Write-Host ""

# Installation steps
Write-Host "🚀 Installation Steps:" -ForegroundColor Cyan
Write-Host ""

Write-Host "1️⃣  Database Setup:" -ForegroundColor White
Write-Host "   • Go to your Supabase project dashboard" -ForegroundColor Gray
Write-Host "   • Open SQL Editor" -ForegroundColor Gray
Write-Host "   • Copy and paste the contents of:" -ForegroundColor Gray
Write-Host "     supabase\levels_and_leaderboard_system.sql" -ForegroundColor Yellow
Write-Host "   • Run the SQL script" -ForegroundColor Gray
Write-Host ""

Write-Host "2️⃣  Bot Configuration:" -ForegroundColor White
Write-Host "   • The bot handlers are already updated" -ForegroundColor Gray
Write-Host "   • New commands added: /levels, /mystats, /leaderboard" -ForegroundColor Gray
Write-Host "   • Admin commands: /setxp, /resetleaderboard" -ForegroundColor Gray
Write-Host ""

Write-Host "3️⃣  API Endpoints:" -ForegroundColor White
Write-Host "   • Game completion: /api/game/complete" -ForegroundColor Gray
Write-Host "   • Leaderboard data: /api/leaderboard" -ForegroundColor Gray
Write-Host ""

Write-Host "4️⃣  Environment Variables:" -ForegroundColor White
Write-Host "   Add to your .env.local file:" -ForegroundColor Gray
Write-Host "   ADMIN_API_KEY=your_secure_admin_key_here" -ForegroundColor Yellow
Write-Host ""

# Manual verification steps
Write-Host "✅ Verification Steps:" -ForegroundColor Green
Write-Host ""

Write-Host "1. Database Tables Created:" -ForegroundColor White
Write-Host "   • levels (easy, medium, hard)" -ForegroundColor Gray
Write-Host "   • leaderboard (weekly/monthly tracking)" -ForegroundColor Gray
Write-Host "   • leaderboard_history (archives)" -ForegroundColor Gray
Write-Host "   • users table extended with XP fields" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Test Bot Commands:" -ForegroundColor White
Write-Host "   • /start - Should work as before" -ForegroundColor Gray
Write-Host "   • /levels - Shows difficulty levels" -ForegroundColor Gray
Write-Host "   • /leaderboard - Shows weekly rankings" -ForegroundColor Gray
Write-Host "   • /mystats - Shows personal XP and stats" -ForegroundColor Gray
Write-Host ""

Write-Host "3. Test Game Flow:" -ForegroundColor White
Write-Host "   • Start a game with difficulty selection" -ForegroundColor Gray
Write-Host "   • Complete a game (win/lose)" -ForegroundColor Gray
Write-Host "   • Check XP gain and leaderboard update" -ForegroundColor Gray
Write-Host ""

# Feature overview
Write-Host "🎯 New Features Implemented:" -ForegroundColor Cyan
Write-Host ""

Write-Host "📊 Dynamic Game Levels:" -ForegroundColor White
Write-Host "   • Easy: 1s intervals, 3 matches, 10 XP" -ForegroundColor Gray
Write-Host "   • Medium: 2s intervals, 5 matches, 25 XP" -ForegroundColor Gray
Write-Host "   • Hard: 3s intervals, 7 matches, 50 XP" -ForegroundColor Gray
Write-Host ""

Write-Host "🏆 XP & Ranking System:" -ForegroundColor White
Write-Host "   • Beginner: 0-100 XP 🌱" -ForegroundColor Gray
Write-Host "   • Skilled: 101-300 XP 💪" -ForegroundColor Gray
Write-Host "   • Expert: 301-600 XP ⭐" -ForegroundColor Gray
Write-Host "   • Master: 601-1000 XP 🔥" -ForegroundColor Gray
Write-Host "   • Legend: 1000+ XP 👑" -ForegroundColor Gray
Write-Host ""

Write-Host "📈 Leaderboard System:" -ForegroundColor White
Write-Host "   • Weekly rankings (resets every week)" -ForegroundColor Gray
Write-Host "   • Monthly rankings (resets every month)" -ForegroundColor Gray
Write-Host "   • Historical data preservation" -ForegroundColor Gray
Write-Host "   • Real-time rank calculation" -ForegroundColor Gray
Write-Host ""

Write-Host "🔧 Admin Features:" -ForegroundColor White
Write-Host "   • /setxp <level> <amount> - Update XP rewards" -ForegroundColor Gray
Write-Host "   • /resetleaderboard <period> - Reset rankings" -ForegroundColor Gray
Write-Host "   • API endpoints for management" -ForegroundColor Gray
Write-Host ""

# Next steps
Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Run the SQL script in Supabase" -ForegroundColor White
Write-Host "2. Add ADMIN_API_KEY to your environment" -ForegroundColor White
Write-Host "3. Restart your bot and web application" -ForegroundColor White
Write-Host "4. Test the new commands and features" -ForegroundColor White
Write-Host "5. Configure admin access for your Telegram ID" -ForegroundColor White
Write-Host ""

Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   • All functions are documented in the SQL file" -ForegroundColor Gray
Write-Host "   • Bot commands have built-in help messages" -ForegroundColor Gray
Write-Host "   • API endpoints include error handling" -ForegroundColor Gray
Write-Host ""

Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "Your BingoX bot now has a complete level system and leaderboard!" -ForegroundColor Green
Write-Host ""

# Pause to let user read
Write-Host "Press any key to continue..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
