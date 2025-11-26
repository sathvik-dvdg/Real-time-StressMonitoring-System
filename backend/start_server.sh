#!/bin/bash
# Startup script for Real-time Stress Monitoring System Backend

echo "========================================"
echo "Starting Backend Server"
echo "========================================"
echo ""

# Check if virtual environment exists
if [ -d ".venv" ]; then
    echo "Activating virtual environment..."
    source .venv/bin/activate
else
    echo "Warning: Virtual environment not found"
    echo "Continuing with system Python..."
fi

echo ""
echo "Checking dependencies..."
python -c "import flask, google.genai, cv2, numpy" 2>/dev/null
if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Missing dependencies!"
    echo "Please run: pip install -r requirements.txt"
    exit 1
fi

echo ""
echo "Starting Flask server on port 5000..."
echo ""
echo "========================================"
echo "Server will be available at:"
echo "  http://localhost:5000"
echo "  http://127.0.0.1:5000"
echo "========================================"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python app.py
