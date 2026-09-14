#!/usr/bin/env pwsh
# Drawing.art Deployment Script
# यह स्क्रिप्ट build करता है और GitHub पर deploy करता है

Write-Host "🚀 Drawing.art Build & Deploy Script" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Step 1: Build
Write-Host "`n📦 Building Angular app..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build completed successfully!" -ForegroundColor Green

# Step 2: Git commit and push
Write-Host "`n📤 Pushing to GitHub..." -ForegroundColor Yellow

# Check if there are changes
$status = git status --porcelain
if ($status) {
    git add -A
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    git commit -m "Deploy: $timestamp"
    git push
    Write-Host "✅ Pushed to GitHub successfully!" -ForegroundColor Green
} else {
    Write-Host "⚠️  No changes to commit. Skipping push." -ForegroundColor Yellow
}

# Step 3: Information
Write-Host "`n✅ Deployment initiated!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. GitHub Actions will build & deploy automatically"
Write-Host "2. Check progress: https://github.com/engineersushil90-ux/drawing.art/actions"
Write-Host "3. Site will be live at: https://smarttraffic.in (in 2-3 minutes)"
Write-Host "======================================" -ForegroundColor Cyan
