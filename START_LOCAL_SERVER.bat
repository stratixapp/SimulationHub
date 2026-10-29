@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  echo Starting local server at http://localhost:8000/
  start "Simulator Hub" http://localhost:8000/index.html
  py -m http.server 8000
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  echo Starting local server at http://localhost:8000/
  start "Simulator Hub" http://localhost:8000/index.html
  python -m http.server 8000
  goto :eof
)
echo Python was not found. Install Python from python.org, or open the hub in Chrome / Edge.
pause
