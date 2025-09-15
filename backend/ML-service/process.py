import joblib
import mediapipe as mp
import numpy as np
from math import hypot
import os

# --- 1. Load the Trained Model and Initialize Mediapipe ---

try:
    # Load both the model and the scaler from the correct directory
    model = joblib.load('stress_classifier.joblib')
    scaler = joblib.load('scaler.joblib')
    print("Model and scaler loaded successfully.")
except FileNotFoundError:
    print(
        "Error: Model or scaler file not found. Please ensure both 'stress_classifier.joblib' and 'scaler.joblib' are in the 'ml_service' directory.")
    model = None
    scaler = None
except Exception as e:
    print(f"An unexpected error occurred while loading the model: {e}")
    model = None
    scaler = None

# Initialize MediaPipe's Face Mesh solution for real-time processing
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1)

# Define the landmark indices for each feature (same as in your training script)
L_EYE = [362, 385, 387, 263, 373, 380]
R_EYE = [33, 160, 158, 133, 153, 145]
MOUTH_MAR = [61, 39, 37, 269, 270, 267]
EYEBROW_FURROWING = [55, 285]
HEAD_POSE_LANDMARKS = [1, 152, 263, 33, 61, 291]


# --- 2. Feature Calculation Functions ---
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


# --- 3. The Main Prediction Function for App.py ---

def get_stress_score(image):
    """
    Takes a single image (as a NumPy array), processes it, and returns a stress score.
    """
    if model is None or scaler is None:
        return 50, False  # Return a neutral score if files aren't loaded

    # Process the image with Mediapipe
    results = face_mesh.process(image)

    # Check if a face was detected
    if not results.multi_face_landmarks:
        # Return a neutral score if no face is found
        return 50, False

    # Extract the facial landmarks
    landmarks = results.multi_face_landmarks[0].landmark

    # Calculate all the features
    ear_val = calculate_ear(L_EYE, landmarks)
    mar_val = calculate_mar(MOUTH_MAR, landmarks)
    eyebrow_dist = calculate_eyebrow_distance(landmarks)
    yaw_val, pitch_val = get_head_pose_features(landmarks)

    # Create a feature array for the model. Make sure the order is correct!
    features = np.array([[ear_val, mar_val, eyebrow_dist, yaw_val, pitch_val]])

    # Scale the features
    scaled_features = scaler.transform(features)

    # Get the stress score (probability of being stressed)
    stress_score_prob = model.predict_proba(scaled_features)[0][1]

    # Convert to a score between 0 and 100
    stress_score = int(stress_score_prob * 100)

    return stress_score, True