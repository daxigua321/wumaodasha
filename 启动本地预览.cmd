@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  start "本地预览服务" cmd /k py -m http.server 8765 --bind 127.0.0.1
) else (
  start "本地预览服务" cmd /k python -m http.server 8765 --bind 127.0.0.1
)
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8765/"
