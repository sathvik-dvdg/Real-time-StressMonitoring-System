import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, Video, MessageSquare, Play, Square, Activity, Send, Sparkles, X
} from "lucide-react";

// Real imports
import { useAuth } from '../context/authContext/AuthContext';
import Chat from '../components/Chat';
import { db } from '../database/firebaseconfig';
import {
  doc, setDoc, serverTimestamp, collection, addDoc, writeBatch, increment
} from 'firebase/firestore';

import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import Modal from 'react-modal';
Modal.setAppElement('#root');

// ================================
// CONFIG
// ================================
const SESSION_DURATION_SECONDS = 120;     // 2 minutes
const CAPTURE_INTERVAL_MS = 200;          // ~5 FPS (reduced to avoid MediaPipe timestamp errors)
const SMOOTHING_WINDOW = 5;
const MAX_PENDING_REQUESTS = 1;           // reduce concurrent requests
const BACKEND_ERROR_COOLDOWN_MS = 2000;   // when backend 500 occurs, pause sends for this long
const AXIOS_TIMEOUT_MS = 8000;            // request timeout

// ================================
// SessionPage (patched)
// ================================
export default function SessionPage() {

  const { userLoggedIn, currentUser } = useAuth();
  const navigate = useNavigate();
  const userId = currentUser ? currentUser.uid : 'anonymous';

  // UI State
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [currentStressScore, setCurrentStressScore] = useState(null);
  const [stressScores, setStressScores] = useState([]);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [faceMissing, setFaceMissing] = useState(false);
  const [dominantEmotion, setDominantEmotion] = useState(null);
  const [backendDown, setBackendDown] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null); // overlay for landmarks
  const streamRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const sessionIdRef = useRef(null);
  const smoothingBufferRef = useRef([]);
  const pendingRequests = useRef(0);
  const lastBackendErrorAt = useRef(0);

  // ================================
  // START SESSION
  // ================================
  const [cameraError, setCameraError] = useState(null);

  // ================================
  // START SESSION
  // ================================
  const startSession = async () => {
    sessionIdRef.current = uuidv4();
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait until metadata is loaded so videoWidth/videoHeight are available
        await new Promise((resolve) => {
          const video = videoRef.current;
          const onLoaded = () => {
            // set initial overlay canvas size
            try {
              setupOverlayCanvasSize();
            } catch (e) { /* ignore */ }
            resolve();
          };
          if (video.readyState >= 1) {
            onLoaded();
          } else {
            video.addEventListener('loadedmetadata', onLoaded, { once: true });
            // fallback resolve after short delay if metadata doesn't fire
            setTimeout(() => resolve(), 500);
          }
        });

        await videoRef.current.play().catch(() => { });
        setIsCameraReady(true);
      }
    } catch (err) {
      console.error("Error getting camera:", err);
      let errorMessage = "Camera access failed. Please check permissions.";

      if (err.name === 'AbortError' || err.message.includes('Timeout')) {
        errorMessage = "Camera timed out. It might be in use by another app. Close other apps and try again.";
      } else if (err.name === 'NotAllowedError') {
        errorMessage = "Camera permission denied. Please allow camera access in your browser settings.";
      } else if (err.name === 'NotFoundError') {
        errorMessage = "No camera found. Please ensure your camera is connected.";
      } else if (err.name === 'NotReadableError') {
        errorMessage = "Camera is currently in use by another application.";
      }

      setCameraError(errorMessage);
      alert(errorMessage);
    }
  };

  // set overlay canvas pixel size to match video element (avoid CSS-only mismatch)
  const setupOverlayCanvasSize = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const vw = video.videoWidth || video.clientWidth || 640;
    const vh = video.videoHeight || video.clientHeight || 480;
    // Set canvas drawing buffer to exact video pixel dimensions
    canvas.width = vw;
    canvas.height = vh;
    // Ensure CSS sizes match so Recharts / overlays have correct layout
    canvas.style.width = `${video.clientWidth}px`;
    canvas.style.height = `${video.clientHeight}px`;
  };

  // ================================
  // STOP SESSION
  // ================================
  // ================================
  // SAVE SESSION TO FIRESTORE (Refactored for reuse)
  // ================================
  const saveSessionToFirestore = async () => {
    if (stressScores.length === 0) return;

    const sessionScoreSum = stressScores.reduce((s, item) => s + (item.score || 0), 0);
    const avg = Math.round(sessionScoreSum / stressScores.length);

    // Aggregate dashboard_data
    const dashboardAgg = {};
    let frames = 0;

    stressScores.forEach((frame) => {
      if (frame.dashboard_data) {
        frames++;
        Object.entries(frame.dashboard_data).forEach(([k, v]) => {
          dashboardAgg[k] = (dashboardAgg[k] || 0) + Number(v || 0);
        });
      }
    });

    let dashboard_data = null;
    if (frames > 0) {
      dashboard_data = {};
      let total = 0;
      Object.entries(dashboardAgg).forEach(([k, v]) => {
        dashboard_data[k] = v / frames;
        total += dashboard_data[k];
      });

      if (total > 0) {
        Object.keys(dashboard_data).forEach((k) => {
          dashboard_data[k] = Number((dashboard_data[k] / total).toFixed(4));
        });
      }
    }

    if (userLoggedIn && currentUser) {
      try {
        const batch = writeBatch(db);
        const sessionID = sessionIdRef.current;
        const sessionRef = doc(db, 'users', userId, 'sessions', sessionID);

        // 1. Save Session Document
        batch.set(sessionRef, {
          averageScore: avg,
          timestamp: serverTimestamp(),
          scoresCount: stressScores.length,
          readingsCount: stressScores.length,
          dashboard_data,
          sessionId: sessionID,
        });

        // 2. Update Meta Summary
        const summaryRef = doc(db, 'users', userId, 'meta', 'summary');
        batch.set(summaryRef, {
          totalSessions: increment(1),
          totalReadings: increment(stressScores.length)
        }, { merge: true });

        // 3. Save Individual Readings to 'stress_scores' (Sampled 1 per second to save writes)
        // Assuming ~5 FPS, we take every 5th frame, or just use the timestamp difference
        const scoresCollectionRef = collection(db, 'users', userId, 'stress_scores');

        // Filter to ~1 reading per second to avoid hitting limits/costs too hard
        const oneSecond = 1000;
        let lastSavedTime = 0;

        // Create a base timestamp for the session start (approximate)
        const sessionStartTime = Date.now() - (stressScores.length * CAPTURE_INTERVAL_MS);

        stressScores.forEach((item, index) => {
          // Calculate approximate timestamp for this reading
          const itemTime = sessionStartTime + (index * CAPTURE_INTERVAL_MS);

          if (itemTime - lastSavedTime >= oneSecond) {
            const docRef = doc(scoresCollectionRef); // Auto-ID
            batch.set(docRef, {
              score: item.score,
              type: 'facial',
              timestamp: new Date(itemTime), // Save as JS Date (Firestore converts to Timestamp)
              sessionId: sessionID
            });
            lastSavedTime = itemTime;
          }
        });

        await batch.commit();
        console.log("Session and readings saved successfully.");
      } catch (err) {
        console.error("Error saving session summary:", err);
      }
    }
  };

  // Keep a ref to the save function so we can call it in cleanup without stale closures
  const saveSessionRef = useRef(saveSessionToFirestore);
  useEffect(() => {
    saveSessionRef.current = saveSessionToFirestore;
  }, [stressScores, userLoggedIn, currentUser]);

  // ================================
  // STOP SESSION
  // ================================
  const stopSession = async () => {
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop());
      } catch (e) { /* ignore */ }
    }

    setSessionActive(false);
    setIsCameraReady(false);

    await saveSessionToFirestore();
    setIsModalOpen(true);
  };

  const closeModalAndNavigate = () => {
    setIsModalOpen(false);
    navigate("/summary");
  };

  // ================================
  // TIMERS
  // ================================
  useEffect(() => {
    if (isCameraReady && !sessionActive) {
      setSessionActive(true);
      setSessionTime(0);
      setCurrentStressScore(null);
      setStressScores([]);
      smoothingBufferRef.current = [];

      // timer increments per second
      sessionTimerRef.current = setInterval(() => {
        setSessionTime((s) => s + 1);
      }, 1000);

      // capture frames at configured interval
      captureIntervalRef.current = setInterval(() => {
        captureAndSendFrame();
      }, CAPTURE_INTERVAL_MS);
    }
  }, [isCameraReady, sessionActive]);

  useEffect(() => {
    if (sessionActive && sessionTime >= SESSION_DURATION_SECONDS) {
      stopSession();
    }
  }, [sessionTime, sessionActive]);

  useEffect(() => {
    // cleanup on unmount
    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      if (streamRef.current) {
        try { streamRef.current.getTracks().forEach(t => t.stop()); } catch (e) { }
      }
      // Attempt to save if session was active (best effort)
      // Note: Async calls in cleanup might be cancelled by browser, but Firestore SDK often handles it.
      if (sessionIdRef.current) {
        saveSessionRef.current();
      }
    };
  }, []);

  // ================================
  // FRAME CAPTURE + SEND (defensive)
  // ================================
  const captureAndSendFrame = () => {
    try {
      // don't capture if backend flagged as down and still in cooldown
      const now = Date.now();
      if (backendDown && now - lastBackendErrorAt.current < BACKEND_ERROR_COOLDOWN_MS) {
        return;
      } else if (backendDown) {
        // cooldown passed
        setBackendDown(false);
      }

      if (!videoRef.current || videoRef.current.readyState < 2) return;
      if (pendingRequests.current >= MAX_PENDING_REQUESTS) return;

      const video = videoRef.current;

      // ensure we have valid pixel dimensions
      const vw = video.videoWidth || video.clientWidth;
      const vh = video.videoHeight || video.clientHeight;
      if (!vw || !vh) {
        // small safety: try to set overlay and return early
        setupOverlayCanvasSize();
        return;
      }

      // create an offscreen canvas for capture (not appended to DOM)
      const canvas = document.createElement("canvas");
      canvas.width = 480; // fixed capture width (keeps size stable)
      canvas.height = Math.round((vh / vw) * 480) || 360;

      const ctx = canvas.getContext("2d");
      // draw video frame into canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // quick pixel-check to avoid sending blank frames:
      // read a single pixel's alpha to ensure content exists (cheap)
      let isBlank = false;
      try {
        const px = ctx.getImageData(1, 1, 1, 1).data;
        isBlank = px[3] === 0; // fully transparent suggests something wrong
      } catch (err) {
        // sometimes cross-origin or read errors -> ignore
      }

      if (isBlank) return;

      // Use data URL (base64) instead of sending a file blob.
      // Flask expects either JSON image/frame or form text fields.
      try {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
        if (dataUrl && dataUrl.length > 100) {
          sendFrameToBackend(dataUrl);
        }
      } catch (err) {
        // fallback: try blob path if toDataURL fails
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size > 100) {
              sendFrameToBackend(blob);
            }
          },
          "image/jpeg",
          0.6
        );
      }
    } catch (err) {
      console.error("captureAndSendFrame error:", err);
    }
  };

  // ================================
  // SEND FRAME (with robust error handling)
  // ================================
  const blobToDataUrl = (b) => new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(b);
    } catch (e) {
      reject(e);
    }
  });

  const sendFrameToBackend = async (frameInput) => {
    // Check backend cooldown
    const now = Date.now();
    if (backendDown && now - lastBackendErrorAt.current < BACKEND_ERROR_COOLDOWN_MS) {
      return;
    }

    pendingRequests.current++;

    // Prepare payload. Prefer sending JSON with image field containing a base64 data URL
    // Backend (app.py) checks JSON or form fields named image or frame, or raw body.
    let payload = null;
    let headers = {};

    if (typeof frameInput === 'string') {
      // data URL or plain base64 string
      payload = {
        image: frameInput,
        userId,
        sessionId: sessionIdRef.current,
        timestamp: new Date().toISOString(),
      };
      headers['Content-Type'] = 'application/json';
    } else {
      // blob fallback: convert to data URL then send JSON
      try {
        const dataUrl = await blobToDataUrl(frameInput);
        payload = {
          image: dataUrl,
          userId,
          sessionId: sessionIdRef.current,
          timestamp: new Date().toISOString(),
        };
        headers['Content-Type'] = 'application/json';
      } catch (e) {
        // As a last resort, send multipart/form-data with a file field named frame.
        const form = new FormData();
        form.append("frame", frameInput, Date.now() + ".jpg");
        form.append("userId", userId);
        form.append("sessionId", sessionIdRef.current);
        form.append("timestamp", new Date().toISOString());
        payload = form;
        // Let axios set Content-Type for multipart
      }
    }

    try {
      const res = await axios.post("http://localhost:5000/api/process_face", payload, { timeout: AXIOS_TIMEOUT_MS, headers });
      const data = res.data;

      // backend-side "processing" (if you send frames faster than model) => ignore
      if (data.status === "processing") {
        return;
      }

      if (data.status === "success") {
        setFaceMissing(false);

        if (typeof data.stress_score === "number") {
          smoothingPush(data.stress_score);
        }

        setStressScores((prev) => [
          ...prev,
          {
            score: data.stress_score || 0,
            emotion: data.emotion || null,
            dashboard_data: data.dashboard_data || null
          }
        ]);

        if (data.emotion) setDominantEmotion(data.emotion);

        if (data.landmarks) drawLandmarks(data.landmarks);

        // if backend was previously flagged down, clear that flag on success
        if (backendDown) {
          setBackendDown(false);
        }
      } else if (data.status === "no_face") {
        setFaceMissing(true);
      } else {
        // unexpected payload
        console.warn("Unexpected backend response:", data);
      }
    } catch (err) {
      // robust logging & graceful backoff
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        console.error("sendFrameToBackend Axios error:", status, err.message);
        if (status === 500 || status === 502 || status === 503) {
          // mark backend down for short cooldown to prevent repeated 500s
          lastBackendErrorAt.current = Date.now();
          setBackendDown(true);
        }
      } else {
        console.error("sendFrameToBackend error:", err);
      }
    } finally {
      pendingRequests.current = Math.max(0, pendingRequests.current - 1);
    }
  };

  // ================================
  // DRAW LANDMARKS (overlay)
  // ================================
  const drawLandmarks = (landmarks) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    // ensure overlay canvas pixel size matches video pixel size
    try {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        setupOverlayCanvasSize();
      }
    } catch (e) { /* ignore */ }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#00FF00";

    // landmarks expected as array of [x, y] where x/y are either normalized (0..1) or pixel coords
    landmarks.forEach(([x, y]) => {
      const px = (x <= 1) ? Math.round(x * canvas.width) : Math.round(x);
      const py = (y <= 1) ? Math.round(y * canvas.height) : Math.round(y);
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  // ================================
  // SMOOTHING
  // ================================
  const smoothingPush = (score) => {
    const buf = smoothingBufferRef.current;
    buf.push(score);
    if (buf.length > SMOOTHING_WINDOW) buf.shift();
    smoothingBufferRef.current = buf;

    const sum = buf.reduce((a, b) => a + b, 0);
    const avg = buf.length ? Math.round((sum / buf.length) * 100) / 100 : 0;
    setCurrentStressScore(avg);
  };

  // ================================
  // HELPERS
  // ================================
  const getBarColor = (score) => {
    if (score === null || typeof score === "undefined") return '#9CA3AF';
    if (score < 40) return '#10B981';
    if (score < 75) return '#F59E0B';
    return '#EF4444';
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return String(mins).padStart(2, '0') + ":" + String(secs).padStart(2, '0');
  };

  const timerPercentage = (sessionTime / SESSION_DURATION_SECONDS) * 100;

  // ================================
  // UI
  // ================================
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-purple-100 p-6 md:p-8 relative overflow-x-hidden">

      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-200/30 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-200/30 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
      </div>

      <div className="max-w-[1400px] mx-auto relative z-10">

        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 tracking-tight">Stress Detection Session</h1>
          <p className="text-base md:text-lg text-gray-500 font-medium">Real-time AI monitoring & analysis</p>
        </motion.div>

        {/* MAIN GRID LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-6 items-start">

          {/* LEFT COLUMN (Flexible) */}
          <div className="flex flex-col gap-6 w-full min-w-0">

            {/* TIMER SECTION (Compact Card) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/90 backdrop-blur-md rounded-2xl shadow-sm border border-white/50 p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>

              <div className="flex items-center gap-4 z-10">
                <div className="w-16 h-16 relative">
                  <CircularProgressbar
                    value={timerPercentage}
                    text={formatTime(sessionTime)}
                    styles={buildStyles({
                      textColor: '#4F46E5',
                      pathColor: getBarColor(currentStressScore),
                      trailColor: '#F3F4F6',
                      textSize: '28px',
                      pathTransitionDuration: 0.5,
                    })}
                  />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Session Timer</h2>
                  <p className="text-sm text-gray-500">{sessionActive ? "Monitoring active" : "Ready to start"}</p>
                </div>
              </div>

              <div className="z-10">
                {!sessionActive ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={startSession}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition-all"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    Start Session
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={stopSession}
                    className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition-all"
                  >
                    <Square className="w-5 h-5 fill-current" />
                    Stop Session
                  </motion.button>
                )}
              </div>
            </motion.div>

            {/* WEBCAM SECTION (Fixed Height) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/90 backdrop-blur-md rounded-2xl shadow-sm border border-white/50 p-6 h-[480px] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-gray-800">Live Camera Feed</h2>
                </div>
                {sessionActive && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-medium border border-red-100">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    LIVE
                  </span>
                )}
              </div>

              <div className="relative flex-1 w-full rounded-xl overflow-hidden bg-gray-900 shadow-inner ring-1 ring-black/5">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                />

                {/* Overlays */}
                <AnimatePresence>
                  {!sessionActive && !cameraError && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/40 backdrop-blur-sm z-10"
                    >
                      <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 backdrop-blur-md border border-white/20">
                        <Video className="w-8 h-8 text-white/80" />
                      </div>
                      <p className="text-white/80 font-medium">Camera is waiting...</p>
                    </motion.div>
                  )}

                  {cameraError && !sessionActive && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/80 z-20"
                    >
                      <div className="text-center p-6">
                        <p className="text-red-400 font-bold mb-4">{cameraError}</p>
                        <button onClick={startSession} className="px-6 py-2 bg-white text-gray-900 rounded-lg font-bold hover:bg-gray-100 transition">Retry</button>
                      </div>
                    </motion.div>
                  )}

                  {faceMissing && sessionActive && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md text-white px-6 py-3 rounded-full flex items-center gap-2 shadow-lg z-10"
                    >
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                      <span className="font-medium">Face not detected</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* LIVE GRAPH (Fixed Height) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/90 backdrop-blur-md rounded-2xl shadow-sm border border-white/50 p-6 h-[380px] flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-gray-800">Stress Analysis</h2>
                </div>
                {dominantEmotion && (
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-semibold text-xs border border-indigo-100 uppercase tracking-wide">
                    {dominantEmotion}
                  </span>
                )}
              </div>

              <div className="flex-1 bg-gray-50/50 rounded-xl p-4 flex items-end gap-1 overflow-hidden relative border border-gray-100">
                {stressScores.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                    Waiting for session data...
                  </div>
                ) : (
                  stressScores.slice(-60).map((score, index) => (
                    <motion.div
                      key={index}
                      initial={{ height: 0 }}
                      animate={{ height: Math.min(100, score.score) + "%" }}
                      className="flex-1 rounded-t-sm min-w-[4px] max-w-[12px]"
                      style={{ background: getBarColor(score.score) }}
                    />
                  ))
                )}
              </div>

              {/* Live Average Score */}
              <div className="mt-4 flex justify-between items-center px-2">
                <span className="text-sm font-medium text-gray-500">Live Average Stress (Last 60s)</span>
                <span className="text-lg font-bold text-indigo-600">
                  {stressScores.length > 0
                    ? Math.round(stressScores.slice(-60).reduce((s, i) => s + i.score, 0) / stressScores.slice(-60).length) + "%"
                    : "—"}
                </span>
              </div>
            </motion.div>

          </div>

          {/* RIGHT COLUMN (Sticky Chat) */}
          <div className="lg:col-span-1">
            <div className="h-[600px] lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
              <Chat sessionId={sessionIdRef.current} />
            </div>
          </div>

        </div>
      </div>

      {/* MODAL */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={closeModalAndNavigate}
        overlayClassName="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
        className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full outline-none relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-indigo-500 to-purple-600"></div>

        <h2 className="text-3xl font-bold text-center text-gray-900 mb-2 mt-4">Session Complete!</h2>
        <p className="text-center text-gray-500 mb-8">Great job taking time for yourself.</p>

        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-20"></div>
            <div className="w-40 h-40 rounded-full bg-indigo-50 flex flex-col items-center justify-center border-4 border-indigo-100 shadow-inner">
              <span className="text-sm text-gray-500 font-medium uppercase tracking-wider">Avg Stress</span>
              <span className="text-5xl font-bold text-indigo-600 mt-1">
                {stressScores.length > 0
                  ? Math.round(stressScores.reduce((s, i) => s + i.score, 0) / stressScores.length) + "%"
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={closeModalAndNavigate}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all text-lg"
        >
          View Full Dashboard
        </motion.button>
      </Modal>
    </div>
  );
}
