@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference = 'Stop'; $files = Get-ChildItem -File | Where-Object { @('.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif') -contains $_.Extension.ToLowerInvariant() } | Sort-Object Name; $baseTime = [DateTime]::Now; $index = 0; foreach ($file in $files) { $stamp = $baseTime.AddSeconds($index).ToString('yyyyMMddHHmmss', [Globalization.CultureInfo]::InvariantCulture); $index++; $newName = 'SK_' + $stamp + $file.Extension; if (Test-Path -LiteralPath $newName) { throw ('Target already exists: ' + $newName) }; Rename-Item -LiteralPath $file.FullName -NewName $newName }; Write-Output ('Renamed ' + $index + ' image(s).')"
if errorlevel 1 (
    echo Failed to rename images.
    pause
    exit /b 1
)

echo Newest timestamped filenames will appear first in the gallery.
pause
