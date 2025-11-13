import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion'; // 1. Import motion

// 2. Define animation variants for a staggered effect
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2, // This will make children animate one by one
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 }, // Start invisible and 20px down
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
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      
      {/* 3. Wrap your content in a <motion.div> with the container variants */}
      <motion.div 
        className="max-w-4xl mx-auto px-6 py-12 text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.h1 
          className="text-5xl font-bold text-gray-900 mb-6"
          variants={itemVariants} // 4. Animate the header
        >
          AI-Powered Stress Detection System
        </motion.h1>

        <motion.p 
          className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto"
          variants={itemVariants} // 5. Animate the paragraph
        >
          Monitor your stress levels in real-time. Our AI analyzes your 
          facial and textual cues to provide objective insights into your well-being.
        </motion.p>

        <motion.div 
          className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
          variants={itemVariants} // 6. Animate the button container
        >
          <Link
            to="/session"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg transition duration-300 transform hover:scale-105 shadow-lg"
          >
            Start New Session
          </Link>
          <Link
            to="/summary"
            className="bg-white hover:bg-gray-50 text-indigo-600 font-semibold py-3 px-8 rounded-lg border-2 border-indigo-600 transition duration-300 transform hover:scale-105 shadow-lg"
          >
            View My Dashboard
          </Link>
        </motion.div>

        {/* 7. Animate the feature cards as a group */}
        <motion.div 
          className="grid md:grid-cols-3 gap-8 mt-16"
          variants={itemVariants}
        >
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Multimodal Analysis</h3>
            <p className="text-gray-600">Fuses facial and textual data for a robust, objective score.</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Real-Time Feedback</h3>
            <p className="text-gray-600">Get instant insights on your stress levels as they happen.</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Wellness Coach</h3>
            <p className="text-gray-600">Chat with an AI assistant to get tips or just to vent.</p>
          </div>
        </motion.div>
        
      </motion.div>
    </div>
  );
};

export default Landingpage;