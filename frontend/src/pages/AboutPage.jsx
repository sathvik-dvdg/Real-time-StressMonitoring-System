import React from 'react';
import { motion } from 'framer-motion';
import {
  Camera,
  Brain,
  MessageSquare,
  Database,
  Activity,
  ArrowRight,
  Play
} from 'lucide-react';
import { Link } from 'react-router-dom';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5 }
  }
};

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-16 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-5xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl mb-4">
            How It Works
          </h1>
          <p className="text-xl text-gray-600">
            A seamless pipeline from detection to actionable insights.
          </p>
        </div>

        {/* Stepper / Timeline */}
        <div className="relative mb-20 hidden md:block">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -translate-y-1/2 rounded-full" />
          <div className="grid grid-cols-4 gap-4 relative z-10">
            {[
              { icon: Camera, title: "Capture", desc: "Webcam & Text" },
              { icon: Brain, title: "Analyze", desc: "AI Models" },
              { icon: Activity, title: "Score", desc: "0-100 Scale" },
              { icon: MessageSquare, title: "Act", desc: "Chat & Consult" }
            ].map((step, index) => (
              <motion.div
                key={index}
                className="flex flex-col items-center text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2 }}
              >
                <div className="w-16 h-16 bg-white border-4 border-indigo-600 rounded-full flex items-center justify-center shadow-lg mb-4">
                  <step.icon className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">{step.title}</h3>
                <p className="text-sm text-gray-500">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Feature Cards */}
        <div className="space-y-6">
          {[
            {
              icon: Camera,
              title: "Real-time Facial Analysis",
              desc: "Analyzes eye-blink rate and mouth shape using MediaPipe & Random Forest models (1 FPS).",
              color: "bg-blue-100 text-blue-600"
            },
            {
              icon: Brain,
              title: "Textual Emotion Analysis",
              desc: "DistilRoBERTa model classifies chat text into 28 emotions to detect cognitive stress.",
              color: "bg-purple-100 text-purple-600"
            },
            {
              icon: MessageSquare,
              title: "AI Wellness Assistant",
              desc: "Google Gemini API provides instant, conversational support and stress management tips.",
              color: "bg-green-100 text-green-600"
            },
            {
              icon: Database,
              title: "Secure Database",
              desc: "Firebase Firestore ensures your data is encrypted and accessible only by you.",
              color: "bg-orange-100 text-orange-600"
            }
          ].map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="bg-white rounded-xl shadow-md p-6 flex items-center gap-6 hover:shadow-lg transition-shadow border border-gray-100"
            >
              <div className={`flex-shrink-0 w-16 h-16 ${feature.color} rounded-2xl flex items-center justify-center`}>
                <feature.icon className="w-8 h-8" />
              </div>
              <div className="flex-grow">
                <h3 className="text-xl font-bold text-gray-900 mb-1">{feature.title}</h3>
                <p className="text-gray-600">{feature.desc}</p>
              </div>
              <div className="hidden sm:block">
                <ArrowRight className="w-6 h-6 text-gray-300" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* View Sample Button */}
        <motion.div
          className="mt-16 text-center"
          variants={itemVariants}
        >
          <Link
            to="/session"
            className="inline-flex items-center px-8 py-4 bg-indigo-600 text-white rounded-full font-bold text-lg shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all transform hover:-translate-y-1"
          >
            <Play className="w-5 h-5 mr-2" />
            Start a Live Session
          </Link>
          <p className="mt-4 text-sm text-gray-500">
            Experience the analysis in real-time. No data is stored without your permission.
          </p>
        </motion.div>

      </motion.div>
    </div>
  );
};

export default AboutPage;