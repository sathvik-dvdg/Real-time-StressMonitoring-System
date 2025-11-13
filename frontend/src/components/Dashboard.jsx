import React, { useEffect, useState } from "react";
import { useAuth } from "../context/authContext/AuthContext";
import { db } from "../database/firebaseconfig";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import {
  calculateStressTrends,
  getStressLevelInfo,
  formatTimestamp,
  getTimeAgo,
  calculateSessionStats,
  generateInsights,
} from "../utils/dashboardUtils";

// 1. IMPORT RECHARTS
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// 💥 2. IMPORT FRAMER MOTION
import { motion } from "framer-motion";

// --- Colors for the Pie Chart ---
const PIE_COLORS = {
  anger: "#EF4444", annoyance: "#F87171", disappointment: "#FCA5A5",
  sadness: "#DC2626", grief: "#B91C1C", fear: "#F97316",
  nervousness: "#FB923C", disgust: "#CA8A04", remorse: "#F59E0B",
  embarrassment: "#FCD34D", joy: "#22C55E", amusement: "#4ADE80",
  approval: "#86EFAC", optimism: "#10B981", gratitude: "#34D399",
  love: "#EC4899", caring: "#F472B6", excitement: "#14B8A6",
  relief: "#A78BFA", confusion: "#A1A1AA", curiosity: "#A1A1AA",
  realization: "#A1A1AA", surprise: "#A1A1AA", admiration: "#60A5FA",
  desire: "#60A5FA", pride: "#60A5FA", neutral: "#A1A1AA",
};
const DEFAULT_COLOR = "#D1D5DB";

// 💥 3. DEFINE ANIMATION VARIANTS
// Parent container to orchestrate the stagger
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1, // Each child animates 0.1s after the previous one
    },
  },
};

// Child items to fade in and slide up
const itemVariants = {
  hidden: { opacity: 0, y: 20 }, // Start invisible and 20px down
  visible: {
    opacity: 1,
    y: 0, // Animate to visible and original position
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};


export default function Dashboard() {
  const { currentUser, userLoggedIn } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fusedData, setFusedData] = useState([]);
  const [emotionData, setEmotionData] = useState([]);
  
  const [summaryStats, setSummaryStats] = useState({
    totalSessions: 0, averageStress: 0, highestStress: 0,
    lowestStress: 100, totalReadings: 0, lastSessionDate: null,
  });
  const [trends, setTrends] = useState({
    trend: "stable", trendPercentage: 0, improvement: false,
  });
  const [insights, setInsights] = useState([]);

  // Helper function to parse timestamps consistently
  const parseTimestamp = (timestamp) => {
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate(); // It's a Firestore Timestamp
    }
    if (timestamp) {
      return new Date(timestamp); // It's an ISO string
    }
    return null;
  };

  useEffect(() => {
    if (!userLoggedIn || !currentUser) {
      setSessions([]);
      setLoading(false);
      return;
    }

    // --- 1. Fetch session summaries (for cards and lists) ---
    const sessionsRef = collection(db, `users/${currentUser.uid}/sessions`);
    const sessionsQuery = query(sessionsRef, orderBy("timestamp", "desc"), limit(20));

    const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSessions(data);

      // --- 2. Calculate stats for top cards ---
      const stats = calculateSessionStats(data);
      const trendsData = calculateStressTrends(data);
      const insightsData = generateInsights(stats, trendsData);

      if (data.length > 0) {
        const allScores = data.flatMap((session) => session.scores || []);
        const allStressValues = allScores.map((score) => score.score || 0);
        const highestStress = allStressValues.length > 0 ? Math.max(...allStressValues) : 0;
        const lowestStress = allStressValues.length > 0 ? Math.min(...allStressValues) : 0;
        const lastSessionDate = parseTimestamp(data[0]?.timestamp);

        setSummaryStats({
          ...stats,
          highestStress: Math.round(highestStress),
          lowestStress: Math.round(lowestStress),
          lastSessionDate,
        });
      } else {
        setSummaryStats({ totalSessions: 0, averageStress: 0, highestStress: 0, lowestStress: 0, totalReadings: 0, lastSessionDate: null });
      }

      setTrends(trendsData);
      setInsights(insightsData);
      setLoading(false);
    });

    // --- 3. Fetch ALL individual scores (for the new charts) ---
    const scoresRef = collection(db, `users/${currentUser.uid}/stress_scores`);
    const scoresQuery = query(scoresRef, orderBy("timestamp", "asc")); 

    const unsubscribeScores = onSnapshot(scoresQuery, (snapshot) => {
      const allScores = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const facialScores = [];
      const textualScores = [];
      const emotionCounts = {};

      allScores.forEach(item => {
        const dateObj = parseTimestamp(item.timestamp);
        if (!dateObj) return; 
        const timeKey = dateObj.toLocaleTimeString();

        if (item.type === 'facial') {
          facialScores.push({ time: timeKey, score: item.score, timestamp: dateObj });
        } else if (item.type === 'textual') {
          textualScores.push({ time: timeKey, score: item.score, timestamp: dateObj, text: item.text });
          if (item.detected_emotions) {
            item.detected_emotions.forEach(emotion => {
              emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
            });
          }
        }
      });
      
      // --- 4. SMOOTHING LOGIC ---
      const smoothedData = [];
      let lastTextScore = 50; 
      
      if (facialScores.length > 0) {
        const binSize = 30 * 1000; // 30 seconds
        let currentBinTime = facialScores[0].timestamp.getTime();
        let scoresInBin = [];

        for (const faceEntry of facialScores) {
          const relevantTextScores = textualScores.filter(t => t.timestamp <= faceEntry.timestamp);
          if (relevantTextScores.length > 0) {
            lastTextScore = relevantTextScores[relevantTextScores.length - 1].score;
          }

          if (faceEntry.timestamp.getTime() - currentBinTime <= binSize) {
            scoresInBin.push({ ...faceEntry, textual: lastTextScore });
          } else if (scoresInBin.length > 0) {
            const avgFacial = scoresInBin.reduce((sum, s) => sum + s.score, 0) / scoresInBin.length;
            const avgTextual = scoresInBin.reduce((sum, s) => sum + s.textual, 0) / scoresInBin.length;
            const fusedScore = Math.round((avgFacial * 0.7) + (avgTextual * 0.3));

            smoothedData.push({
              time: new Date(currentBinTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              masterStress: fusedScore,
              facial: Math.round(avgFacial),
              textual: Math.round(avgTextual)
            });

            scoresInBin = [{ ...faceEntry, textual: lastTextScore }];
            currentBinTime = faceEntry.timestamp.getTime();
          } else {
             currentBinTime = faceEntry.timestamp.getTime();
          }
        }
        if(scoresInBin.length > 0) {
             const avgFacial = scoresInBin.reduce((sum, s) => sum + s.score, 0) / scoresInBin.length;
            const avgTextual = scoresInBin.reduce((sum, s) => sum + s.textual, 0) / scoresInBin.length;
            const fusedScore = Math.round((avgFacial * 0.7) + (avgTextual * 0.3));
            smoothedData.push({
              time: new Date(currentBinTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              masterStress: fusedScore,
              facial: Math.round(avgFacial),
              textual: Math.round(avgTextual)
            });
        }
      }
      setFusedData(smoothedData);

      // --- Create Emotion Data for Pie Chart ---
      const totalEmotions = Object.values(emotionCounts).reduce((sum, count) => sum + count, 0);
      if (totalEmotions > 0) {
        const pieData = Object.keys(emotionCounts).map(emotion => ({
          name: emotion.charAt(0).toUpperCase() + emotion.slice(1),
          value: emotionCounts[emotion],
          percentage: (emotionCounts[emotion] / totalEmotions) * 100
        }));
        setEmotionData(pieData);
      }

    });

    return () => {
      unsubscribeScores();
      unsubscribeSessions();
    };
  }, [userLoggedIn, currentUser]);


  if (!userLoggedIn) {
     // ... your login prompt JSX
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 💥 4. APPLY ITEM VARIANT TO THE TITLE */}
      <motion.h2 
        className="text-3xl font-bold mb-6 text-gray-800"
        variants={itemVariants}
        initial="hidden"
        animate="visible"
      >
        Stress Management Dashboard
      </motion.h2>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">Loading your dashboard...</div>
        </div>
      ) : (
        // 💥 5. APPLY CONTAINER VARIANT TO THE MAIN WRAPPER
        <motion.div 
          className="space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          
          {/* --- 1. SUMMARY STATS CARDS --- */}
          {/* 💥 6. APPLY ITEM VARIANT TO THIS SECTION */}
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            variants={itemVariants}
          >
            {/* Total Sessions Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                  <p className="text-2xl font-bold text-gray-900">{summaryStats.totalSessions}</p>
                </div>
              </div>
            </div>
            {/* Average Stress Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Average Stress</p>
                  <p className="text-2xl font-bold text-gray-900">{summaryStats.averageStress}%</p>
                </div>
              </div>
            </div>
            {/* Highest Stress Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                 <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Highest Stress</p>
                  <p className="text-2xl font-bold text-gray-900">{summaryStats.highestStress}%</p>
                </div>
              </div>
            </div>
            {/* Total Readings Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Readings</p>
                  <p className="text-2xl font-bold text-gray-900">{summaryStats.totalReadings}</p>
                </div>
              </div>
            </div>
          </motion.div>
          
          {/* --- 2. NEW VISUALIZATION SECTION --- */}
          {/* 💥 6. APPLY ITEM VARIANT TO THIS SECTION */}
          <motion.div 
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            variants={itemVariants}
          >
            {/* Master Stress Graph (Fused & Smoothed) */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Master Stress Score (Smoothed Trend)
              </h3>
              {fusedData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={fusedData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="time" fontSize={12} />
                    <YAxis domain={[0, 100]} fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="masterStress" stroke="#8884d8" name="Total Stress (Fused)" dot={false} strokeWidth={3} />
                    <Line type="monotone" dataKey="facial" stroke="#82ca9d" name="Facial (Avg)" dot={false} strokeOpacity={0.4} />
                    <Line type="monotone" dataKey="textual" stroke="#ffc658" name="Textual (Last)" dot={false} strokeOpacity={0.4} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-600 text-center py-8">Run a session to see your fused stress score.</p>
              )}
            </div>

            {/* Emotion Distribution Pie Chart */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Emotion Distribution (from Chat)
              </h3>
              {emotionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={emotionData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80} // Fix for label cutoff
                      fill="#8884d8"
                      label={({ name, percentage }) => `${name} (${percentage.toFixed(0)}%)`}
                      labelLine={false} 
                    >
                      {emotionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name.toLowerCase()] || DEFAULT_COLOR} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name, props) => `${props.payload.percentage.toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-600 text-center py-8">Chat with the assistant to see your emotion breakdown.</p>
              )}
            </div>
          </motion.div>

          {/* --- 3. INSIGHTS & TRENDS (RESTORED) --- */}
          {/* 💥 6. APPLY ITEM VARIANT TO THIS SECTION */}
          <motion.div variants={itemVariants}>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Insights & Trends
              </h3>
              {sessions.length === 0 ? (
                <p className="text-gray-600 text-center py-4">Run a session to see your insights.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Trend Indicator */}
                  <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className={`p-3 rounded-full ${ trends.improvement ? "bg-green-100" : trends.trend === "worsening" ? "bg-red-100" : "bg-gray-100" }`}>
                      {trends.improvement ? (
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                      ) : trends.trend === "worsening" ? (
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                      ) : (
                        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {trends.improvement ? "Improving" : trends.trend === "worsening" ? "Needs Attention" : "Stable"}
                      </p>
                      <p className="text-sm text-gray-600">
                        {trends.trendPercentage > 0 && `${trends.trendPercentage.toFixed(1)}% ${ trends.improvement ? "decrease" : "increase" } in recent sessions`}
                        {trends.trendPercentage === 0 && "No significant change detected"}
                      </p>
                    </div>
                  </div>
                  {/* Insights */}
                  <div className="space-y-2">
                    {insights.slice(0, 2).map((insight, index) => (
                      <div key={index} className={`p-3 rounded-lg text-sm ${ insight.type === "positive" ? "bg-green-50 text-green-800" : insight.type === "warning" ? "bg-yellow-50 text-yellow-800" : "bg-blue-50 text-blue-800" }`}>
                        {insight.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* --- 4. RECENT SESSIONS (RESTORED) --- */}
          {/* 💥 6. APPLY ITEM VARIANT TO THIS SECTION */}
          <motion.div variants={itemVariants}>
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Recent Sessions
              </h3>
              {sessions.length === 0 ? (
                <p className="text-gray-600 text-center py-8">
                  No sessions recorded yet. Start your first session to see data here.
                </p>
              ) : (
                <div className="space-y-4">
                  {sessions.slice(0, 5).map((session) => {
                    const stressInfo = getStressLevelInfo(session.averageScore);
                    return (
                      <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${stressInfo.bgColor} ${stressInfo.color}`}>
                            {stressInfo.level}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              Session {session.sessionId?.slice(-8) || session.id.slice(-8)}
                            </p>
                            <p className="text-sm text-gray-600">
                              {getTimeAgo(session.timestamp)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900">
                            {Math.round(session.averageScore || 0)}%
                          </p>
                          <p className="text-sm text-gray-600">
                            {session.scores?.length || 0} readings
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
          
        </motion.div>
      )}
    </div>
  );
}