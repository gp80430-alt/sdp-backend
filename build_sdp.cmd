@echo off
echo [1/3] Building Admin Dashboard...
cd admin
call npm install
call npm run build
cd ..

echo [2/3] Building Citizen Web...
cd citizen_web
call npm install
call npm run build
cd ..

echo [3/3] Compiling Smart Contracts...
cd contract
call npm install
npx hardhat compile
cd ..

echo.
echo All 3 programs built successfully!
pause
