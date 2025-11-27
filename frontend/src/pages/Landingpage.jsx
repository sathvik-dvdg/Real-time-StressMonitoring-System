import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BrainCircuit,
  LineChart,
  MessageSquareText,
  MoveRight,
  MonitorPlay
} from 'lucide-react';
// 1. Import your new, reliable Lottie component
import FaceMeshAnimation from '../components/FaceMeshAnimation';
import AccessDeniedModal from '../components/AccessDeniedModal';
import { useAuth } from '../context/authContext/AuthContext';

// ... (your animation variants are unchanged) ...
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

const Landingpage = () => {
  const { userLoggedIn } = useAuth();
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const navigate = useNavigate();

  const handleProtectedAction = (path) => {
    if (userLoggedIn) {
      navigate(path);
    } else {
      setShowAccessDenied(true);
    }
  };

  return (
    // We are still using the animated-bg for the particles/grid
    <div className="relative isolate w-full flex items-center justify-center py-24 animated-bg">

      <AccessDeniedModal
        isOpen={showAccessDenied}
        onClose={() => setShowAccessDenied(false)}
      />

      {/* 2. Add the new FaceMeshAnimation component. */}
      {/* It will sit on z-index 5, behind the content */}
      <FaceMeshAnimation />

      {/* 3. Your content layer sits on top (z-index 10) */}
      <motion.div
        className="max-w-4xl mx-auto px-6 py-12 text-center content-layer"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.h1
          className="text-5xl font-bold text-white mb-6"
          variants={itemVariants}
        >
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
            AI-Powered
          </span> Stress Detection System
        </motion.h1>

        <motion.p
          className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto"
          variants={itemVariants}
        >
          Monitor your stress levels in real-time. Our AI analyzes your
          facial and textual cues to provide objective insights into your well-being.
        </motion.p>

        {/* ... (Rest of your buttons and sections are UNCHANGED) ... */}

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
          variants={itemVariants}
        >
          <button
            onClick={() => handleProtectedAction('/session')}
            className="group flex items-center justify-center gap-x-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-8 rounded-lg transition duration-300 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
          >
            Start New Session
            <MoveRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </button>
          <button
            onClick={() => handleProtectedAction('/dashboard')}
            className="bg-transparent hover:bg-blue-500/10 text-blue-300 font-semibold py-3 px-8 rounded-lg border-2 border-blue-500 transition duration-300"
          >
            View My Dashboard
          </button>
        </motion.div>

        <motion.div
          className="mt-20"
          variants={itemVariants}
        >
          <h2 className="text-3xl font-bold text-white mb-12">
            How It Works in 3 Simple Steps
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-blue-500/50">
                <MonitorPlay className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">1. Start Session</h3>
              <p className="text-gray-400">Begin a secure session. Our system activates your webcam and monitors your work patterns in the background.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-blue-500/50">
                <BrainCircuit className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">2. AI Analyzes</h3>
              <p className="text-gray-400">Our multimodal AI analyzes facial landmarks and chat sentiment in real-time. <strong>No video or personal text is ever stored.</strong></p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-blue-500/50">
                <LineChart className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">3. Get Insights</h3>
              <p className="text-gray-400">View your live stress score on your dashboard and see long-term trends to help you identify and manage stressors.</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-3 gap-8 mt-20"
          variants={itemVariants}
        >
          <div className="bg-slate-800/60 border border-blue-700/50 rounded-xl shadow-lg backdrop-blur-sm p-6">
            <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center mx-auto mb-4">
              <BrainCircuit className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Multimodal Analysis</h3>
            <p className="text-gray-400">Fuses facial and textual data for a robust, objective score.</p>
          </div>
          <div className="bg-slate-800/60 border border-blue-700/50 rounded-xl shadow-lg backdrop-blur-sm p-6">
            <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center mx-auto mb-4">
              <LineChart className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Real-Time Feedback</h3>
            <p className="text-gray-400">Get instant insights on your stress levels as they happen.</p>
          </div>
          <div className="bg-slate-800/60 border border-blue-700/50 rounded-xl shadow-lg backdrop-blur-sm p-6">
            <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center mx-auto mb-4">
              <MessageSquareText className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">AI Wellness Coach</h3>
            <p className="text-gray-400">Chat with an AI assistant to get tips or just to vent.</p>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
};

export default Landingpage;