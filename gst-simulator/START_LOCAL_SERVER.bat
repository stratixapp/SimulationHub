@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  echo Starting local server at http://localhost:8000/
  start "GST Simulator" http://localhost:8000/index.html
  py -m http.server 8000
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  echo Starting local server at http://localhost:8000/
  start "GST Simulator" http://localhost:8000/index.html
  python -m http.server 8000
  goto :eof
)
echo Python was not found. Use GitHub Pages for PWA installation or install Python.
pause
