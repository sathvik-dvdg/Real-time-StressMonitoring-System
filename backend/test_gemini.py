import sys
import requests
import json

# Test the Gemini integration directly
url = "http://localhost:5000/api/process_text"

test_cases = [
    ("suicide", "Should trigger helpline and high stress"),
    ("I feel stressed right now", "Should show medium-high stress"),
    ("I'm happy today!", "Should show low stress and joy"),
]

print("=" * 70)
print("TESTING GEMINI-BASED TEXT EMOTION ANALYSIS")
print("=" * 70)

for text, expected in test_cases:
    payload = {"text": text}
    print(f"\n📝 Input: '{text}'")
    print(f"📋 Expected: {expected}")
    print("-" * 70)
    
    try:
        response = requests.post(url, json=payload, timeout=15)
        result = response.json()
        
        print(f"✅ Status: {result.get('status')}")
        print(f"🎯 Stress Score: {result.get('stress_score')}%")
        print(f"😊 Emotion: {result.get('emotion')}")
        print(f"🚨 Helpline Trigger: {result.get('helpline_trigger')}")
        print(f"📊 Detected Emotions: {result.get('detected_emotions')}")
        
        # Validation
        stress = result.get('stress_score', 0)
        trigger = result.get('helpline_trigger')
        
        if "suicide" in text.lower():
            if stress < 80:
                print(f"⚠️  WARNING: Stress should be 80-100% for crisis keyword, got {stress}%")
            if not trigger:
                print(f"⚠️  WARNING: Helpline should trigger for '{text}'")
        
    except requests.exceptions.Timeout:
        print(f"❌ ERROR: Request timed out (Gemini might be taking too long)")
    except Exception as e:
        print(f"❌ ERROR: {e}")

print("\n" + "=" * 70)
print("TEST COMPLETE")
print("=" * 70)
