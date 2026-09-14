@echo off
REM Drawing.art Deployment Script for Windows
REM यह स्क्रिप्ट build करता है और GitHub पर deploy करता है

echo.
echo 🚀 Drawing.art Build and Deploy
echo ======================================
echo.

REM Step 1: Build
echo 📦 Building Angular app...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Build failed!
    exit /b 1
)
echo ✅ Build completed successfully!

REM Step 2: Git commit and push
echo.
echo 📤 Pushing to GitHub...
git add -A
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a:%%b)
git commit -m "Deploy: %mydate% %mytime%"
git push

REM Step 3: Information
echo.
echo ✅ Deployment initiated!
echo ======================================
echo 📋 Next steps:
echo 1. GitHub Actions will build and deploy automatically
echo 2. Check progress: https://github.com/engineersushil90-ux/drawing.art/actions
echo 3. Site will be live at: https://smarttraffic.in (in 2-3 minutes)
echo ======================================
echo.
pause
