import cv2
import mediapipe as mp
import numpy as np
import joblib
import random
from math import hypot
from collections import defaultdict

# --- I. CONFIGURATION & LOAD MODELS ---

MODEL_FILE = "emotion_classifier.joblib"
SCALER_FILE = "emotion_scaler.joblib"
ALPHA = 0.3 # Temporal Smoothing Factor (0.0 to 1.0)

try:
    EMOTION_MODEL = joblib.load(MODEL_FILE)
    EMOTION_SCALER = joblib.load(SCALER_FILE)
except FileNotFoundError:
    print(f"❌ ERROR: Model files not found. Ensure '{MODEL_FILE}' and '{SCALER_FILE}' are in the project folder.")
    exit()

# Core classes order (Must match training order)
EMOTION_CLASSES = ["happy", "sad", "angry", "fear", "surprise", "disgust", "neutral"]

# W_Stress: Stress Weight (0.0 to 1.0) based on Arousal-Valence Model
# Order: [happy, sad, angry, fear, surprise, disgust, neutral]
STRESS_WEIGHTS = np.array([0.00, 0.60, 0.70, 1.00, 0.50, 0.80, 0.20])

# Mapping 7 core classes to 27 dashboard visualization buckets
EMOTION_MAPPING = {
    "happy": ["joy", "amusement", "approval", "optimism", "gratitude"],
    "sad": ["sadness", "grief", "remorse", "disappointment"],
    "angry": ["anger", "annoyance"],
    "fear": ["fear", "nervousness"],
    "surprise": ["surprise", "realization", "curiosity"],
    "disgust": ["disgust"],
    "neutral": ["neutral", "relief", "confusion"]
}

# Global state for temporal smoothing
LAST_EMOTION_PROBS = np.array([1/7] * 7)
current_stress_score = 0.0

# --- II. STRICT FEATURE HELPER FUNCTIONS (The Engine) ---

# Landmarking constants (Must match training)
L_EYE = [362, 385, 387, 263, 373, 380]
MOUTH_MAR = [61, 39, 37, 269, 270, 267]
L_PIR = [469, 471, 475, 477]

def get_distance(p1, p2):
    return hypot(p1.x - p2.x, p1.y - p2.y)

def calculate_ear(landmarks, indices):
    p2, p6 = landmarks[indices[1]], landmarks[indices[5]]
    p3, p5 = landmarks[indices[2]], landmarks[indices[4]]
    p1, p4 = landmarks[indices[0]], landmarks[indices[3]]
    return (get_distance(p2, p6) + get_distance(p3, p5)) / (2.0 * get_distance(p1, p4))

def calculate_mar(landmarks, indices):
    p2, p8 = landmarks[indices[1]], landmarks[indices[5]] 
    p3, p7 = landmarks[indices[2]], landmarks[indices[4]]
    p1, p5 = landmarks[indices[0]], landmarks[indices[3]] 
    return (get_distance(p2, p8) + get_distance(p3, p7)) / (2.0 * get_distance(p1, p5))

def calculate_pir(landmarks, indices):
    iris_h = get_distance(landmarks[indices[0]], landmarks[indices[1]])
    pupil_h = get_distance(landmarks[indices[2]], landmarks[indices[3]])
    return pupil_h / iris_h if iris_h != 0 else 0

def get_features(image, face_mesh):
    # static_image_mode=False is CRITICAL for FPS
    results = face_mesh.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    if not results.multi_face_landmarks: return None
    lm = results.multi_face_landmarks[0].landmark
    
    # Feature extraction logic must be identical to training
    ear = calculate_ear(lm, L_EYE)
    mar = calculate_mar(lm, MOUTH_MAR)
    face_width = get_distance(lm[234], lm[454]) 
    eyebrow_dist = get_distance(lm[55], lm[285]) / face_width
    eye_center = lm[386]
    eyebrow_center = lm[276]
    brow_height = get_distance(eye_center, eyebrow_center) / face_width
    mouth_width = get_distance(lm[61], lm[291]) / face_width
    pir = calculate_pir(lm, L_PIR)

    # 6 Features used in emotion training
    return [ear, mar, eyebrow_dist, brow_height, mouth_width, pir]

# --- III. MAPPING AND VISUALIZATION LOGIC ---

def map_to_dashboard(core_probs):
    """Calculates distribution across 27 categories."""
    dashboard_data = {}
    
    # 1. Distribute the core probability across sub-emotions
    for i, primary_emotion in enumerate(EMOTION_CLASSES):
        core_prob = core_probs[i]
        related_sub_emotions = EMOTION_MAPPING[primary_emotion]
        
        for sub_emotion in related_sub_emotions:
            # Assign a base share of the core probability + small noise
            base_value = core_prob / len(related_sub_emotions)
            share = base_value * random.uniform(0.9, 1.1)
            dashboard_data[sub_emotion] = max(0.005, share) 
            
    # Normalize the final result to 100%
    total_sum = sum(dashboard_data.values())
    return {k: v / total_sum for k, v in dashboard_data.items()}

def get_color(score):
    """Maps the 0-100 stress score to a BGR color."""
    if score > 75: return (0, 0, 255)       # Red (High Stress)
    if score > 40: return (0, 165, 255)     # Orange (Moderate Stress)
    return (0, 255, 0)                      # Green (Low Stress)

# --- IV. MAIN APPLICATION LOOP ---

def main_app():
    global LAST_EMOTION_PROBS
    global current_stress_score
    
    cap = cv2.VideoCapture(0)
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(max_num_faces=1, refine_landmarks=True, static_image_mode=False)

    print("\n--- LIVE DASHBOARD SIMULATOR STARTED ---")
    
    while True:
        ret, frame = cap.read()
        if not ret: break
        
        features = get_features(frame, face_mesh)
        
        if features:
            features_scaled = EMOTION_SCALER.transform([features])
            raw_probs = EMOTION_MODEL.predict_proba(features_scaled)[0]
            
            # 1. Temporal Smoothing (Applies to the probabilities for stability)
            smoothed_probs = (ALPHA * raw_probs) + ((1 - ALPHA) * LAST_EMOTION_PROBS)
            LAST_EMOTION_PROBS = smoothed_probs
            
            # 2. Weighted Stress Calculation (The Formula)
            # S_Weighted = SUM(P_Emotion * W_Stress)
            raw_stress_score = np.sum(smoothed_probs * STRESS_WEIGHTS) * 100
            
            # 3. Temporal Smoothing on the final 0-100 score (For stable bar/UI)
            current_stress_score = (ALPHA * raw_stress_score) + ((1 - ALPHA) * current_stress_score)
            
            # 4. Predict Top Emotion (for the main label)
            pred_idx = np.argmax(smoothed_probs)
            detected_emotion = EMOTION_CLASSES[pred_idx]
            
            # 5. Get Dashboard Data (The 27 categories)
            dashboard_data = map_to_dashboard(smoothed_probs)
            
            # --- VISUALIZATION ---
            color = get_color(current_stress_score)
            
            # Stress Bar (Bottom)
            bar_width = int((current_stress_score / 100) * frame.shape[1])
            cv2.rectangle(frame, (0, frame.shape[0] - 30), (bar_width, frame.shape[0]), color, -1) 
            
            # Main Label
            cv2.putText(frame, f"CORE: {detected_emotion.upper()}", (20, 50), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
            
            # Stress Score
            cv2.putText(frame, f"STRESS: {current_stress_score:.1f}%", (20, 90), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
            
            # Dashboard Top Slices
            y_offset = 120
            cv2.putText(frame, "Dashboard Top Slices:", (20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 1)
            y_offset += 25
            
            sorted_data = sorted(dashboard_data.items(), key=lambda item: item[1], reverse=True)
            for emotion, value in sorted_data[:3]:
                 cv2.putText(frame, f" - {emotion}: {value*100:.1f}%", (20, y_offset), 
                             cv2.FONT_HERSHEY_SIMPLEX, 0.6, (150, 255, 255), 1)
                 y_offset += 20

        cv2.imshow("DASHBOARD SIMULATOR", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'): break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main_app()