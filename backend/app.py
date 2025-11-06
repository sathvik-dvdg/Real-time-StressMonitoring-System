# ===================================================
# IMPORTS
# ===================================================
import os
from dotenv import load_dotenv  # <-- Import the dotenv library

# --- 💥 CRITICAL: Load .env file ---
# This line MUST be at the very top of your script.
# It reads your .env file and loads keys into os.environ
load_dotenv()

import base64
import joblib
import cv2
import mediapipe as mp
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from math import hypot
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from scipy.special import expit  # More stable sigmoid

# --- Firebase Imports ---
import firebase_admin
from firebase_admin import credentials, firestore

# --- Gemini API Imports ---
import google.generativeai as genai

app = Flask(__name__)

# --- Configuration ---
# FIX: Use the correct frontend port 5173
CORS(app, resources={
    r"/api/*": {"origins": "http://localhost:5173"}
})

# -----------------------------------------------------------------
# 1. FIREBASE & GEMINI INITIALIZATION
# -----------------------------------------------------------------

# --- Firebase Initialization ---
try:
    cred = credentials.Certificate("firebase/serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✅ Firebase initialized successfully.")
except Exception as e:
    print(f"❌ Error initializing Firebase: {e}")
    db = None

# --- Gemini API Initialization ---
try:
    GEMINI_API_KEY = os.environ.get("GOOGLE_API_KEY")
    if not GEMINI_API_KEY:
        print("❌ Error: GOOGLE_API_KEY not found in .env file or environment.")
        gemini_model = None
    else:
        genai.configure(api_key=GEMINI_API_KEY)
        # 💥 FIX: Use the latest model name for the upgraded library
        gemini_model = genai.GenerativeModel('gemini-2.5-flash')
        print("✅ Gemini API configured successfully (loaded from .env).")
except Exception as e:
    print(f"❌ Error configuring Gemini: {e}")
    gemini_model = None

# -----------------------------------------------------------------
# 2. FACIAL STRESS MODEL (Your Existing Code)
# -----------------------------------------------------------------
print("⚙️ Loading Facial Stress Model...")
try:
    facial_model = joblib.load('stress_classifier.joblib')
    facial_scaler = joblib.load('scaler.joblib')
    print("✅ Facial Model and scaler loaded successfully.")
except FileNotFoundError:
    print("❌ Error: 'stress_classifier.joblib' or 'scaler.joblib' not found in backend/ directory.")
    facial_model = None
    facial_scaler = None

# --- Mediapipe setup ---
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, min_detection_confidence=0.5)

# --- Facial Feature Definitions ---
L_EYE = [362, 385, 387, 263, 373, 380]
MOUTH_MAR = [61, 39, 37, 269, 270, 267]
EYEBROW_FURROWING = [55, 285]

# --- Facial Helper Functions ---
def calculate_ear(eye_landmarks, landmarks):
    p2, p3 = landmarks[eye_landmarks[1]], landmarks[eye_landmarks[2]]
    p5, p6 = landmarks[eye_landmarks[4]], landmarks[eye_landmarks[5]]
    dist_vertical = hypot(p2.x - p6.x, p2.y - p6.y)
    dist_horizontal = hypot(p3.x - p5.x, p3.y - p5.y)
    return dist_vertical / (2.0 * dist_horizontal) if dist_horizontal != 0 else 0

def calculate_mar(mouth_landmarks, landmarks):
    p1, p2 = landmarks[mouth_landmarks[0]], landmarks[mouth_landmarks[1]]
    p3, p4 = landmarks[mouth_landmarks[2]], landmarks[mouth_landmarks[3]]
    p5 = landmarks[mouth_landmarks[4]]
    dist_horizontal = hypot(p1.x - p5.x, p1.y - p5.y)
    dist_vertical = hypot(p2.x - p4.x, p2.y - p4.y)
    return dist_vertical / dist_horizontal if dist_horizontal != 0 else 0

def calculate_eyebrow_distance(landmarks):
    p1, p2 = landmarks[EYEBROW_FURROWING[0]], landmarks[EYEBROW_FURROWING[1]]
    return hypot(p1.x - p2.x, p1.y - p2.y)

def get_head_pose_features(landmarks):
    nose_tip, chin = landmarks[1], landmarks[152]
    left_eye, right_eye = landmarks[263], landmarks[33]
    yaw_denominator = (chin.x - nose_tip.x)
    yaw = (right_eye.x - left_eye.x) / yaw_denominator if yaw_denominator != 0 else 0
    pitch_denominator = (right_eye.y - left_eye.y)
    pitch = (nose_tip.y - chin.y) / pitch_denominator if pitch_denominator != 0 else 0
    return yaw, pitch

def get_face_features(image):
    results = face_mesh.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    if not results.multi_face_landmarks:
        return None, None

    landmarks_list = results.multi_face_landmarks[0].landmark
    landmarks_for_calc = [type('obj', (object,), {'x': lm.x, 'y': lm.y, 'z': lm.z}) for lm in landmarks_list]

    ear_val = calculate_ear(L_EYE, landmarks_for_calc)
    mar_val = calculate_mar(MOUTH_MAR, landmarks_for_calc)
    eyebrow_dist = calculate_eyebrow_distance(landmarks_for_calc)
    yaw_val, pitch_val = get_head_pose_features(landmarks_for_calc)
    features = [ear_val, mar_val, eyebrow_dist, yaw_val, pitch_val]

    x_coords = [lm.x for lm in landmarks_list]
    y_coords = [lm.y for lm in landmarks_list]
    x_min, x_max = min(x_coords), max(x_coords)
    y_min, y_max = min(y_coords), max(y_coords)
    h, w, _ = image.shape
    bounding_box = [int(x_min * w), int(y_min * h), int((x_max - x_min) * w), int((y_max - y_min) * h)]
    
    return features, bounding_box

def convert_base64_to_numpy(base64_image_data):
    """Utility to convert base64 string from frontend to OpenCV image."""
    encoded_data = base64_image_data.split(',')[1]
    image_bytes = base64.b64decode(encoded_data)
    np_arr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

# -----------------------------------------------------------------
# 3. TEXTUAL STRESS MODEL (NEWLY ADDED)
# -----------------------------------------------------------------
# Corrected path to remove "ML-service"
base_dir = os.path.dirname(os.path.abspath(__file__))
TEXT_MODEL_PATH = os.path.join(base_dir, "model", "huggingface_model")
OPTIMAL_THRESHOLD_TEXT = 0.3400

EMOTION_LABELS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring", 
    "confusion", "curiosity", "desire", "disappointment", "disapproval", 
    "disgust", "embarrassment", "excitement", "fear", "gratitude", "grief", 
    "joy", "love", "nervousness", "optimism", "pride", "realization", 
    "relief", "remorse", "sadness", "surprise", "neutral"
]
STRESS_WEIGHTS = {
    "anger": 2.0, "sadness": 2.0, "fear": 2.0, "disgust": 2.0, "grief": 2.0, "remorse": 2.0,
    "annoyance": 1.0, "disappointment": 1.0, "disapproval": 1.0, "embarrassment": 1.0, "nervousness": 1.0, "confusion": 0.5,
    "joy": -1.5, "amusement": -1.5, "love": -1.5, "gratitude": -1.5, "optimism": -1.5, "relief": -1.5,
    "excitement": -1.0, "caring": -1.0, "admiration": 0.0, "approval": 0.0, "curiosity": 0.0,
    "desire": 0.0, "pride": 0.0, "realization": 0.0, "surprise": 0.0, "neutral": 0.0
}

def _calculate_textual_stress(probabilities):
    raw_score = sum(prob * STRESS_WEIGHTS.get(label, 0.0) for i, (label, prob) in enumerate(zip(EMOTION_LABELS, probabilities)))
    normalized_score = 1 / (1 + np.exp(-raw_score))
    return int(normalized_score * 100)

class TextStressClassifier:
    def __init__(self, model_path):
        print(f"⚙️ Loading Textual Stress Model from {model_path}...")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        if not os.path.isdir(model_path):
            raise FileNotFoundError(f"Text Model directory not found: {model_path}")
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_path)
        self.model.to(self.device)
        self.model.eval()
        print(f"✅ Text Model loaded successfully on: {self.device}")

    def predict(self, text: str):
        inputs = self.tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=128).to(self.device)
        with torch.no_grad():
            logits = self.model(**inputs).logits
        probabilities = expit(logits.cpu().numpy()[0])
        binary_preds = (probabilities > OPTIMAL_THRESHOLD_TEXT).astype(int)
        detected_emotions = [EMOTION_LABELS[i] for i, pred in enumerate(binary_preds) if pred]
        stress_score = _calculate_textual_stress(probabilities)
        return {"stress_score": stress_score, "detected_emotions": detected_emotions}

# --- Load Text Model ONCE on startup ---
try:
    text_model = TextStressClassifier(TEXT_MODEL_PATH)
except Exception as e:
    print(f"❌ Failed to load Textual Stress Model: {e}")
    text_model = None

# -----------------------------------------------------------------
# 4. API ENDPOINTS
# -----------------------------------------------------------------

@app.route('/api/process_face', methods=['POST'])
def process_face_data():
    """Handles the facial analysis request."""
    if facial_model is None or facial_scaler is None:
        return jsonify({'error': 'Facial ML model not loaded'}), 500
    if db is None:
        return jsonify({'error': 'Firebase not initialized'}), 500

    try:
        data = request.json
        base64_image_data = data.get('imageData')
        user_id = data.get('userId', 'anonymous')
        timestamp = data.get('timestamp', firestore.SERVER_TIMESTAMP)

        if not base64_image_data:
            return jsonify({'error': 'No image data provided'}), 400

        img = convert_base64_to_numpy(base64_image_data)
        features, bounding_box = get_face_features(img)
        
        stress_score = 0
        face_detected = features is not None

        if face_detected:
            features_reshaped = np.array(features).reshape(1, -1)
            scaled_features = facial_scaler.transform(features_reshaped)
            stress_probability = facial_model.predict_proba(scaled_features)[0][1]
            stress_score = float(stress_probability * 100)
        
        # --- Store data in Firestore ---
        try:
            db.collection('users').document(user_id).collection('facial_stress').add({
                'score': stress_score,
                'timestamp': timestamp,
                'face_detected': face_detected
            })
            print(f"Facial score for user {user_id} recorded: {stress_score:.2f}%")
        except Exception as firebase_e:
            print(f"Error saving facial score to Firebase: {firebase_e}")

        return jsonify({
            'stress_score': stress_score,
            'face_detected': face_detected,
            'bounding_box': bounding_box
        })

    except Exception as e:
        print(f"Error during facial data processing: {e}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

@app.route('/api/process_text', methods=['POST'])
def process_text_data():
    """Handles the textual analysis request."""
    if text_model is None:
        return jsonify({'error': 'Textual ML model not loaded'}), 500
    if db is None:
        return jsonify({'error': 'Firebase not initialized'}), 500

    try:
        data = request.json
        text = data.get('text')
        user_id = data.get('userId', 'anonymous')
        timestamp = data.get('timestamp', firestore.SERVER_TIMESTAMP)

        if not text:
            return jsonify({'error': 'No text data provided'}), 400

        # Get results from the pre-loaded RoBERTa model
        results = text_model.predict(text)
        stress_score = results['stress_score']
        
        # --- Store data in Firestore ---
        try:
            db.collection('users').document(user_id).collection('textual_stress').add({
                'score': stress_score,
                'text': text,
                'detected_emotions': results['detected_emotions'],
                'timestamp': timestamp
            })
            print(f"Textual score for user {user_id} recorded: {stress_score}")
        except Exception as firebase_e:
            print(f"Error saving textual score to Firebase: {firebase_e}")

        return jsonify(results)

    except Exception as e:
        print(f"Error during textual data processing: {e}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def handle_chat():
    """Handles the chatbot request to Gemini."""
    if gemini_model is None:
        return jsonify({'error': 'Gemini API not initialized. Check GOOGLE_API_KEY.'}), 500

    try:
        data = request.json
        prompt = data.get('prompt')
        
        if not prompt:
            return jsonify({'error': 'No prompt provided'}), 400
        
        # Generate the response
        response = gemini_model.generate_content(prompt)
        
        return jsonify({'response': response.text})

    except Exception as e:
        print(f"Error during Gemini chat processing: {e}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

# -----------------------------------------------------------------
# 5. RUN THE APP
# -----------------------------------------------------------------
if __name__ == '__main__':
    # Use 0.0.0.0 to make it accessible on your network, or keep 127.0.0.1 for local only
    # Run on port 5000 to match the frontend
    app.run(debug=True, host='0.0.0.0', port=5000)