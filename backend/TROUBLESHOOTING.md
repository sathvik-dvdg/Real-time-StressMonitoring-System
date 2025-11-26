# Backend Server Troubleshooting Guide

## Issue: ERR_CONNECTION_REFUSED on localhost:5000

### Root Cause
The backend Flask server (`app.py`) is not running or not accessible on port 5000.

### Solution Steps

#### Option 1: Run with Python Directly (Recommended)

1. **Stop any existing backend processes**
   ```bash
   # Press Ctrl+C in the terminal running waitress-serve or python app.py
   ```

2. **Navigate to backend directory**
   ```bash
   cd backend
   ```

3. **Activate virtual environment** (if using one)
   ```bash
   # Windows
   .venv\Scripts\activate
   
   # Linux/Mac
   source .venv/bin/activate
   ```

4. **Run the Flask app**
   ```bash
   python app.py
   ```

5. **Wait for startup messages**
   You should see:
   ```
   🔄 Attempting model init (process.py)
   🤖 Gemini ready with model: gemini-2.0-flash
   Starting local server at http://0.0.0.0:5000
   ```

6. **Verify server is running**
   Open browser and go to: `http://localhost:5000/api/health`
   
   Expected response:
   ```json
   {
     "status": "ok",
     "gemini_loaded": true
   }
   ```

#### Option 2: Use Flask Development Server

```bash
cd backend
set FLASK_APP=app.py
set FLASK_ENV=development
flask run --host=0.0.0.0 --port=5000
```

#### Option 3: Check if Port is Already in Use

```bash
# Windows
netstat -ano | findstr :5000

# Linux/Mac
lsof -i :5000
```

If port 5000 is in use, either:
- Kill the process using that port
- Change the port in `app.py` (line 261) and `recommendationService.js` (line 3)

### Common Issues

#### 1. Import Errors

**Error**: `ModuleNotFoundError: No module named 'consultant_service_v2'`

**Solution**: Make sure you're in the backend directory and all files exist:
```bash
ls -la backend/
# Should show:
# - app.py
# - consultant_service_v2.py
# - recommendation_service.py
# - process.py
```

#### 2. Missing Dependencies

**Error**: `ModuleNotFoundError: No module named 'requests'`

**Solution**: Install required packages:
```bash
pip install requests
```

#### 3. Gemini API Key Missing

**Error**: `GEMINI_API_KEY not found in .env!`

**Solution**: Create `.env` file in backend directory:
```
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.0-flash
```

#### 4. Model Loading Takes Time

The backend may take 10-30 seconds to start while loading ML models. Be patient and wait for the startup message.

### Quick Test

Once server is running, test the new endpoints:

```bash
# Test consultant endpoint
curl -X POST http://localhost:5000/api/consultants/nearby \
  -H "Content-Type: application/json" \
  -d '{"lat": 40.7128, "lon": -74.0060, "limit": 5}'

# Test recommendations endpoint
curl -X POST http://localhost:5000/api/recommendations \
  -H "Content-Type: application/json" \
  -d '{"stress_score": 65, "emotion_data": {"anxiety": 45, "sadness": 30}}'
```

### Frontend Connection

Once backend is running on port 5000, the frontend errors should disappear. Refresh the browser page to see the new features working.

### Still Having Issues?

1. Check firewall settings (allow port 5000)
2. Try using `127.0.0.1:5000` instead of `localhost:5000`
3. Check backend terminal for error messages
4. Verify Python version (3.8+ required)
5. Ensure all dependencies are installed: `pip install -r requirements.txt`
