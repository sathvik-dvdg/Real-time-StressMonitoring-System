import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from '../context/authContext/AuthContext';
import Chat from '../components/Chat'; 
import { db } from '../database/firebaseconfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

// 💥 1. IMPORT REACT-MODAL
import Modal from 'react-modal';

// 💥 2. Set the app element for accessibility (required by react-modal)
Modal.setAppElement('#root');

const SessionPage = () => {
  const { userLoggedIn, currentUser } = useAuth();
  const [sessionActive, setSessionActive] = useState(false);
  const [stressScores, setStressScores] = useState([]);
  const [sessionTime, setSessionTime] = useState(0); // This is in seconds
  const [currentStressScore, setCurrentStressScore] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  
  // 💥 3. ADD STATE FOR THE MODAL
  const [isModalOpen, setIsModalOpen] = useState(false);
  const sessionAvgScore = useRef(0); // Ref to hold the final average score

  const sessionTimerRef = useRef(null);
  const frameTimerRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const isSendingRef = useRef(false);
  const sessionIdRef = useRef(null); 

  const navigate = useNavigate();
  const userId = currentUser ? currentUser.uid : 'anonymous';
  const SESSION_DURATION_SECONDS = 120; // 2 minutes

  // ---------- START SESSION ----------
  const startSession = async () => {
    sessionIdRef.current = uuidv4();
    console.log("New Session Started:", sessionIdRef.current);
    
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

  // ---------- STOP SESSION (UPDATED) ----------
  const stopSession = async () => {
    // 1. Clear timers and release camera
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setSessionActive(false);
    setIsCameraReady(false); 
    
    // 2. Save session summary to Firebase
    if (userLoggedIn && currentUser && stressScores.length > 0) {
      console.log("Saving session summary...");
      try {
        const totalScore = stressScores.reduce((sum, current) => sum + current.score, 0);
        const averageScore = Math.round(totalScore / stressScores.length);
        
        sessionAvgScore.current = averageScore; // 💥 4. Store the average score
        
        const sessionID = sessionIdRef.current; 
        const sessionRef = doc(db, 'users', userId, 'sessions', sessionID);
        
        await setDoc(sessionRef, {
          averageScore: averageScore,
          timestamp: serverTimestamp(),
          scores: stressScores, 
          sessionId: sessionID
        });
        
        console.log("Session summary saved successfully!");
        
      } catch (error) {
        console.error("Error saving session summary:", error);
      }
    }
    
    // 💥 5. OPEN THE MODAL (instead of navigating)
    console.log("Session stopped. Opening summary modal.");
    setIsModalOpen(true);
  };
  
  // 💥 6. ADD A FUNCTION TO CLOSE THE MODAL AND NAVIGATE
  const closeModalAndNavigate = () => {
    setIsModalOpen(false);
    navigate("/summary");
  };

  // Logic to start the session timers
  useEffect(() => {
    if (isCameraReady && !sessionActive) {
      setSessionActive(true);
      setSessionTime(0);
      setCurrentStressScore(null);
      setStressScores([]);
      sessionTimerRef.current = setInterval(() => {
        setSessionTime((prev) => prev + 1);
      }, 1000);
      frameTimerRef.current = setInterval(() => {
        captureAndSend();
      }, 1000);
    }
  }, [isCameraReady, sessionActive]);

  // Session timeout
  useEffect(() => {
    if (sessionTime >= SESSION_DURATION_SECONDS && sessionActive) {
      stopSession();
    }
  }, [sessionTime, sessionActive]);

  // ---------- CAPTURE + SEND (FACIAL DATA) ----------
  const captureAndSend = async () => {
    if (isSendingRef.current || !videoRef.current || videoRef.current.readyState !== 4) {
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    const latestImageData = canvas.toDataURL("image/jpeg", 0.5);
    isSendingRef.current = true;
    setIsLoading(true);

    try {
      const response = await axios.post("http://localhost:5000/api/process_face", {
        userId: userId,
        sessionId: sessionIdRef.current,
        imageData: latestImageData,
        timestamp: new Date().toISOString()
      });

      if (response.data?.stress_score !== undefined) {
        const newStressScore = {
          timestamp: new Date().toISOString(),
          score: response.data.stress_score,
        };
        setStressScores((prev) => [...prev, newStressScore]);
        setCurrentStressScore(response.data.stress_score);
      }
    } catch (error) {
      console.error("Backend error (facial):", error);
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
  const timerPercentage = (sessionTime / SESSION_DURATION_SECONDS) * 100;

  // ---------- CLEANUP ----------
  useEffect(() => {
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
          <div className="w-48 h-48 mx-auto mb-4">
            <CircularProgressbar
              value={timerPercentage}
              text={formatTime(sessionTime)}
              styles={buildStyles({
                textColor: '#4F46E5', // indigo-600
                pathColor: '#4F46E5', // indigo-600
                trailColor: '#E5E7EB', // gray-200
                textSize: '20px',
                pathTransitionDuration: 0.5,
              })}
            />
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
        
        {/* Main Content Area */}
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
                      <span className="text-xs text-gray-500 mt-1">{Math.round(score.score)}</span>
                    </div>
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-lg text-gray-700">
                    Current Stress Level:{" "}
                    <span className="font-bold text-indigo-600">{Math.round(currentStressScore)}%</span>
                  </p>
                </div>
              </div>
            )}

          </div>
          
          {/* Column 2: Chat Component */}
          <div className="lg:col-span-1">
            <Chat sessionId={sessionIdRef.current} />
          </div>
        </div>
      </div>

      {/* 💥 7. ADD THE MODAL COMPONENT */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={closeModalAndNavigate}
        contentLabel="Session Summary"
        // Modern & Minimal styling for the modal
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-8 max-w-md w-full"
        overlayClassName="fixed inset-0 bg-black bg-opacity-60"
      >
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Session Complete!</h2>
        <p className="text-center text-gray-600 mb-6">
          Your session data has been saved. Here's your average facial stress score for this session.
        </p>
        
        <div className="text-center my-8">
          <p className="text-lg text-gray-700">Average Stress</p>
          <p className="text-7xl font-bold text-indigo-600">
            {sessionAvgScore.current}%
          </p>
        </div>
        
        <button
          onClick={closeModalAndNavigate}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition duration-300"
        >
          View Full Dashboard
        </button>
      </Modal>
    </div>
  );
};

export default SessionPage;