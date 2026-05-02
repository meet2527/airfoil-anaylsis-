@echo off
color 0B
echo ===================================================
echo     AIRFOIL POLAR ANALYSIS SUITE
echo ===================================================
echo.
echo Starting FastAPI Backend Server...
start "Airfoil Backend" cmd /k "python -m uvicorn backend.server:app --reload"

echo.
echo Waiting for server to initialize...
timeout /t 3 /nobreak > NUL

echo.
echo Opening Dashboard in your default web browser...
start index.html

echo.
echo ===================================================
echo Ready! You can minimize this window.
echo Note: Do not close the other terminal window until
echo you are finished using the application.
echo ===================================================
timeout /t 3 > NUL
