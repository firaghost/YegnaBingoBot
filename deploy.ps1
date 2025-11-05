# Deployment Script for Yegna Bingo Bot
# This script helps with initial Vercel setup

Write-Host "🚀 Yegna Bingo Bot - Deployment Helper" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# Check if git is initialized
if (-not (Test-Path ".git")) {
    Write-Host "❌ Git repository not initialized!" -ForegroundColor Red
    Write-Host "Run: git init" -ForegroundColor Yellow
    exit 1
}

# Check for uncommitted changes
$status = git status --porcelain
if ($status) {
    Write-Host "📝 You have uncommitted changes:" -ForegroundColor Yellow
    Write-Host ""
    git status --short
    Write-Host ""
    
    $commit = Read-Host "Do you want to commit these changes? (y/n)"
    if ($commit -eq "y") {
        $message = Read-Host "Enter commit message"
        git add .
        git commit -m "$message"
        Write-Host "✅ Changes committed!" -ForegroundColor Green
    }
}

# Check if remote is set
$remote = git remote -v
if (-not $remote) {
    Write-Host "❌ No Git remote configured!" -ForegroundColor Red
    Write-Host "Add your GitHub repository:" -ForegroundColor Yellow
    Write-Host "git remote add origin https://github.com/yourusername/YegnaBingoBot.git" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "📋 Deployment Checklist:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Have you completed these steps in Vercel Dashboard?" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Created 3 separate Vercel projects:" -ForegroundColor White
Write-Host "   - yegna-bingo-bot (Root: ./)" -ForegroundColor Gray
Write-Host "   - yegna-bingo-miniapp (Root: miniapp/)" -ForegroundColor Gray
Write-Host "   - yegna-bingo-dashboard (Root: dashboard/)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Set environment variables for each project" -ForegroundColor White
Write-Host ""
Write-Host "3. Enabled auto-deploy on main branch" -ForegroundColor White
Write-Host ""

$ready = Read-Host "Are all Vercel projects configured? (y/n)"
if ($ready -ne "y") {
    Write-Host ""
    Write-Host "⚠️  Please complete Vercel setup first!" -ForegroundColor Yellow
    Write-Host "See VERCEL_AUTO_DEPLOY.md for detailed instructions" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔄 Vercel is now deploying your projects..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Check deployment status at:" -ForegroundColor Yellow
    Write-Host "https://vercel.com/dashboard" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Your projects will be live at:" -ForegroundColor Yellow
    Write-Host "Bot API: https://yegna-bingo-bot.vercel.app" -ForegroundColor Blue
    Write-Host "Mini App: https://yegna-bingo-miniapp.vercel.app" -ForegroundColor Blue
    Write-Host "Dashboard: https://yegna-bingo-dashboard.vercel.app" -ForegroundColor Blue
    Write-Host ""
    Write-Host "⏳ Deployment usually takes 1-2 minutes" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "❌ Push failed!" -ForegroundColor Red
    Write-Host "Check your Git configuration and try again" -ForegroundColor Yellow
}
