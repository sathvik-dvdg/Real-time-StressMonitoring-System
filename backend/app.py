import os
import logging
import base64
from dotenv import load_dotenv

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

import cv2
import numpy as np
import importlib

# -----------------------------
# Import consultant and recommendation services
# -----------------------------
from consultant_service_v2 import consultant_service
from recommendation_service import get_recommendation_service

# -----------------------------
# Gemini — NEW google-genai SDK (correct)
# -----------------------------
from google import genai
from google.genai import types

# -----------------------------
# Environment
# -----------------------------
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

# -----------------------------
# Logging
# -----------------------------
logging.basicConfig(level=logging.INFO)
LOG = logging.getLogger("app")

# -----------------------------
# Dynamic import of process.py
# -----------------------------
try:
    process = importlib.import_module("process")
    LOG.info("Imported process module.")
except Exception as e:
    LOG.exception("Failed to import process.py: %s", e)
    process = None

def _proc_attr(name, fallback=None):
    if not process:
        return fallback
    return getattr(process, name, fallback)

process_facial_frame = _proc_attr("process_facial_frame")
process_text = _proc_attr("process_text")
try_load_facial_model = _proc_attr("try_load_facial_model")
get_face_mesh = _proc_attr("get_face_mesh")
get_text_model_and_tokenizer = _proc_attr("get_text_model_and_tokenizer")

# -----------------------------
# Flask App
# -----------------------------
app = Flask(__name__)
# FIXED: Restrict CORS to frontend origin (adjust port if needed)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}})

# Initialize rate limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["1000 per day", "200 per hour"],
    storage_uri="memory://"
)

# -----------------------------
# Initialize ML models
# -----------------------------
LOG.info("🔄 Attempting model init (process.py)")

if try_load_facial_model:
    try:
        try_load_facial_model()
        LOG.info("Called try_load_facial_model()")
    except Exception as e:
        LOG.warning("try_load_facial_model failed: %s", e)

if get_face_mesh:
    try:
        get_face_mesh()
        LOG.info("Called get_face_mesh()")
    except Exception as e:
        LOG.warning("get_face_mesh failed: %s", e)

if get_text_model_and_tokenizer:
    try:
        get_text_model_and_tokenizer()
        LOG.info("Called get_text_model_and_tokenizer()")
    except Exception as e:
        LOG.warning("get_text_model_and_tokenizer failed: %s", e)

LOG.info("🔄 Model init complete")

# -----------------------------
# Initialize Gemini client (NEW SDK)
# -----------------------------
gemini_model = None

if GEMINI_API_KEY:
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        gemini_model = client
        LOG.info(f"🤖 Gemini ready with model: {GEMINI_MODEL}")
    except Exception as e:
        LOG.error("Gemini init failed: %s", e)
else:
    LOG.critical("❌ GEMINI_API_KEY not found in .env! Chat features will not work.")
    print("\n" + "="*50)
    print("CRITICAL ERROR: GEMINI_API_KEY is missing.")
    print("Please create a .env file in the backend directory with:")
    print("GEMINI_API_KEY=your_api_key_here")
    print("="*50 + "\n")


# -----------------------------
# Helpers: Base64 → OpenCV image
# -----------------------------
def _strip_data_uri_prefix(s):
    if isinstance(s, str) and s.startswith("data:") and "," in s:
        return s.split(",", 1)[1]
    return s

def _safe_b64_to_bgr_image(b64string):
    try:
        s = _strip_data_uri_prefix(b64string)
        s = "".join(s.split())
        pad = len(s) % 4
        if pad:
            s += "=" * (4 - pad)
        raw = base64.b64decode(s)
        arr = np.frombuffer(raw, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        LOG.error(f"Image decode error: {e}")
        return None


# ---------------------------------------------------
# Facial Processing Endpoint
# ---------------------------------------------------
@app.route("/api/process_face", methods=["POST"])
@limiter.exempt
def api_process_face():
    try:
        payload = request.get_json(silent=True)
        img_data = None

        if payload:
            img_data = payload.get("image") or payload.get("frame")

        if not img_data and request.form:
            img_data = request.form.get("image") or request.form.get("frame")

        if not img_data:
            raw = request.get_data(as_text=True)
            if raw and len(raw) > 10:
                img_data = raw

        if not img_data:
            return jsonify({"status": "error", "error": "No image data"}), 400

        frame = _safe_b64_to_bgr_image(img_data)
        if frame is None:
            return jsonify({"status": "error", "error": "Image decode error"}), 400

        if not process_facial_frame:
            return jsonify({"status": "error", "error": "Processing unavailable"}), 500

        result = process_facial_frame(frame)
        return jsonify(result)

    except Exception as e:
        LOG.exception("process_face error: %s", e)
        return jsonify({"status": "error", "error": str(e)}), 500


# ---------------------------------------------------
# Text Stress Analysis
# ---------------------------------------------------
@app.route("/api/process_text", methods=["POST"])
@limiter.limit("60 per minute")
def api_process_text():
    print("\n===== /api/process_text endpoint hit =====", flush=True)
    try:
        payload = request.get_json(silent=True) or {}
        text = payload.get("text", "")
        print(f"Received text payload: '{text}'", flush=True)

        if not process_text:
            return jsonify({"status": "error", "error": "process_text missing"}), 500

        # Pass gemini_model to process_text for AI-powered analysis
        res = process_text(text, gemini_model=gemini_model)
        print(f"process_text returned: {res}", flush=True)

        response_data = {
            "status": "success",
            "stress_score": res.get("stress_score"),
            "emotion": res.get("emotion"),
            "detected_emotions": res.get("detected_emotions"),
            "dashboard_data": res.get("dashboard_data"),
            "helpline_trigger": res.get("helpline_trigger", False),
        }
        print(f"Sending response: {response_data}", flush=True)
        print("===== /api/process_text complete =====\n", flush=True)
        return jsonify(response_data)

    except Exception as e:
        print(f"ERROR in api_process_text: {e}", flush=True)
        LOG.exception("process_text error: %s", e)
        return jsonify({"status": "error", "error": str(e)}), 500


# ---------------------------------------------------
# Gemini Chat — NEW SDK VERSION
# ---------------------------------------------------
@app.route("/api/chat", methods=["POST"])
@limiter.limit("60 per minute")
def api_chat():
    if gemini_model is None:
        return jsonify({"status": "error", "response": "Gemini not configured"}), 500

    try:
        payload = request.get_json(silent=True) or {}
        prompt = payload.get("prompt", "")

        if not prompt:
            return jsonify({"status": "error", "response": "No prompt"}), 400

        # NEW API CALL
        response = gemini_model.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt
        )

        ai_text = response.text

        return jsonify({
            "status": "success",
            "response": ai_text
        })

    except Exception as e:
        LOG.error("Gemini Error: %s", e)
        return jsonify({
            "status": "error",
            "response": "Gemini Error",
            "detail": str(e)
        }), 500


# ---------------------------------------------------
# Consultant Search - Dynamic Location-Based
# ---------------------------------------------------
@app.route("/api/consultants/nearby", methods=["POST"])
@limiter.limit("10 per minute")
def api_nearby_consultants():
    """
    Find nearby wellness professionals based on user's real location.
    Expects: {"lat": float, "lon": float, "limit": int (optional)}
    """
    try:
        payload = request.get_json(silent=True) or {}
        lat = payload.get("lat")
        lon = payload.get("lon")
        limit = payload.get("limit", 5)
        
        if not lat or not lon:
            return jsonify({
                "status": "error",
                "error": "Latitude and longitude are required"
            }), 400
        
        # Use the consultant service to find nearby professionals
        consultants = consultant_service.find_nearby(lat, lon, limit)
        
        return jsonify({
            "status": "success",
            "consultants": consultants,
            "user_location": {"lat": lat, "lon": lon}
        })
        
    except Exception as e:
        LOG.error(f"Error in nearby consultants: {e}")
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


# ---------------------------------------------------
# AI-Powered Recommendations
# ---------------------------------------------------
@app.route("/api/recommendations", methods=["POST"])
@limiter.limit("20 per minute")
def api_recommendations():
    """
    Generate personalized wellness recommendations based on stress and emotion data.
    Expects: {"stress_score": int, "emotion_data": dict, "session_context": dict (optional)}
    """
    try:
        payload = request.get_json(silent=True) or {}
        stress_score = payload.get("stress_score")
        emotion_data = payload.get("emotion_data", {})
        session_context = payload.get("session_context")
        
        if stress_score is None:
            return jsonify({
                "status": "error",
                "error": "stress_score is required"
            }), 400
        
        # Get recommendation service with Gemini client
        rec_service = get_recommendation_service(gemini_model)
        
        # Generate recommendations
        recommendations = rec_service.generate_recommendations(
            stress_score=int(stress_score),
            emotion_data=emotion_data,
            session_context=session_context
        )
        
        return jsonify({
            "status": "success",
            "recommendations": recommendations
        })
        
    except Exception as e:
        LOG.error(f"Error generating recommendations: {e}")
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


# ---------------------------------------------------
# Recommendation Feedback
# ---------------------------------------------------
@app.route("/api/recommendations/feedback", methods=["POST"])
@limiter.limit("30 per minute")
def api_recommendation_feedback():
    """
    Collect user feedback on recommendations.
    Expects: {"recommendation_id": str, "action": "accepted" | "dismissed" | "snoozed", "user_id": str (optional)}
    """
    try:
        payload = request.get_json(silent=True) or {}
        recommendation_id = payload.get("recommendation_id")
        action = payload.get("action")
        user_id = payload.get("user_id")
        
        if not recommendation_id or not action:
            return jsonify({
                "status": "error",
                "error": "recommendation_id and action are required"
            }), 400
        
        if action not in ["accepted", "dismissed", "snoozed"]:
            return jsonify({
                "status": "error",
                "error": "action must be 'accepted', 'dismissed', or 'snoozed'"
            }), 400
        
        # TODO: Store feedback in database for ML training
        # For now, just log it
        LOG.info(f"Recommendation feedback: id={recommendation_id}, action={action}, user={user_id}")
        
        return jsonify({
            "status": "success",
            "message": "Feedback recorded"
        })
        
    except Exception as e:
        LOG.error(f"Error recording feedback: {e}")
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


# ---------------------------------------------------
# Health Check
# ---------------------------------------------------
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "gemini_loaded": gemini_model is not None
    })


# ---------------------------------------------------
# Run Local
# ---------------------------------------------------
if __name__ == "__main__":
    LOG.info("Starting local server at http://0.0.0.0:5000")
    app.run(host="0.0.0.0", port=5000)
