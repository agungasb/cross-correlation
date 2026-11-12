@echo off
title MT5 Execution Gateway
cd /d "%~dp0\.."
echo ========================================================
echo   Starting MT5 Quantitative Execution Gateway...
echo ========================================================
python -m mt5_bridge.server
pause
