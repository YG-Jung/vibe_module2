@echo off
chcp 65001 >nul
echo ========================================
echo 🐧 Linux Kernel 6.12 로그 뷰어 시작
echo ========================================
echo.

REM Node.js 설치 확인
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js가 설치되어 있지 않습니다!
    echo 💡 https://nodejs.org/ 에서 Node.js를 설치해주세요.
    pause
    exit /b 1
)

echo ✅ Node.js 버전:
node --version
echo.

echo 🚀 백엔드 서버 시작 중...
echo.
echo 💡 서버를 종료하려면 Ctrl+C를 누르세요.
echo 💡 웹 페이지를 열려면 index.html을 더블클릭하세요.
echo.
echo ========================================
echo.

node server.js
