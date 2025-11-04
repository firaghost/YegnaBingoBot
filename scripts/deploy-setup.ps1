# Bingo Vault - Vercel Deployment Setup Script (PowerShell)
# This script helps you set up environment variables before deployment

Write-Host "🎮 Bingo Vault - Vercel Deployment Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if vercel CLI is installed
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelInstalled) {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Red
    npm install -g vercel
}

Write-Host "✅ Vercel CLI is ready" -ForegroundColor Green
Write-Host ""

# Login to Vercel
Write-Host "📝 Logging in to Vercel..." -ForegroundColor Yellow
vercel login

Write-Host ""
Write-Host "🔗 Linking project to Vercel..." -ForegroundColor Yellow
vercel link

Write-Host ""
Write-Host "📋 Now let's add your environment variables" -ForegroundColor Cyan
Write-Host ""

# BOT_TOKEN
Write-Host "1️⃣ BOT_TOKEN" -ForegroundColor Yellow
Write-Host "Enter your Telegram Bot Token:"
vercel env add BOT_TOKEN

Write-Host ""

# SUPABASE_URL
Write-Host "2️⃣ SUPABASE_URL" -ForegroundColor Yellow
Write-Host "Enter your Supabase Project URL (e.g., https://xxxxx.supabase.co):"
vercel env add SUPABASE_URL

Write-Host ""

# SUPABASE_KEY
Write-Host "3️⃣ SUPABASE_KEY" -ForegroundColor Yellow
Write-Host "Enter your Supabase Service Role Key:"
vercel env add SUPABASE_KEY

Write-Host ""

# ADMIN_PASSWORD
Write-Host "4️⃣ ADMIN_PASSWORD" -ForegroundColor Yellow
Write-Host "Enter your Admin Dashboard Password:"
vercel env add ADMIN_PASSWORD

Write-Host ""

# NEXT_PUBLIC_SUPABASE_URL
Write-Host "5️⃣ NEXT_PUBLIC_SUPABASE_URL" -ForegroundColor Yellow
Write-Host "Enter your Supabase URL again (for Next.js):"
vercel env add NEXT_PUBLIC_SUPABASE_URL

Write-Host ""

# NEXT_PUBLIC_SUPABASE_ANON_KEY
Write-Host "6️⃣ NEXT_PUBLIC_SUPABASE_ANON_KEY" -ForegroundColor Yellow
Write-Host "Enter your Supabase Anon/Public Key:"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY

Write-Host ""
Write-Host "✅ All environment variables added!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Ready to deploy!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run: vercel --prod" -ForegroundColor Yellow
Write-Host ""
