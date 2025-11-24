import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

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
const CAPTURE_INTERVAL_MS = 50;           // ~20 FPS
const SMOOTHING_WINDOW = 5;
const MAX_PENDING_REQUESTS = 2;
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
  const startSession = async () => {
    sessionIdRef.current = uuidv4();

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

        await videoRef.current.play().catch(() => {});
        setIsCameraReady(true);
      }
    } catch (err) {
      console.error("Error getting camera:", err);
      alert("Camera access failed. Check camera permissions and try again.");
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

    // ============== PREPARE FINAL SUMMARY =============
    if (stressScores.length > 0) {
      const sessionScoreSum = stressScores.reduce((s, item) => s + (item.score || 0), 0);
      const avg = Math.round(sessionScoreSum / stressScores.length);

      // ----------------------------------------
      // AGGREGATE dashboard_data for session
      // ----------------------------------------
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

      // Normalize dashboard_data
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

      // ----------------------------------------
      // WRITE SESSION + META SUMMARY (BATCH)
      // ----------------------------------------
      if (userLoggedIn && currentUser) {
        try {
          const batch = writeBatch(db);

          const sessionID = sessionIdRef.current;
          const sessionRef = doc(db, 'users', userId, 'sessions', sessionID);

          batch.set(sessionRef, {
            averageScore: avg,
            timestamp: serverTimestamp(),
            scoresCount: stressScores.length,
            readingsCount: stressScores.length,
            dashboard_data,
            sessionId: sessionID,
          });

          // META SUMMARY
          const summaryRef = doc(db, 'users', userId, 'meta', 'summary');
          batch.set(summaryRef, {
            totalSessions: increment(1),
            totalReadings: increment(stressScores.length)
          }, { merge: true });

          await batch.commit();
        } catch (err) {
          console.error("Error saving session summary:", err);
        }
      }
    }

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
        try { streamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
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

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size > 100) { // ensure blob not empty (tiny images often invalid)
            sendFrameToBackend(blob);
          } else {
            // ignore tiny/empty blobs that could trigger downstream errors
          }
        },
        "image/jpeg",
        0.6
      );
    } catch (err) {
      console.error("captureAndSendFrame error:", err);
    }
  };

  // ================================
  // SEND FRAME (with robust error handling)
  // ================================
  const sendFrameToBackend = async (blob) => {
    // Check backend cooldown
    const now = Date.now();
    if (backendDown && now - lastBackendErrorAt.current < BACKEND_ERROR_COOLDOWN_MS) {
      return;
    }

    pendingRequests.current++;

    const form = new FormData();
    form.append("frame", blob, `${Date.now()}.jpg`);
    form.append("userId", userId);
    form.append("sessionId", sessionIdRef.current);
    form.append("timestamp", new Date().toISOString());

    try {
      const res = await axios.post("http://localhost:5000/api/process_face", form, { timeout: AXIOS_TIMEOUT_MS });
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
    return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  };

  const timerPercentage = (sessionTime / SESSION_DURATION_SECONDS) * 100;

  // ================================
  // UI
  // ================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* HEADER */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Stress Detection Session</h1>
          <p className="text-lg text-gray-600">Real-time monitoring (20 FPS → 1 Hz scoring)</p>
        </div>

        {/* TIMER */}
        <div className="text-center mb-8">
          <div className="w-48 h-48 mx-auto mb-4">
            <CircularProgressbar
              value={timerPercentage}
              text={formatTime(sessionTime)}
              styles={buildStyles({
                textColor: '#4F46E5',
                pathColor: getBarColor(currentStressScore),
                trailColor: '#E5E7EB',
                textSize: '20px'
              })}
            />
          </div>
          <div className="text-xl text-gray-600">
            {sessionActive ? "Session in Progress" : "Session Ready"}
          </div>
        </div>

        {/* START / STOP */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 text-center">
          {!sessionActive ? (
            <button
              onClick={startSession}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition">
              Start 2-Minute Session
            </button>
          ) : (
            <div>
              <div className="text-4xl font-bold text-green-600 mb-4 animate-pulse">Session Active</div>
              <button
                onClick={stopSession}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition">
                Stop Session
              </button>
            </div>
          )}
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">

            {/* WEBCAM */}
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8 relative">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Webcam Feed</h3>

              <div className="flex justify-center relative">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full max-w-md h-64 bg-gray-900 rounded-lg object-cover"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full pointer-events-none max-w-md left-1/2 -translate-x-1/2"
                />

                {faceMissing && sessionActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/60 text-white rounded-xl px-6 py-4">
                      <div className="font-bold text-lg">Please look at the camera</div>
                    </div>
                  </div>
                )}

                {backendDown && (
                  <div className="absolute inset-0 flex items-start justify-center pointer-events-none">
                    <div className="mt-6 bg-yellow-50 text-yellow-700 rounded-full px-4 py-2 text-sm font-medium shadow-sm">
                      Backend temporarily unavailable — pausing sends
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* LIVE GRAPH */}
            {stressScores.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Live Facial Stress Graph</h2>
                  {dominantEmotion && (
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full font-bold">
                      {dominantEmotion}
                    </span>
                  )}
                </div>

                <div className="h-64 bg-gray-50 rounded-lg p-4 mb-4 flex items-end space-x-1 overflow-x-auto">
                  {stressScores.slice(-40).map((score, index) => (
                    <div key={index} className="flex flex-col items-center w-3">
                      <div
                        className="w-full rounded-t transition-all"
                        style={{
                          height: `${Math.min(100, score.score) * 1.8}px`,
                          background: getBarColor(score.score)
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="text-center">
                  <p className="text-lg text-gray-700">
                    Current Stress Level:{" "}
                    <span className="font-bold text-2xl ml-2" style={{ color: getBarColor(currentStressScore) }}>
                      {currentStressScore !== null ? `${Math.round(currentStressScore)}%` : "—"}
                    </span>
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* CHAT */}
          <div className="lg:col-span-1 h-[600px]">
            <Chat sessionId={sessionIdRef.current} />
          </div>
        </div>
      </div>

      {/* END MODAL */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={closeModalAndNavigate}
        className="relative bg-white rounded-xl shadow-2xl p-8 max-w-md mx-auto mt-32"
      >
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Session Complete!</h2>

        <div className="text-center my-8">
          <p className="text-lg text-gray-700 mb-2">Average Stress</p>
          <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-indigo-50 mb-4">
            <p className="text-5xl font-bold text-indigo-600">
              {stressScores.length > 0
                ? `${Math.round(stressScores.reduce((s, i) => s + i.score, 0) / stressScores.length)}%`
                : "—"}
            </p>
          </div>
        </div>

        <button
          onClick={closeModalAndNavigate}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg"
        >
          View Full Dashboard
        </button>
      </Modal>
    </div>
  );
}
