@echo off
setlocal EnableDelayedExpansion

for %%F in (*.jpg *.jpeg *.png *.webp) do (
    set /a NUM=!RANDOM! * 1000 + !RANDOM!
    ren "%%F" "SK!NUM!%%~xF"
)

echo.
echo All image names changed successfully!
pause