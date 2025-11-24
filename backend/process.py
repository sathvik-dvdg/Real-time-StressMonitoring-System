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
EMOTION_CLASSES = ["joy", "sadness", "anger", "fear", "surprise", "disgust", "neutral"]
NUM_EMOTIONS = len(EMOTION_CLASSES)

MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.joblib")
FACIAL_CLF_PATH = os.path.join(MODEL_DIR, "stress_classifier.joblib")
# Text model no longer needed - using Gemini API for text analysis
# TEXT_MODEL_NAME = "j-hartmann/emotion-english-distilroberta-base"

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
            static_image_mode=False,
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
                logger.info(f"✅ Loaded stress_classifier from {FACIAL_CLF_PATH}")
            except Exception as e:
                logger.error(f"❌ Failed to load stress_classifier.joblib: {e}")
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
# Facial feature extraction (heuristic + optional model)
# -------------------
def _extract_landmarks_and_features(image_bgr: np.ndarray) -> Tuple[List[List[float]], Dict[str, float]]:
    """
    Runs MediaPipe FaceMesh and returns:
      - landmarks: list of [x,y] normalized floats (0..1)
      - features: dict containing ear_left, ear_right, mar (mouth aspect ratio)
    """
    mesh = get_face_mesh()
    if mesh is None or image_bgr is None:
        return [], {}
    try:
        img_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    except Exception:
        return [], {}
    results = mesh.process(img_rgb)
    if not results or not results.multi_face_landmarks:
        return [], {}
    landmarks_mp = results.multi_face_landmarks[0].landmark
    # produce normalized landmark list
    lm_list = [[float(round(lm.x, 6)), float(round(lm.y, 6))] for lm in landmarks_mp]
    h, w = image_bgr.shape[:2]
    # helper to get point
    def _pt(idx):
        if idx < len(landmarks_mp):
            p = landmarks_mp[idx]
            return (float(p.x), float(p.y))
        return (0.0, 0.0)
    # approximate eye aspect ratio (EAR) using known mediapipe indices
    def _ear(idxs):
        try:
            pts = [_pt(i) for i in idxs]
            # convert normalized to pixel coords for distance calculation to be scale-invariant similarly
            pts_px = [(x * w, y * h) for (x, y) in pts]
            A = math.dist(pts_px[1], pts_px[5])
            B = math.dist(pts_px[2], pts_px[4])
            C = math.dist(pts_px[0], pts_px[3])
            if C == 0.0:
                return 0.0
            return (A + B) / (2.0 * C)
        except Exception:
            return 0.0
    left_eye_idxs = [33, 160, 158, 133, 153, 144]
    right_eye_idxs = [263, 387, 385, 362, 380, 373]
    ear_l = _ear(left_eye_idxs)
    ear_r = _ear(right_eye_idxs)
    # mouth aspect ratio (MAR) approximate: vertical between upper (13) and lower (14) over horizontal (78-308)
    try:
        up = _pt(13)
        low = _pt(14)
        left_m = _pt(78)
        right_m = _pt(308)
        v = math.dist((up[0] * w, up[1] * h), (low[0] * w, low[1] * h))
        hdist = math.dist((left_m[0] * w, left_m[1] * h), (right_m[0] * w, right_m[1] * h))
        mar = (v / hdist) if hdist != 0 else 0.0
    except Exception:
        mar = 0.0
    features = {
        "ear_left": float(round(ear_l, 6)),
        "ear_right": float(round(ear_r, 6)),
        "mar": float(round(mar, 6)),
    }
    return lm_list, features

def _heuristic_facial_to_emotion(features: Dict[str, float]) -> Dict[str, float]:
    """Map features to raw scores for EMOTION_CLASSES (will be normalized later)."""
    ear_avg = (features.get("ear_left", 0.0) + features.get("ear_right", 0.0)) / 2.0
    mar = features.get("mar", 0.0)
    # heuristics:
    # - closed eyes (small EAR) -> tired/sad/anger depending on mouth
    # - large mouth (high MAR) -> surprise / joy
    scores = {k: 0.01 for k in EMOTION_CLASSES}
    scores["joy"] += max(0.0, mar * 4.0 - ear_avg * 1.5)
    scores["surprise"] += max(0.0, mar * 5.0)
    scores["sadness"] += max(0.0, (0.12 - ear_avg) * 6.0)
    scores["anger"] += max(0.0, (0.06 - (features.get("ear_left", 0.0) - features.get("ear_right", 0.0))) * 4.0)
    scores["fear"] += max(0.0, (0.08 - ear_avg) * 2.0 + mar * 1.0)
    scores["disgust"] += max(0.0, (0.04 - ear_avg) * 1.2)
    scores["neutral"] += 0.5
    return scores

def _predict_facial_stress(features: Dict[str, float]) -> int:
    """Return integer stress score 0..100 using optional trained model or heuristics."""
    _try_load_joblib_models()
    if _facial_clf is not None and _scaler is not None:
        try:
            # ensure consistent feature order
            arr = np.array([[features.get("ear_left", 0.0), features.get("ear_right", 0.0), features.get("mar", 0.0)]], dtype=float)
            scaled = _scaler.transform(arr)
            if hasattr(_facial_clf, "predict_proba"):
                probs = _facial_clf.predict_proba(scaled)
                # heuristically choose class that corresponds to stress if binary or use mean
                if probs.shape[1] == 2:
                    stress_prob = float(probs[0, 1])
                else:
                    stress_prob = float(np.mean(probs[0]))
                return int(round(max(0.0, min(1.0, stress_prob)) * 100))
        except Exception as e:
            logger.warning("Facial classifier failed: %s", e)
    # fallback heuristics: lower EAR => more stress, higher MAR => less stress (yawn/surprise reduce)
    ear_avg = (features.get("ear_left", 0.0) + features.get("ear_right", 0.0)) / 2.0
    mar = features.get("mar", 0.0)
    ear_score = max(0.0, min(1.0, (0.15 - ear_avg) / 0.15))  # 0..1
    mar_score = max(0.0, min(1.0, (0.4 - mar) / 0.4))  # treat big open mouth as lower stress
    combined = 0.65 * ear_score + 0.35 * mar_score
    return int(round(max(0.0, min(1.0, combined)) * 100))

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
                # Our EMOTION_CLASSES: ["joy", "sadness", "anger", "fear", "surprise", "disgust", "neutral"]
                model_labels = ['anger', 'disgust', 'fear', 'joy', 'neutral', 'sadness', 'surprise']
                
                # Apply softmax to get probabilities
                probs = np.exp(logits) / np.exp(logits).sum()
                
                # Map model output to our EMOTION_CLASSES format
                # The model uses the same emotion names, so we can directly map them
                mapping = {}
                for i, model_label in enumerate(model_labels):
                    mapping[model_label] = float(probs[i])
                
                logger.info(f"Text: '{text_input[:50]}...' -> Model emotions: {mapping}")
                return mapping
        except Exception as e:
            logger.warning("Text transformer inference failed, falling back to keyword heuristic: %s", e)
    # Simple keyword heuristic fallback
    scores = {k: 0.0 for k in EMOTION_CLASSES}
    kw_map = {
        "joy": ["happy", "joy", "glad", "great", "awesome", "excited", "good", "love", "wonderful", "fantastic"],
        "sadness": ["sad", "depressed", "unhappy", "sorrow", "mourn", "grief", "cry", "lonely", "heartbroken", "down"],
        "anger": ["angry", "mad", "furious", "rage", "irritat", "hate", "annoy", "frustrat"],
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

    # Map stress keywords to fear/sadness/anger to boost stress score
    for label, keys in stress_map.items():
        for k in keys:
            if k in text_lower:
                scores["fear"] += 0.5
                scores["sadness"] += 0.5
                scores["anger"] += 0.2

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
    # higher sadness/anger/fear => higher stress, joy/neutral reduce
    total = sum(max(0.0, v) for v in raw_dist.values()) or 1.0
    normalized = {k: v / total for k, v in raw_dist.items()}
    
    # Enhanced stress calculation with better weights
    stress = (
        normalized.get("sadness", 0.0) * 0.6 +
        normalized.get("anger", 0.0) * 0.55 +
        normalized.get("fear", 0.0) * 0.65 +
        normalized.get("disgust", 0.0) * 0.3
    ) - normalized.get("joy", 0.0) * 0.35 - normalized.get("neutral", 0.0) * 0.2
    
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
      - last_probs, last_stress: optional smoothing inputs (ignored by heuristics but accepted)
    Returns JSON-serializable dict:
      status: "success"|"no_face"|"error"
      landmarks: list[[x,y], ...] normalized coordinates (0..1)
      stress_score: int 0..100
      dashboard_data: {emotion: percent} summing to ~100
      emotion: dominant emotion string
    """
    try:
        if frame_bgr is None:
            return {"status": "error", "error": "No frame provided"}
        # Ensure frame is numpy array (it should be)
        if not isinstance(frame_bgr, np.ndarray):
            # try to decode if base64 was passed at upper layer (app.py handles base64 decode there).
            return {"status": "error", "error": "Frame format not supported"}

        landmarks, features = _extract_landmarks_and_features(frame_bgr)
        if not features:
            return {"status": "no_face"}

        stress_score = _predict_facial_stress(features)
        raw_scores = _heuristic_facial_to_emotion(features)
        dashboard_data = _normalize_dist(raw_scores)
        emotion = _dominant_label(dashboard_data)

        # Ensure native types
        return {
            "status": "success",
            "landmarks": [[float(x), float(y)] for x, y in landmarks],
            "stress_score": int(stress_score),
            "dashboard_data": {k: float(v) for k, v in dashboard_data.items()},
            "emotion": str(emotion) if emotion is not None else "neutral"
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
