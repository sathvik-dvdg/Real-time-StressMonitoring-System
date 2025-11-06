import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from '../context/authContext/AuthContext';
import Chat from '../components/Chat'; // Import the new Chat component

const SessionPage = () => {
  const { userLoggedIn, currentUser } = useAuth();
  const [sessionActive, setSessionActive] = useState(false);
  const [stressScores, setStressScores] = useState([]);
  const [sessionTime, setSessionTime] = useState(0);
  const [currentStressScore, setCurrentStressScore] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);

  const sessionTimerRef = useRef(null);
  const frameTimerRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const isSendingRef = useRef(false);

  const navigate = useNavigate();

  // Get the current user's ID
  const userId = currentUser ? currentUser.uid : 'anonymous';

  // ---------- START SESSION ----------
  const startSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => setIsCameraReady(true);
      }
    } catch (error) {
      console.error("Error starting session:", error);
    }
  };

  // ---------- STOP SESSION ----------
  const stopSession = () => {
    // Clear timers and release camera resources
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    setSessionActive(false);
    setIsCameraReady(false); // Reset camera ready state
    
    // All data was saved by the backend in real-time.
    // We just navigate to the summary page.
    console.log("Session stopped. All data saved by backend.");
    navigate("/summary");
  };

  // Logic to start the session timers once the camera is ready
  useEffect(() => {
    if (isCameraReady && !sessionActive) {
      setSessionActive(true);
      setSessionTime(0);
      setCurrentStressScore(null);
      setStressScores([]);

      // Session timer (1s)
      sessionTimerRef.current = setInterval(() => {
        setSessionTime((prev) => prev + 1);
      }, 1000);

      // Frame sender (1 FPS)
      frameTimerRef.current = setInterval(() => {
        captureAndSend();
      }, 1000);
    }
  }, [isCameraReady, sessionActive]);

  // Session timeout (2 minutes)
  useEffect(() => {
    if (sessionTime >= 120 && sessionActive) {
      stopSession();
    }
  }, [sessionTime, sessionActive]);

  // ---------- CAPTURE + SEND (FACIAL DATA) ----------
  const captureAndSend = async () => {
    if (
      isSendingRef.current ||
      !videoRef.current ||
      videoRef.current.readyState !== 4
    ) {
      return;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);

    const latestImageData = canvas.toDataURL("image/jpeg", 0.5);
    // console.log("Frame size (KB):", (latestImageData.length / 1024).toFixed(1));

    isSendingRef.current = true;
    setIsLoading(true);

    try {
      // 💥 FIXED: Call the correct /api/process_face endpoint
      const response = await axios.post("http://localhost:5000/api/process_face", {
        userId: userId,
        imageData: latestImageData,
        timestamp: new Date().toISOString()
      });

      if (response.data?.stress_score !== undefined) {
        const newStressScore = {
          timestamp: new Date().toISOString(),
          score: response.data.stress_score,
        };
        // Update local state for the live graph
        setStressScores((prev) => [...prev, newStressScore]);
        setCurrentStressScore(response.data.stress_score);
      }
    } catch (error) {
      if (error.response) {
        console.error("Backend error (facial):", error.response.status, error.response.data);
      } else {
        console.error("Request setup error (facial):", error.message);
      }
    } finally {
      isSendingRef.current = false;
      setIsLoading(false);
    }
  };

  // ---------- UTILITY FUNCTIONS ----------
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // ---------- CLEANUP ----------
  useEffect(() => {
    // This runs when the component unmounts (e.g., user navigates away)
    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      if (frameTimerRef.current) clearInterval(frameTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Stress Detection Session
          </h1>
          <p className="text-lg text-gray-600">Real-time monitoring and analysis</p>
        </div>

        {/* Timer */}
        <div className="text-center mb-8">
          <div className="text-6xl font-bold text-indigo-600 mb-2">
            {formatTime(sessionTime)} / 02:00
          </div>
          <div className="text-xl text-gray-600">
            {sessionActive ? "Session in Progress" : "Session Ready"}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 text-center">
          {!sessionActive ? (
            <button
              onClick={startSession}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition duration-300 transform hover:scale-105"
            >
              Start 2-Minute Session
            </button>
          ) : (
            <div>
              <div className="text-4xl font-bold text-green-600 mb-4">Session Active</div>
              <button
                onClick={stopSession}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition duration-300 transform hover:scale-105"
              >
                Stop Session
              </button>
            </div>
          )}
        </div>

        {/* Data Saving Status */}
        <div className="text-center mt-4 mb-8">
          {userLoggedIn ? (
            <span className="text-sm font-medium text-green-600">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Logged in. Session data will be saved.
            </span>
          ) : (
            <span className="text-sm font-medium text-red-600">
              <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-2"></span>
              You are not logged in. Session data will not be saved.
            </span>
          )}
        </div>

        {/* Main Content Area (Webcam, Chat, Graph) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1: Webcam & Graph */}
          <div className="lg:col-span-2">
            {/* Webcam */}
            <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Webcam Feed</h3>
              <div className="flex justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="w-full max-w-md h-64 bg-gray-200 rounded-lg"
                />
              </div>
            </div>

            {/* Graph */}
            {stressScores.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                  Live Facial Stress Graph
                </h2>
                <div className="h-64 bg-gray-50 rounded-lg p-4 mb-4 overflow-x-auto flex items-end">
                  {stressScores.map((score, index) => (
                    <div key={index} className="flex flex-col items-center mx-1">
                      <div
                        className="w-6 bg-indigo-500 rounded-t transition-all duration-500"
                        style={{ height: `${score.score * 2}px` }} // Scale score for viz
                      ></div>
                      <span className="text-xs text-gray-500 mt-1">{score.score}</span>
                    </div>
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-lg text-gray-700">
                    Current Stress Level:{" "}
                    <span className="font-bold text-indigo-600">{currentStressScore}%</span>
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Column 2: Chat Component */}
          <div className="lg:col-span-1">
            <Chat />
          </div>

        </div>
      </div>
    </div>
  );
};

export default SessionPage;