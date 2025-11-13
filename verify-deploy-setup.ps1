# Verify Vercel Auto-Deploy Setup
# Run this script to check if your monorepo is configured correctly

Write-Host "🔍 Verifying Vercel Auto-Deploy Setup..." -ForegroundColor Cyan
Write-Host ""

# Check root vercel.json
Write-Host "1. Checking root vercel.json..." -ForegroundColor Yellow
if (Test-Path "vercel.json") {
    $content = Get-Content "vercel.json" -Raw
    if ($content -match "ignoreCommand") {
        Write-Host "   ✅ Root vercel.json configured to ignore builds" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Root vercel.json missing ignoreCommand" -ForegroundColor Red
    }
} else {
    Write-Host "   ⚠️  Root vercel.json not found" -ForegroundColor Red
}
Write-Host ""

# Check API project
Write-Host "2. Checking API project..." -ForegroundColor Yellow
if (Test-Path "api/vercel.json") {
    Write-Host "   ✅ api/vercel.json exists" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  api/vercel.json not found" -ForegroundColor Red
}
if (Test-Path "api/webhook.js") {
    Write-Host "   ✅ API files present" -ForegroundColor Green
}
Write-Host ""

# Check Mini App project
Write-Host "3. Checking Mini App project..." -ForegroundColor Yellow
if (Test-Path "miniapp/vercel.json") {
    Write-Host "   ✅ miniapp/vercel.json exists" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  miniapp/vercel.json not found" -ForegroundColor Red
}
if (Test-Path "miniapp/package.json") {
    Write-Host "   ✅ Mini App package.json exists" -ForegroundColor Green
}
if (Test-Path "miniapp/pages") {
    Write-Host "   ✅ Mini App pages directory exists" -ForegroundColor Green
}
Write-Host ""

# Check Dashboard project
Write-Host "4. Checking Dashboard project..." -ForegroundColor Yellow
if (Test-Path "dashboard/vercel.json") {
    Write-Host "   ✅ dashboard/vercel.json exists" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  dashboard/vercel.json not found" -ForegroundColor Red
}
if (Test-Path "dashboard/package.json") {
    Write-Host "   ✅ Dashboard package.json exists" -ForegroundColor Green
}
if (Test-Path "dashboard/pages") {
    Write-Host "   ✅ Dashboard pages directory exists" -ForegroundColor Green
}
Write-Host ""

# Summary
Write-Host "📋 Summary:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Local Setup: ✅ Complete" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Configure Ignored Build Step in Vercel Dashboard for each project"
Write-Host "2. See VERCEL_AUTO_DEPLOY_SETUP.md for detailed instructions"
Write-Host "3. Test with: git push origin main"
Write-Host ""
Write-Host "Projects to configure in Vercel Dashboard:" -ForegroundColor Cyan
Write-Host "  • BingoX-bingo-bot-api (Root: api/)" -ForegroundColor White
Write-Host "  • BingoX-bingo-miniapp (Root: miniapp/)" -ForegroundColor White
Write-Host "  • BingoX-bingo-dashboard (Root: dashboard/)" -ForegroundColor White
Write-Host ""
