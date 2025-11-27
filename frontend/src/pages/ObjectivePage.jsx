import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Target,
  TrendingUp,
  Users,
  Briefcase,
  GraduationCap,
  CheckCircle2
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 }
  }
};

const ObjectivePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 py-16 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-7xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="text-center mb-16" variants={itemVariants}>
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl mb-4">
            Project Objective & Problem Statement
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Bridging the gap between physical cues and cognitive state for a holistic view of well-being.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 mb-20">
          {/* Problem Card */}
          <motion.div
            className="bg-white rounded-2xl shadow-xl p-8 border-l-4 border-orange-500 relative overflow-hidden group hover:shadow-2xl transition-all duration-300"
            variants={itemVariants}
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <AlertTriangle className="w-32 h-32 text-orange-500" />
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-orange-100 rounded-xl">
                <AlertTriangle className="w-8 h-8 text-orange-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">The Problem</h2>
            </div>
            <p className="text-gray-600 text-lg leading-relaxed relative z-10">
              Existing non-invasive stress detection systems often fail to provide a robust, real-time assessment because they rely on a single data modality (e.g., facial cues <strong>or</strong> text analysis alone). This makes them vulnerable to errors; for example, a facial model may misinterpret a frown of concentration as stress.
            </p>
          </motion.div>

          {/* Objective Card */}
          <motion.div
            className="bg-white rounded-2xl shadow-xl p-8 border-l-4 border-indigo-500 relative overflow-hidden group hover:shadow-2xl transition-all duration-300"
            variants={itemVariants}
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Target className="w-32 h-32 text-indigo-500" />
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <Target className="w-8 h-8 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Our Objective</h2>
            </div>
            <p className="text-gray-600 text-lg leading-relaxed mb-6 relative z-10">
              To create an accessible, multimodal AI framework that fuses real-time data from two complementary channels:
            </p>
            <ul className="space-y-3 relative z-10">
              {[
                "Real-time detection (face + text)",
                "AI wellness assistant",
                "Consultant finder integration"
              ].map((item, index) => (
                <li key={index} className="flex items-center gap-3 text-gray-700 font-medium">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Why This Matters Strip */}
        <motion.div variants={itemVariants} className="bg-white/60 backdrop-blur-md rounded-3xl p-8 shadow-lg border border-white/50">
          <h3 className="text-2xl font-bold text-center text-gray-800 mb-10">Why This Matters To You</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <GraduationCap className="w-8 h-8 text-blue-600" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">Students</h4>
              <p className="text-gray-600">Prevent burnout during high-pressure exam seasons and study marathons.</p>
            </div>
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Briefcase className="w-8 h-8 text-purple-600" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">Professionals</h4>
              <p className="text-gray-600">Manage cognitive load and maintain peak performance without the crash.</p>
            </div>
            <div className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">Everyday Users</h4>
              <p className="text-gray-600">Gain objective insights into your well-being and build better habits.</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default ObjectivePage;