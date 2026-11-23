@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 20+ o‘rnating. & pause & exit /b 1)
if not exist node_modules npm install
npm run dev -- --host 0.0.0.0
pause
