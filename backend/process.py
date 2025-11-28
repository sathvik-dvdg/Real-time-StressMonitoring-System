# process.py
"""
Stable, drop-in process module for Real-time-StressMonitoring-System.

Exports expected by app.py:
- EMOTION_CLASSES (list)
- try_load_facial_model()
- get_face_mesh()
- get_text_model_and_tokenizer()
- process_facial_frame(frame_bgr, last_probs=None, last_stress=None)
- process_text(text)

Notes:
- All returned values are JSON-serializable native Python types.
- If optional ML artifacts (joblib scaler/classifier or HF text model) exist they will be used;
  otherwise robust heuristics are applied so the frontend remains functional.
"""

import os
import math
import logging
import sys  # Added for stdout flushing
from typing import Any, Dict, List, Optional, Tuple
from math import hypot
import random
from collections import defaultdict

import cv2
import numpy as np
import mediapipe as mp

# Optional libraries
try:
    import joblib
except Exception:
    joblib = None

try:
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
except Exception:
    torch = None
    AutoTokenizer = None
    AutoModelForSequenceClassification = None

logger = logging.getLogger("process")
logger.setLevel(logging.INFO)

# -------------------
# Config & constants
# -------------------
# Core classes order (Must match training order)
EMOTION_CLASSES = ["happy", "sad", "angry", "fear", "surprise", "disgust", "neutral"]
NUM_EMOTIONS = len(EMOTION_CLASSES)

MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")
# Updated file names as per user request
SCALER_PATH = os.path.join(os.path.dirname(__file__), "emotion_scaler.joblib")
FACIAL_CLF_PATH = os.path.join(os.path.dirname(__file__), "emotion_classifier.joblib")

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

ALPHA = 0.3 # Temporal Smoothing Factor (0.0 to 1.0)

# globals for lazy-loaded models
_face_mesh = None
_scaler = None
_facial_clf = None
_text_tokenizer = None
_text_model = None

# -------------------
# Helper utilities
# -------------------
def _to_py(x):
    if isinstance(x, (np.float32, np.float64, np.floating)):
        return float(x)
    if isinstance(x, (np.int32, np.int64, np.integer)):
        return int(x)
    if isinstance(x, np.ndarray):
        return x.tolist()
    return x

def _normalize_dist(raw: Dict[str, float]) -> Dict[str, float]:
    # Ensure non-negative
    items = {k: max(0.0, float(v)) for k, v in raw.items()}
    total = sum(items.values()) or 1.0
    out = {k: round((v / total) * 100.0, 1) for k, v in items.items()}
    # small rounding correction
    s = sum(out.values())
    diff = round(100.0 - s, 1)
    if abs(diff) >= 0.1:
        largest = max(out.items(), key=lambda kv: kv[1])[0]
        out[largest] = round(out[largest] + diff, 1)
    return out

def _dominant_label(dist: Dict[str, float]) -> Optional[str]:
    if not dist:
        return None
    return max(dist.items(), key=lambda kv: kv[1])[0]

# -------------------
# MediaPipe helpers
# -------------------
def try_load_facial_model():
    """Initialize face mesh once (safe to call repeatedly)."""
    global _face_mesh
    if _face_mesh is None:
        mp_face_mesh = mp.solutions.face_mesh
        _face_mesh = mp_face_mesh.FaceMesh(
            static_image_mode=False,  # Video mode to handle sequential frames without timestamp conflicts
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        logger.info("MediaPipe FaceMesh initialized.")
    return _face_mesh

def get_face_mesh():
    """Return face mesh object (init if needed)."""
    return try_load_facial_model()

# -------------------
# Optional model loaders
# -------------------
def _try_load_joblib_models():
    global _scaler, _facial_clf
    if joblib is None:
        logger.warning("Joblib not installed. Skipping ML model loading.")
        return
    if _scaler is None:
        if os.path.exists(SCALER_PATH):
            try:
                _scaler = joblib.load(SCALER_PATH)
                logger.info(f"✅ Loaded scaler from {SCALER_PATH}")
            except Exception as e:
                logger.error(f"❌ Failed to load scaler.joblib: {e}")
                _scaler = None
        else:
            logger.warning(f"⚠️ Scaler file not found at {SCALER_PATH}")

    if _facial_clf is None:
        if os.path.exists(FACIAL_CLF_PATH):
            try:
                _facial_clf = joblib.load(FACIAL_CLF_PATH)
                logger.info(f"✅ Loaded emotion_classifier from {FACIAL_CLF_PATH}")
            except Exception as e:
                logger.error(f"❌ Failed to load emotion_classifier.joblib: {e}")
                _facial_clf = None
        else:
            logger.warning(f"⚠️ Classifier file not found at {FACIAL_CLF_PATH}")

def get_text_model_and_tokenizer():
    """Deprecated - text analysis now uses Gemini API. Kept for compatibility."""
    # Updated: 2025-01-25 02:11 - Removed model loading, using Gemini instead
    logger.info("Text model loading skipped - using Gemini API for text analysis")
    return None, None

def analyze_text_with_gemini(text: str, gemini_model) -> Optional[Dict[str, Any]]:
    """Use Gemini to analyze text for emotions and stress. Returns None if fails."""
    # Write to file since waitress suppresses print
    with open('debug.log', 'a') as f:
        f.write(f"\n[GEMINI] analyze_text_with_gemini called with text='{text}'\n")
        f.flush()
    
    if not gemini_model:
        with open('debug.log', 'a') as f:
            f.write(f"[GEMINI] FAILED: gemini_model is None\n")
            f.flush()
        return None
    if not text:
        with open('debug.log', 'a') as f:
            f.write(f"[GEMINI] FAILED: text is empty\n")
            f.flush()
        return None
    
    try:
        prompt = f'''Analyze this text for emotional content and stress level.

Text: "{text}"

Provide a JSON response with:
1. stress_score: integer 0-100 (0=calm, 100=extreme crisis)
2. emotion: one of [joy, sadness, anger, fear, surprise, disgust, neutral]
3. helpline_trigger: boolean (true if mentions self-harm, suicide, severe distress)
4. emotion_distribution: object with percentages for all 7 emotions (must sum to ~100)

Example:
{{"stress_score": 75, "emotion": "sadness", "helpline_trigger": false, "emotion_distribution": {{"joy": 0, "sadness": 70, "anger": 10, "fear": 15, "surprise": 0, "disgust": 0, "neutral": 5}}}}

Respond ONLY with valid JSON, no markdown formatting.'''
        
        with open('debug.log', 'a') as f:
            f.write(f"[GEMINI] Calling Gemini API...\n")
            f.flush()
            
        response = gemini_model.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        
        # Extract JSON from response
        response_text = response.text.strip()
        with open('debug.log', 'a') as f:
            f.write(f"[GEMINI] Raw response: {response_text[:500]}\n")
            f.flush()
        
        # Remove markdown code blocks if present
        if response_text.startswith('```'):
            lines = response_text.split('\n')
            response_text = '\n'.join(lines[1:-1])
            with open('debug.log', 'a') as f:
                f.write(f"[GEMINI] After removing markdown\n")
                f.flush()
        
        import json
        result = json.loads(response_text)
        with open('debug.log', 'a') as f:
            f.write(f"[GEMINI] Parsed JSON: {result}\n")
            f.flush()
        
        # Validate structure
        required_keys = ['stress_score', 'emotion', 'helpline_trigger', 'emotion_distribution']
        if all(k in result for k in required_keys):
            with open('debug.log', 'a') as f:
                f.write(f"[GEMINI] SUCCESS: stress={result['stress_score']}, emotion={result['emotion']}, helpline={result['helpline_trigger']}\n")
                f.flush()
            logger.info(f"Gemini analyzed text: stress={result['stress_score']}, emotion={result['emotion']}, helpline={result['helpline_trigger']}")
            return result
        else:
            missing = [k for k in required_keys if k not in result]
            with open('debug.log', 'a') as f:
                f.write(f"[GEMINI] FAILED: Missing keys: {missing}\n")
                f.flush()
            logger.warning(f"Gemini response missing required keys: {result}")
            return None
            
    except Exception as e:
        with open('debug.log', 'a') as f:
            f.write(f"[GEMINI] EXCEPTION: {type(e).__name__}: {e}\n")
            f.flush()
        logger.warning(f"Gemini text analysis failed: {e}")
        return None

# -------------------
# Facial feature extraction (Strict Feature Helper Functions)
# -------------------

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

def get_features(image_bgr, face_mesh):
    # static_image_mode=False is CRITICAL for FPS
    # Convert BGR to RGB
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(image_rgb)
    if not results.multi_face_landmarks: return None, None
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
    features_list = [ear, mar, eyebrow_dist, brow_height, mouth_width, pir]
    
    # Also return landmarks for visualization
    landmarks_list = [[float(l.x), float(l.y)] for l in lm]
    
    return features_list, landmarks_list

# -------------------
# Mapping Logic
# -------------------

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

# -------------------
# Text processing
# -------------------
def _text_to_raw_dist(text: str) -> Dict[str, float]:
    """Return raw (unnormalized) scores for EMOTION_CLASSES from text."""
    if not text or not text.strip():
        return {k: 1.0 if k == "neutral" else 0.0 for k in EMOTION_CLASSES}
    text_input = text
    text = text.lower()
    # Try transformer if available
    tokenizer, model = get_text_model_and_tokenizer()
    if tokenizer and model and torch:
        try:
            inputs = tokenizer(text_input, return_tensors="pt", truncation=True, padding=True, max_length=128)
            for k, v in inputs.items():
                if isinstance(v, torch.Tensor):
                    inputs[k] = v.to(next(model.parameters()).device)
            with torch.no_grad():
                outputs = model(**inputs)
                logits = outputs.logits[0].cpu().numpy()
                
                # j-hartmann model outputs: ['anger', 'disgust', 'fear', 'joy', 'neutral', 'sadness', 'surprise']
                # Our EMOTION_CLASSES: ["happy", "sad", "angry", "fear", "surprise", "disgust", "neutral"]
                # Note: "joy" -> "happy", "sadness" -> "sad"
                model_labels = ['anger', 'disgust', 'fear', 'joy', 'neutral', 'sadness', 'surprise']
                
                # Apply softmax to get probabilities
                probs = np.exp(logits) / np.exp(logits).sum()
                
                # Map model output to our EMOTION_CLASSES format
                mapping = {}
                for i, model_label in enumerate(model_labels):
                    # Map labels
                    target_label = model_label
                    if model_label == "joy": target_label = "happy"
                    if model_label == "sadness": target_label = "sad"
                    
                    if target_label in EMOTION_CLASSES:
                        mapping[target_label] = float(probs[i])
                
                logger.info(f"Text: '{text_input[:50]}...' -> Model emotions: {mapping}")
                return mapping
        except Exception as e:
            logger.warning("Text transformer inference failed, falling back to keyword heuristic: %s", e)
    # Simple keyword heuristic fallback
    scores = {k: 0.0 for k in EMOTION_CLASSES}
    kw_map = {
        "happy": ["happy", "joy", "glad", "great", "awesome", "excited", "good", "love", "wonderful", "fantastic"],
        "sad": ["sad", "depressed", "unhappy", "sorrow", "mourn", "grief", "cry", "lonely", "heartbroken", "down"],
        "angry": ["angry", "mad", "furious", "rage", "irritat", "hate", "annoy", "frustrat"],
        "fear": ["afraid", "scared", "fear", "panic", "nervous", "anxious", "worried", "terrified", "dread"],
        "surprise": ["wow", "surprising", "surprise", "shocked", "amazing", "unbelievable"],
        "disgust": ["disgust", "gross", "yuck", "nasty", "revolting", "sick"],
        "neutral": ["ok", "fine", "neutral", "normal", "alright", "okay"]
    }
    
    # Extra stress-specific mapping (maps to negative emotions)
    stress_map = {
        "stress": ["stress", "overwhelm", "pressure", "tension", "burnout", "exhausted", "can't take it", "too much"],
        "anxiety": ["anxious", "panic", "nervous", "restless", "unease", "worry"]
    }

    text_lower = text.lower()
    
    for label, keys in kw_map.items():
        for k in keys:
            if k in text_lower:
                scores[label] += 1.0

    # Map stress keywords to fear/sad/angry to boost stress score
    for label, keys in stress_map.items():
        for k in keys:
            if k in text_lower:
                scores["fear"] += 0.5
                scores["sad"] += 0.5
                scores["angry"] += 0.2

    if sum(scores.values()) == 0.0:
        scores["neutral"] = 1.0
    return scores

def _check_sensitive_content(text: str) -> bool:
    """Check for crisis/suicide keywords."""
    if not text: 
        return False
    text = text.lower()
    crisis_keywords = [
        "suicide", "kill myself", "want to die", "end it all", "hurt myself", 
        "better off dead", "death", "take my own life", "suicidal"
    ]
    for k in crisis_keywords:
        if k in text:
            return True
    return False

def _predict_textual_stress_from_dist(raw_dist: Dict[str, float]) -> int:
    """Heuristic mapping of emotion distribution to stress score 0..100."""
    # higher sad/angry/fear => higher stress, happy/neutral reduce
    total = sum(max(0.0, v) for v in raw_dist.values()) or 1.0
    normalized = {k: v / total for k, v in raw_dist.items()}
    
    # Enhanced stress calculation with better weights
    stress = (
        normalized.get("sad", 0.0) * 0.6 +
        normalized.get("angry", 0.0) * 0.55 +
        normalized.get("fear", 0.0) * 0.65 +
        normalized.get("disgust", 0.0) * 0.3
    ) - normalized.get("happy", 0.0) * 0.35 - normalized.get("neutral", 0.0) * 0.2
    
    stress = max(0.0, stress)
    stress = min(1.0, stress)
    return int(round(stress * 100))

# -------------------
# Public processing functions used by app.py
# -------------------
def process_facial_frame(frame_bgr: Any, last_probs: Optional[List[float]] = None, last_stress: Optional[float] = None) -> Dict[str, Any]:
    """
    Called by app.py's /api/process_face.
    Accepts:
      - frame_bgr: numpy array (BGR) image
      - last_probs, last_stress: optional smoothing inputs
    Returns JSON-serializable dict:
      status: "success"|"no_face"|"error"
      landmarks: list[[x,y], ...] normalized coordinates (0..1)
      stress_score: int 0..100
      dashboard_data: {emotion: percent} summing to ~100
      emotion: dominant emotion string
      raw_probs: list[float] (for next frame smoothing)
    """
    try:
        if frame_bgr is None:
            return {"status": "error", "error": "No frame provided"}
        # Ensure frame is numpy array (it should be)
        if not isinstance(frame_bgr, np.ndarray):
            # try to decode if base64 was passed at upper layer (app.py handles base64 decode there).
            return {"status": "error", "error": "Frame format not supported"}

        # Initialize models if needed
        _try_load_joblib_models()
        face_mesh = get_face_mesh()

        features, landmarks = get_features(frame_bgr, face_mesh)
        
        if not features or not landmarks:
            return {"status": "no_face"}

        # Default values if models fail
        stress_score = 0
        dashboard_data = {k: 0.0 for k in EMOTION_CLASSES}
        dashboard_data["neutral"] = 100.0
        detected_emotion = "neutral"
        current_probs = [1.0/7] * 7

        if _scaler and _facial_clf:
            try:
                features_scaled = _scaler.transform([features])
                raw_probs = _facial_clf.predict_proba(features_scaled)[0]
                
                # 1. Temporal Smoothing
                if last_probs is not None and len(last_probs) == len(raw_probs):
                    smoothed_probs = (ALPHA * raw_probs) + ((1 - ALPHA) * np.array(last_probs))
                else:
                    smoothed_probs = raw_probs
                
                current_probs = smoothed_probs.tolist()

                # 2. Weighted Stress Calculation
                raw_stress_score = np.sum(smoothed_probs * STRESS_WEIGHTS) * 100
                
                # 3. Temporal Smoothing on Stress Score
                if last_stress is not None:
                    current_stress_score = (ALPHA * raw_stress_score) + ((1 - ALPHA) * last_stress)
                else:
                    current_stress_score = raw_stress_score
                
                stress_score = int(current_stress_score)

                # 4. Predict Top Emotion
                pred_idx = np.argmax(smoothed_probs)
                detected_emotion = EMOTION_CLASSES[pred_idx]
                
                # 5. Get Dashboard Data
                dashboard_data_raw = map_to_dashboard(smoothed_probs)
                dashboard_data = {k: float(v) * 100 for k, v in dashboard_data_raw.items()} # Scale to 0-100 for frontend

            except Exception as e:
                logger.error(f"Model prediction failed: {e}")
                # Fallback to simple heuristics if model fails? 
                # For now, just return defaults or maybe a specific error
                pass
        else:
             logger.warning("Models not loaded, cannot calculate stress.")

        # Ensure native types
        return {
            "status": "success",
            "landmarks": landmarks,
            "stress_score": int(stress_score),
            "dashboard_data": dashboard_data,
            "emotion": str(detected_emotion),
            "raw_probs": current_probs,
            "raw_stress": float(stress_score)
        }
    except Exception as e:
        logger.exception("Error in process_facial_frame: %s", e)
        return {"status": "error", "error": str(e)}

def process_text(text: str, gemini_model=None) -> Dict[str, Any]:
    """
    Called by app.py's /api/process_text.
    Returns:
      status, stress_score, detected_emotions (list), dashboard_data, helpline_trigger
    """
    try:
        print(f"\n===== PROCESS_TEXT CALLED =====", flush=True)
        print(f"Input text: '{text}'", flush=True)
        
        if text is None:
            return {"status": "error", "error": "No text provided"}
        
        logger.info(f"Processing text: '{text}'")
        
        # Try Gemini analysis first
        gemini_result = analyze_text_with_gemini(text, gemini_model)
        
        if gemini_result:
            # Gemini succeeded - use its results
            print(f"Using Gemini analysis", flush=True)
            logger.info("Using Gemini analysis")
            
            stress_score = gemini_result.get('stress_score', 0)
            helpline_trigger = bool(gemini_result.get('helpline_trigger', False))
            emotion = gemini_result.get('emotion', 'neutral')
            dashboard_data = gemini_result.get('emotion_distribution', {})
            
            # Ensure dashboard_data has all emotions
            for emotion_class in EMOTION_CLASSES:
                if emotion_class not in dashboard_data:
                    dashboard_data[emotion_class] = 0.0
            
        else:
            # Gemini failed - fall back to keyword-based analysis
            print(f"Gemini failed, falling back to keyword analysis", flush=True)
            logger.info("Gemini failed, falling back to keyword analysis")
            
            # Check for sensitive content
            helpline_trigger = _check_sensitive_content(text)
            
            raw = _text_to_raw_dist(text)
            dashboard_data = _normalize_dist(raw)
            stress_score = _predict_textual_stress_from_dist(raw)
            
            # If helpline triggered, force high stress
            if helpline_trigger:
                stress_score = max(stress_score, 95)
            
            emotion = _dominant_label(dashboard_data)
        
        print(f"Helpline trigger: {helpline_trigger}", flush=True)
        print(f"Stress score: {stress_score}", flush=True)
        print(f"Emotion: {emotion}", flush=True)
        logger.info(f"Helpline trigger: {helpline_trigger}, Stress: {stress_score}, Emotion: {emotion}")
        
        # top detected emotions by percent > 10%
        detected = [k for k, v in sorted(dashboard_data.items(), key=lambda kv: kv[1], reverse=True) if v > 10.0][:3]
        
        result = {
            "status": "success",
            "stress_score": int(stress_score),
            "detected_emotions": list(detected),
            "dashboard_data": {k: float(v) for k, v in dashboard_data.items()},
            "emotion": str(emotion),
            "helpline_trigger": bool(helpline_trigger)  # Ensure it's always boolean
        }
        print(f"Final result: {result}", flush=True)
        print(f"===== PROCESS_TEXT COMPLETE =====\n", flush=True)
        logger.info(f"Final result: {result}")
        return result
    except Exception as e:
        print(f"ERROR in process_text: {e}", flush=True)
        logger.exception("Error in process_text: %s", e)
        return {"status": "error", "error": str(e)}
