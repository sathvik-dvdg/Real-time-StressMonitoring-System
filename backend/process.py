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
TEXT_MODEL_NAME = "distilroberta-base"  # fallback name if model available locally or via HF

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
        return
    if _scaler is None and os.path.exists(SCALER_PATH):
        try:
            _scaler = joblib.load(SCALER_PATH)
            logger.info("Loaded scaler.joblib")
        except Exception as e:
            logger.warning("Failed to load scaler.joblib: %s", e)
            _scaler = None
    if _facial_clf is None and os.path.exists(FACIAL_CLF_PATH):
        try:
            _facial_clf = joblib.load(FACIAL_CLF_PATH)
            logger.info("Loaded stress_classifier.joblib")
        except Exception as e:
            logger.warning("Failed to load stress_classifier.joblib: %s", e)
            _facial_clf = None

def get_text_model_and_tokenizer():
    """Lazy init of tokenizer + text model if transformers available. Returns (tokenizer, model)."""
    global _text_tokenizer, _text_model
    if _text_tokenizer is not None and _text_model is not None:
        return _text_tokenizer, _text_model
    if torch is None or AutoTokenizer is None:
        logger.info("transformers/torch not available; text model disabled.")
        return None, None
    try:
        _text_tokenizer = AutoTokenizer.from_pretrained(TEXT_MODEL_NAME)
        _text_model = AutoModelForSequenceClassification.from_pretrained(TEXT_MODEL_NAME)
        _text_model.eval()
        logger.info("Text model and tokenizer loaded: %s", TEXT_MODEL_NAME)
    except Exception as e:
        logger.warning("Failed to load text model/tokenizer: %s", e)
        _text_tokenizer, _text_model = None, None
    return _text_tokenizer, _text_model

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
    text = text.lower()
    # Try transformer if available
    tokenizer, model = get_text_model_and_tokenizer()
    if tokenizer and model and torch:
        try:
            inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=128)
            for k, v in inputs.items():
                if isinstance(v, torch.Tensor):
                    inputs[k] = v.to(next(model.parameters()).device)
            with torch.no_grad():
                logits = model(**inputs).logits
                # If logits map to same number of emotions, take softmax
                if logits is not None:
                    logits = logits[0].cpu().numpy()
                    # if model dimension matches NUM_EMOTIONS
                    if logits.shape[0] >= NUM_EMOTIONS:
                        probs = np.exp(logits) / np.exp(logits).sum()
                        mapping = {EMOTION_CLASSES[i]: float(probs[i]) for i in range(NUM_EMOTIONS)}
                        return mapping
        except Exception as e:
            logger.info("Text transformer inference failed, falling back to keyword heuristic: %s", e)
    # Simple keyword heuristic fallback
    scores = {k: 0.0 for k in EMOTION_CLASSES}
    kw_map = {
        "joy": ["happy", "joy", "glad", "great", "awesome", "excited"],
        "sadness": ["sad", "depressed", "unhappy", "sorrow", "mourn"],
        "anger": ["angry", "mad", "furious", "rage", "irritat"],
        "fear": ["afraid", "scared", "fear", "panic", "nervous", "anxious"],
        "surprise": ["wow", "surprising", "surprise", "shocked"],
        "disgust": ["disgust", "gross", "yuck", "nasty"],
        "neutral": ["ok", "fine", "neutral", "normal", "alright"]
    }
    for label, keys in kw_map.items():
        for k in keys:
            if k in text:
                scores[label] += 1.0
    if sum(scores.values()) == 0.0:
        scores["neutral"] = 1.0
    return scores

def _predict_textual_stress_from_dist(raw_dist: Dict[str, float]) -> int:
    """Heuristic mapping of emotion distribution to stress score 0..100."""
    # higher sadness/anger/fear => higher stress, joy/neutral reduce
    total = sum(max(0.0, v) for v in raw_dist.values()) or 1.0
    normalized = {k: v / total for k, v in raw_dist.items()}
    stress = (
        normalized.get("sadness", 0.0) * 0.5 +
        normalized.get("anger", 0.0) * 0.4 +
        normalized.get("fear", 0.0) * 0.45 +
        normalized.get("disgust", 0.0) * 0.2
    ) - normalized.get("joy", 0.0) * 0.25 - normalized.get("neutral", 0.0) * 0.15
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

def process_text(text: str) -> Dict[str, Any]:
    """
    Called by app.py's /api/process_text.
    Returns:
      status, stress_score, detected_emotions (list), dashboard_data
    """
    try:
        if text is None:
            return {"status": "error", "error": "No text provided"}
        raw = _text_to_raw_dist(text)
        dashboard_data = _normalize_dist(raw)
        stress_score = _predict_textual_stress_from_dist(raw)
        # top detected emotions by percent > 10%
        detected = [k for k, v in sorted(dashboard_data.items(), key=lambda kv: kv[1], reverse=True) if v > 10.0][:3]
        return {
            "status": "success",
            "stress_score": int(stress_score),
            "detected_emotions": list(detected),
            "dashboard_data": {k: float(v) for k, v in dashboard_data.items()},
            "emotion": _dominant_label(dashboard_data)
        }
    except Exception as e:
        logger.exception("Error in process_text: %s", e)
        return {"status": "error", "error": str(e)}
