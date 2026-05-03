@echo off
setlocal enabledelayedexpansion

echo [1/4] Fixing Git ownership security...
:: Add safe directory to avoid permission issues
git config --global --add safe.directory "D:/박영수/1.프로그램/SDP"

echo [2/4] Adding changes to Git...
git add .

echo [3/4] Committing changes...
:: Using a generic commit message, you can change this later
git commit -m "Update: Synchronizing project changes"

echo [4/4] Pushing to GitHub...
:: This will prompt for login if the token was deleted
git push

echo.
echo GitHub synchronization completed!
pause
