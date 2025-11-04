# This file is: backend/ML-service/process.py
# Paths are relative to the 'backend/' folder (where app.py is run).
# Facial Model Path (relative to app.py): ./stress_classifier.joblib
# Text Model Path (relative to app.py):   ./ML-service/model/huggingface_model

import joblib
import mediapipe as mp
import numpy as np
from math import hypot
import os
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from scipy.special import expit  # More stable sigmoid

# =======================================================================
# PART 1: FACIAL STRESS MODEL (Your existing code)
# =======================================================================

print("⚙️ Loading Facial Stress Model...")
try:
    # Load both the model and the scaler from the 'backend' root directory
    facial_model = joblib.load('stress_classifier.joblib')
    facial_scaler = joblib.load('scaler.joblib')
    print("✅ Facial Model and scaler loaded successfully.")
except FileNotFoundError:
    print(
        "Error: Facial Model or scaler file not found. Please ensure both 'stress_classifier.joblib' and 'scaler.joblib' are in the 'backend' directory.")
    facial_model = None
    facial_scaler = None
except Exception as e:
    print(f"An unexpected error occurred while loading the facial model: {e}")
    facial_model = None
    facial_scaler = None

# Initialize MediaPipe's Face Mesh solution
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1)

# --- Facial Feature Calculation Functions ---

def calculate_ear(eye_landmarks, landmarks):
    p2 = landmarks[eye_landmarks[1]]
    p3 = landmarks[eye_landmarks[2]]
    p5 = landmarks[eye_landmarks[4]]
    p6 = landmarks[eye_landmarks[5]]
    dist_vertical = hypot(p2.x - p6.x, p2.y - p6.y)
    dist_horizontal = hypot(p3.x - p5.x, p3.y - p5.y)
    return dist_vertical / (2.0 * dist_horizontal) if dist_horizontal != 0 else 0

def calculate_mar(mouth_landmarks, landmarks):
    p1 = landmarks[mouth_landmarks[0]]
    p2 = landmarks[mouth_landmarks[1]]
    p3 = landmarks[mouth_landmarks[2]]
    p4 = landmarks[mouth_landmarks[3]]
    p5 = landmarks[mouth_landmarks[4]]
    dist_horizontal = hypot(p1.x - p5.x, p1.y - p5.y)
    dist_vertical = hypot(p2.x - p4.x, p2.y - p4.y)
    return dist_vertical / dist_horizontal if dist_horizontal != 0 else 0

def calculate_eyebrow_distance(landmarks):
    return hypot(landmarks[55].x - landmarks[285].x, landmarks[55].y - landmarks[285].y)

def get_head_pose_features(landmarks):
    nose_tip = landmarks[1]
    chin = landmarks[152]
    left_eye = landmarks[263]
    right_eye = landmarks[33]
    yaw = (right_eye.x - left_eye.x) / (chin.x - nose_tip.x) if (chin.x - nose_tip.x) != 0 else 0
    pitch = (nose_tip.y - chin.y) / (right_eye.y - left_eye.y) if (right_eye.y - left_eye.y) != 0 else 0
    return yaw, pitch

# --- Main Facial Prediction Function ---

def get_facial_stress_score(image):
    """
    Takes a single image (as a NumPy array), processes it, and returns a facial stress score.
    """
    if facial_model is None or facial_scaler is None:
        return 50, False  # Return a neutral score if files aren't loaded

    results = face_mesh.process(image)
    if not results.multi_face_landmarks:
        return 50, False # Return a neutral score if no face is found

    landmarks = results.multi_face_landmarks[0].landmark
    
    # Landmark indices definitions (as in your original code)
    L_EYE = [362, 385, 387, 263, 373, 380]
    R_EYE = [33, 160, 158, 133, 153, 145]
    MOUTH_MAR = [61, 39, 37, 269, 270, 267]

    ear_val = calculate_ear(L_EYE, landmarks)
    mar_val = calculate_mar(MOUTH_MAR, landmarks)
    eyebrow_dist = calculate_eyebrow_distance(landmarks)
    yaw_val, pitch_val = get_head_pose_features(landmarks)

    features = np.array([[ear_val, mar_val, eyebrow_dist, yaw_val, pitch_val]])
    scaled_features = facial_scaler.transform(features)
    stress_score_prob = facial_model.predict_proba(scaled_features)[0][1]
    stress_score = int(stress_score_prob * 100)

    return stress_score, True


# =======================================================================
# PART 2: TEXTUAL STRESS MODEL (The new RoBERTa code)
# =======================================================================

# --- Text Model Configuration ---
MODEL_PATH_TEXT = "./ML-service/model/huggingface_model" 
OPTIMAL_THRESHOLD_TEXT = 0.3400 # The optimal threshold you found

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

# --- Text Model Helper Function ---
def _calculate_textual_stress(probabilities):
    raw_score = 0.0
    for i, label in enumerate(EMOTION_LABELS):
        prob = probabilities[i]
        weight = STRESS_WEIGHTS.get(label, 0.0)
        raw_score += prob * weight
    normalized_score = 1 / (1 + np.exp(-raw_score))
    final_score = int(normalized_score * 100)
    return final_score

# --- Text Model Loader Class ---
class TextStressClassifier:
    def __init__(self, model_path):
        print(f"⚙️ Loading Textual Stress Model from {model_path}...")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        if not os.path.isdir(model_path):
            print(f"❌ Text Model directory not found at {model_path}")
            raise FileNotFoundError(f"Text Model directory not found. Check path relative to app.py: {model_path}")

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
        
        return {
            "stress_score": stress_score,
            "detected_emotions": detected_emotions
        }

# --- Initialize Text Model ONCE on startup ---
try:
    text_model = TextStressClassifier(MODEL_PATH_TEXT)
except Exception as e:
    print(f"Failed to load Textual Stress Model: {e}")
    text_model = None

# --- Main Textual Prediction Function ---
def get_textual_stress_score(text: str):
    """
    Takes raw text and returns the final stress score and detected emotions.
    """
    if text_model is None:
        return {"stress_score": 50, "detected_emotions": ["Error: Model not loaded"]}
        
    return text_model.predict(text)


# =======================================================================
# PART 3: HOW TO USE IN backend/app.py
# =======================================================================

# At the top of your backend/app.py:
#
# from fastapi import FastAPI
# from pydantic import BaseModel
# # Import the two functions from your process.py file
# from MLservice.process import get_facial_stress_score, get_textual_stress_score
#
# app = FastAPI()
#
# # --- Pydantic Models ---
# class TextRequest(BaseModel):
#     text: str
#
# class ImageRequest(BaseModel):
#     image_base64: str # Assuming you send image as base64 string
#
# # --- API Endpoints ---
# @app.post("/analyze_text")
# async def analyze_text(request: TextRequest):
#     # This calls the pre-loaded RoBERTa model
#     results = get_textual_stress_score(request.text)
#     return results
#
# @app.post("/analyze_face")
# async def analyze_face(request: ImageRequest):
#     # You will need a helper function to convert base64 to a numpy image
#     # image_np = convert_base64_to_numpy(request.image_base64) 
#
#     # This calls the pre-loaded Random Forest model
#     # score, face_detected = get_facial_stress_score(image_np) 
#     # return {"stress_score": score, "face_detected": face_detected}
#     pass # Implement image conversion