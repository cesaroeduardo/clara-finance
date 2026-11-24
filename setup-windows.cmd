@echo off
setlocal
cd /d "%~dp0"

echo Clara Finance - setup Windows
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-windows.ps1" %*
set "EXITCODE=%ERRORLEVEL%"

echo.
if not "%EXITCODE%"=="0" (
  echo Setup terminou com erro ^(codigo %EXITCODE%^).
  pause
  exit /b %EXITCODE%
)

echo Setup concluido.
pause
exit /b 0
