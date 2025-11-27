import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Briefcase,
  Code,
  ShieldCheck,
  Activity,
  ArrowRight,
  RefreshCw
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
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 }
  }
};

const ScenariosPage = () => {
  const [workload, setWorkload] = useState(50);
  const [sleep, setSleep] = useState(7);

  // Simple heuristic for demo purposes
  const simulatedStress = Math.min(100, Math.max(0, Math.round(
    (workload * 0.7) + ((8 - sleep) * 10)
  )));

  const getSuggestion = (score) => {
    if (score < 30) return "You're in the green! Keep maintaining this balance.";
    if (score < 70) return "Moderate stress. Consider a 5-minute breathing exercise.";
    return "High stress detected. It's highly recommended to take a break now.";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-teal-50 py-16 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-7xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl mb-4">
            Real-World Scenarios
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            See how our system adapts to different high-pressure environments.
          </p>
        </div>

        {/* Scenario Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {[
            {
              icon: User,
              title: "Student During Exams",
              desc: "Late-night study sessions and exam anxiety can lead to burnout.",
              badge: "Prevention",
              badgeColor: "bg-blue-100 text-blue-700",
              color: "text-blue-600"
            },
            {
              icon: Briefcase,
              title: "Call Center Agent",
              desc: "Handling difficult customers requires constant emotional regulation.",
              badge: "Recovery",
              badgeColor: "bg-purple-100 text-purple-700",
              color: "text-purple-600"
            },
            {
              icon: Code,
              title: "Remote Developer",
              desc: "Tight deadlines and debugging complex code can cause silent stress spikes.",
              badge: "Monitoring",
              badgeColor: "bg-orange-100 text-orange-700",
              color: "text-orange-600"
            }
          ].map((card, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 hover:shadow-xl transition-shadow relative overflow-hidden"
            >
              <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${card.badgeColor}`}>
                {card.badge}
              </div>
              <div className={`w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center mb-6 ${card.color}`}>
                <card.icon className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{card.title}</h3>
              <p className="text-gray-600 mb-6">{card.desc}</p>
              <Link to="/session" className="text-indigo-600 font-semibold flex items-center hover:text-indigo-800 transition-colors">
                Try this scenario <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Interactive Simulator */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200"
        >
          <div className="bg-gray-900 p-8 text-white text-center">
            <h2 className="text-3xl font-bold mb-2">Stress Level Simulator</h2>
            <p className="text-gray-400">Adjust the sliders to see how factors impact your stress score.</p>
          </div>

          <div className="p-8 md:p-12 grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="font-semibold text-gray-700">Workload Intensity</label>
                  <span className="text-indigo-600 font-bold">{workload}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={workload}
                  onChange={(e) => setWorkload(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="font-semibold text-gray-700">Hours of Sleep</label>
                  <span className="text-indigo-600 font-bold">{sleep} hrs</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="12"
                  value={sleep}
                  onChange={(e) => setSleep(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100">
              <h3 className="text-gray-500 font-medium mb-4 uppercase tracking-wider text-sm">Predicted Stress Score</h3>
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-40 h-40 transform -rotate-90">
                  <circle cx="80" cy="80" r="70" stroke="#e5e7eb" strokeWidth="12" fill="none" />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke={simulatedStress > 70 ? "#ef4444" : simulatedStress > 30 ? "#f59e0b" : "#10b981"}
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray="440"
                    strokeDashoffset={440 - (440 * simulatedStress) / 100}
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
                <span className="absolute text-4xl font-bold text-gray-900">{simulatedStress}</span>
              </div>
              <div className="mt-6 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                <p className="text-gray-700 font-medium">
                  {getSuggestion(simulatedStress)}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
};

export default ScenariosPage;