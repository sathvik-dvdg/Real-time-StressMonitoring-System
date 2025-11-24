import requests
import json

url = "http://localhost:5000/api/process_text"

test_cases = [
    "suicide",
    "I feel stressed right now",
    "I'm happy today",
]

for text in test_cases:
    payload = {"text": text}
    print(f"\n{'='*60}")
    print(f"Testing: '{text}'")
    print('='*60)
    
    try:
        response = requests.post(url, json=payload)
        result = response.json()
        print(f"Status: {result.get('status')}")
        print(f"Stress Score: {result.get('stress_score')}%")
        print(f"Emotion: {result.get('emotion')}")
        print(f"Detected Emotions: {result.get('detected_emotions')}")
        print(f"Helpline Trigger: {result.get('helpline_trigger')}")
        print(f"Dashboard Data: {json.dumps(result.get('dashboard_data'), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")
