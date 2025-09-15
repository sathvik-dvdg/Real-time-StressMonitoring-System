import base64
import joblib
import cv2
import mediapipe as mp
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from math import hypot  # Import hypot for feature calculations

# --- Firebase Imports ---
import firebase_admin
from firebase_admin import credentials, firestore

app = Flask(__name__)
CORS(app)  # This enables CORS for all routes

# To this, specifying your frontend's origin
CORS(app, origins="http://localhost:5174")
# or if you use another port like 3000

# --- Firebase Initialization ---
try:
    # IMPORTANT: Replace "path/to/serviceAccountKey.json" with the actual path
    # If it's in the same directory as app.py, just use its filename.
    cred = credentials.Certificate("firebase/serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
    db = firestore.client()  # Get a Firestore client
    print("Firebase initialized successfully.")
except Exception as e:
    print(f"Error initializing Firebase: {e}")
    # You might want to exit or handle this more gracefully if Firebase is critical
    db = None

# --- Load the pre-trained ML model and scaler ---
try:
    model = joblib.load('stress_classifier.joblib')
    scaler = joblib.load('scaler.joblib')
    print("ML model and scaler loaded successfully.")
except FileNotFoundError:
    print(
        "Error: Model or scaler file not found. Please ensure both 'stress_classifier.joblib' and 'scaler.joblib' are in the 'ml_service' directory.")
    model = None
    scaler = None
except Exception as e:
    print(f"An unexpected error occurred while loading the model: {e}")
    model = None
    scaler = None

# --- Mediapipe setup for face detection ---
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, min_detection_confidence=0.5)

# Define landmark indices for the features (copied from your training script)
L_EYE = [362, 385, 387, 263, 373, 380]
MOUTH_MAR = [61, 39, 37, 269, 270, 267]
EYEBROW_FURROWING = [55, 285]


# --- Feature Calculation Helper Functions (MUST be defined globally or within get_face_features) ---
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
    # Using specific landmarks for inner eyebrows for distance calculation
    # Ensure these indices (55, 285) are correctly mapped to eyebrow points
    p1 = landmarks[EYEBROW_FURROWING[0]]
    p2 = landmarks[EYEBROW_FURROWING[1]]
    return hypot(p1.x - p2.x, p1.y - p2.y)


def get_head_pose_features(landmarks):
    # These landmark indices are for head pose estimation (nose tip, chin, eye corners)
    nose_tip = landmarks[1]
    chin = landmarks[152]
    left_eye = landmarks[263]  # Left eye outer corner
    right_eye = landmarks[33]  # Right eye outer corner

    # Simple estimation for yaw (left/right tilt)
    # If the right eye x is greater than left eye x, face is turning left, and vice-versa.
    # We use relative positions, can be unstable without 3D model points.
    # For a more robust solution, cv2.solvePnP would be needed.
    # Here, we're using a ratio for a rough estimate

    # Avoid division by zero
    yaw_denominator = (chin.x - nose_tip.x)
    yaw = (right_eye.x - left_eye.x) / yaw_denominator if yaw_denominator != 0 else 0

    # Simple estimation for pitch (up/down tilt)
    pitch_denominator = (right_eye.y - left_eye.y)
    pitch = (nose_tip.y - chin.y) / pitch_denominator if pitch_denominator != 0 else 0

    return yaw, pitch


# --- Feature Extraction Helper Function ---
def get_face_features(image):
    results = face_mesh.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    if not results.multi_face_landmarks:
        return None, None

    landmarks_list = results.multi_face_landmarks[0].landmark

    # Create a list of MediaPipe landmark objects for calculations
    landmarks_for_calc = [
        # Create dummy objects for direct access like landmarks[1]
        type('obj', (object,), {'x': lm.x, 'y': lm.y, 'z': lm.z}) for lm in landmarks_list
    ]

    # Calculate the features using the new landmarks_for_calc list
    ear_val = calculate_ear(L_EYE, landmarks_for_calc)
    mar_val = calculate_mar(MOUTH_MAR, landmarks_for_calc)
    eyebrow_dist = calculate_eyebrow_distance(landmarks_for_calc)
    yaw_val, pitch_val = get_head_pose_features(landmarks_for_calc)

    features = [ear_val, mar_val, eyebrow_dist, yaw_val, pitch_val]

    # Simple bounding box calculation (using original landmarks_list directly)
    x_coords = [lm.x for lm in landmarks_list]
    y_coords = [lm.y for lm in landmarks_list]
    x_min, x_max = min(x_coords), max(x_coords)
    y_min, y_max = min(y_coords), max(y_coords)

    h, w, _ = image.shape
    x, y = int(x_min * w), int(y_min * h)
    width, height = int((x_max - x_min) * w), int((y_max - y_min) * h)
    bounding_box = [x, y, width, height]

    return features, bounding_box


# --- API Route ---
@app.route('/api/process', methods=['POST'])
def process_data():
    if model is None or scaler is None:
        return jsonify({'error': 'ML model not loaded'}), 500
    if db is None:
        return jsonify({'error': 'Firebase not initialized'}), 500  # Return error if Firebase failed to init

    try:
        data = request.json
        base64_image_data = data.get('imageData')
        # IMPORTANT: Frontend should send user_id obtained after login
        user_id = data.get('userId', 'anonymous')  # Default to 'anonymous' if not provided
        timestamp = data.get('timestamp')  # Get timestamp from frontend if available

        if not base64_image_data:
            return jsonify({'error': 'No image data provided'}), 400
        if not timestamp:  # Ensure timestamp is present for database entry
            timestamp = firestore.SERVER_TIMESTAMP  # Use Firebase server timestamp if not provided by frontend

        encoded_data = base64_image_data.split(',')[1]
        image_bytes = base64.b64decode(encoded_data)
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        features, bounding_box = get_face_features(img)

        stress_score = 0
        face_detected = features is not None

        if face_detected:
            features_reshaped = np.array(features).reshape(1, -1)
            scaled_features = scaler.transform(features_reshaped)
            prediction = model.predict(scaled_features)[0]

            # Use predict_proba for a more nuanced score (probability of class 1)
            # This is better for a 0-100 scale than just 0 or 1
            stress_probability = model.predict_proba(scaled_features)[0][1]
            stress_score = float(stress_probability * 100)  # Convert to 0-100%

            print("Received a request from the frontend!")
            # --- Store data in Firestore ---
            try:
                doc_ref = db.collection('users').document(user_id).collection('stress_scores').add({
                    'score': stress_score,
                    'timestamp': timestamp,  # Use the timestamp from frontend or server
                    'face_detected': face_detected
                })
                print(f"Stress score for user {user_id} recorded: {stress_score:.2f}% (Doc ID: {doc_ref[1].id})")
            except Exception as firebase_e:
                print(f"Error saving to Firebase: {firebase_e}")
                # Log the error but don't stop the API response if score calculation worked
        else:
            # If no face detected, still record an entry (e.g., score 0, face_detected false)
            try:
                doc_ref = db.collection('users').document(user_id).collection('stress_scores').add({
                    'score': 0,  # Or some default for no face
                    'timestamp': timestamp,
                    'face_detected': False
                })
                print(f"No face detected for user {user_id}. Recorded default score.")
            except Exception as firebase_e:
                print(f"Error saving 'no face detected' to Firebase: {firebase_e}")

        return jsonify({
            'stress_score': stress_score,
            'face_detected': face_detected,
            'bounding_box': bounding_box
        })

    except Exception as e:
        print(f"Error during data processing: {e}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)