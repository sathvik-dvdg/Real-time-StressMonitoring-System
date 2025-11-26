@echo off
REM Startup script for Real-time Stress Monitoring System Backend

echo ========================================
echo Starting Backend Server
echo ========================================
echo.

REM Check if virtual environment exists
if exist ".venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call .venv\Scripts\activate.bat
) else (
    echo Warning: Virtual environment not found
    echo Continuing with system Python...
)

echo.
echo Checking dependencies...
python -c "import flask, google.genai, cv2, numpy" 2>nul
if errorlevel 1 (
    echo.
    echo ERROR: Missing dependencies!
    echo Please run: pip install -r requirements.txt
    pause
    exit /b 1
)

echo.
echo Starting Flask server on port 5000...
echo.
echo ========================================
echo Server will be available at:
echo   http://localhost:5000
echo   http://127.0.0.1:5000
echo ========================================
echo.
echo Press Ctrl+C to stop the server
echo.

python app.py
