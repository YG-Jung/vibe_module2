@echo off
echo ========================================
echo  Linux Kernel 6.12 Log Viewer
echo ========================================
echo.

REM Check Node.js installation
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

echo Starting backend server...
echo.
echo Press Ctrl+C to stop the server.
echo Double-click index.html to open the web page.
echo.
echo ========================================
echo.

node server.js
