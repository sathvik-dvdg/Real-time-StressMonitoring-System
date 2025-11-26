# Quick Start Guide - Dynamic Location & AI Recommendations

## 🚀 Running the Application

### 1. Start Backend Server

```bash
cd backend
python app.py
```

**Expected Output:**
```
🔄 Model init complete
🤖 Gemini ready with model: gemini-2.0-flash
Starting local server at http://0.0.0.0:5000
```

### 2. Start Frontend Development Server

```bash
cd frontend
npm run dev
```

**Expected Output:**
```
VITE ready in XXX ms
➜  Local:   http://localhost:5173/
```

### 3. Open Browser

Navigate to: `http://localhost:5173`

---

## ✅ Quick Test Checklist

### Test 1: AI Recommendations (2 minutes)

1. ✅ Login to the application
2. ✅ Click "Start New Session" button
3. ✅ Complete a stress monitoring session
4. ✅ Return to Dashboard
5. ✅ **Verify**: "AI-Powered Wellness Recommendations" panel appears
6. ✅ **Verify**: Recommendations are displayed based on your stress level
7. ✅ Click the refresh icon (↻)
8. ✅ **Verify**: New recommendations are generated

### Test 2: Location-Based Consultant Search (3 minutes)

1. ✅ Scroll to "Find Nearby Wellness Professionals" section
2. ✅ Click **"Use My Location"** button
3. ✅ **Verify**: Browser asks for location permission
4. ✅ Grant permission
5. ✅ **Verify**: Consultant list appears with distances
6. ✅ Click **"Enter Location Manually"**
7. ✅ Type a city name (e.g., "San Francisco")
8. ✅ Click **"Search"**
9. ✅ **Verify**: Results update based on entered location

### Test 3: Dynamic Updates (1 minute)

1. ✅ Start another session with different stress level
2. ✅ Return to Dashboard
3. ✅ **Verify**: Recommendations automatically update
4. ✅ **Verify**: Stress indicator color changes (green/yellow/red)

---

## 🔧 Troubleshooting

### Issue: "Gemini not configured" error

**Solution:** Ensure `GEMINI_API_KEY` is set in `backend/.env`:
```
GEMINI_API_KEY=your_api_key_here
```

### Issue: Location permission denied

**Solution:** 
1. Use "Enter Location Manually" option
2. OR reset browser permissions for localhost

### Issue: No consultants found

**Expected Behavior:** System will show virtual/online therapy options as fallback

### Issue: CORS errors

**Solution:** Verify backend is running on port 5000 and frontend on 5173

---

## 📊 Expected Behavior

### Recommendations Based on Stress Level

| Stress Level | Color | Recommendations Include |
|-------------|-------|------------------------|
| 0-29% (Low) | 🟢 Green | Gratitude exercises, appreciation activities |
| 30-59% (Moderate) | 🟡 Yellow | Breathing exercises, short breaks, meditation |
| 60-100% (High) | 🔴 Red | Professional support, crisis resources, immediate relief |

### Consultant Search Results

- **With Location**: Shows nearby hospitals/wellness centers with distances
- **Without Location**: Shows virtual therapy platforms (BetterHelp, Talkspace, 7 Cups)
- **Different Locations**: Results change based on geographic area

---

## 🎯 Success Criteria

✅ No hardcoded consultant data  
✅ No hardcoded recommendations  
✅ Location updates dynamically  
✅ Recommendations adapt to stress level  
✅ Smooth animations and loading states  
✅ Error messages are clear and helpful  
✅ All features work without crashes  

---

## 📝 Files Modified/Created

### Backend
- ✅ `backend/recommendation_service.py` (NEW)
- ✅ `backend/app.py` (MODIFIED - added 2 endpoints)

### Frontend
- ✅ `frontend/src/components/recommendationService.js` (MODIFIED)
- ✅ `frontend/src/components/ConsultantFinder.jsx` (NEW)
- ✅ `frontend/src/components/RecommendationPanel.jsx` (NEW)
- ✅ `frontend/src/components/Dashboard.jsx` (MODIFIED)

---

## 🎉 You're All Set!

The system now provides:
- **Real-time AI recommendations** based on your stress and emotions
- **Dynamic location-based consultant search** using your actual location
- **Beautiful, responsive UI** with smooth animations
- **No hardcoded data** - everything is personalized and dynamic

Enjoy your enhanced stress monitoring experience! 🧘‍♀️
