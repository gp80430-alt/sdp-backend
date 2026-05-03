@echo off
echo [1/4] Fixing Git ownership security...
git config --global --add safe.directory "D:/박영수/1.프로그램/SDP"

echo [2/4] Adding changes to Git...
git add .

echo [3/4] Committing changes...
git commit -m "Update: Backend API URL to m09z version"

echo [4/4] Pushing to GitHub...
git push

echo.
echo GitHub synchronization completed!
pause
