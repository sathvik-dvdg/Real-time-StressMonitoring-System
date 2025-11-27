// frontend/src/components/Dashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/authContext/AuthContext";
import { db } from "../database/firebaseconfig";
import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { motion } from "framer-motion";
import { Play, Activity, AlertCircle, Sparkles } from "lucide-react";

import {
  getStressLevelInfo,
  getTimeAgo,
} from "../utils/dashboardUtils";

// ------------------ EMOTION COLORS ------------------
const EMOTION_COLORS = {
  joy: "#10B981",
  amusement: "#34D399",
  approval: "#60A5FA",
  optimism: "#06B6D4",
  gratitude: "#059669",
  sadness: "#F97316",
  grief: "#EF4444",
  remorse: "#FB923C",
  disappointment: "#F59E0B",
  anger: "#DC2626",
  annoyance: "#F87171",
  fear: "#F97316",
  nervousness: "#FB923C",
  surprise: "#8B5CF6",
  curiosity: "#6366F1",
  disgust: "#9CA3AF",
  confusion: "#6B7280",
  neutral: "#94A3B8",
  relief: "#60A5FA",
  admiration: "#3B82F6",
  caring: "#F472B6",
  desire: "#F472B6",
  pride: "#A78BFA",
  embarrassment: "#FB7185",
  excitement: "#06B6D4",
  love: "#EC4899",
};
const DEFAULT_COLOR = "#D1D5DB";

// ------------------ ANIMATION ------------------
const toJsDate = (ts) => {
  if (!ts) return new Date(0);
  // Safe Firestore Timestamp check
  if (ts && typeof ts.toDate === "function") {
    return ts.toDate();
  }
  // If it's already a Date
  if (ts instanceof Date) return ts;
  // If it's a string or number
  return new Date(ts);
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

// ------------------ COMPONENT ------------------
export default function Dashboard() {
  const { currentUser, userLoggedIn } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [summary, setSummary] = useState({
    totalSessions: 0,
    totalReadings: 0,
  });

  const [fusedData, setFusedData] = useState([]);
  const [emotionPie, setEmotionPie] = useState([]);

  const latestSessionIdRef = useRef(null);

  // Fix hydration
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // -----------------------------------------------------
  // LOAD SUMMARY (totalSessions, totalReadings)
  // -----------------------------------------------------
  useEffect(() => {
    if (!userLoggedIn || !currentUser) return;

    const summaryRef = doc(db, `users/${currentUser.uid}/meta/summary`);

    const unsub = onSnapshot(summaryRef, (snap) => {
      if (snap.exists()) {
        setSummary({
          totalSessions: snap.data().totalSessions || 0,
          totalReadings: snap.data().totalReadings || 0,
        });
      }
    });

    return () => unsub();
  }, [userLoggedIn, currentUser]);

  // -----------------------------------------------------
  // LOAD RECENT SESSIONS
  // -----------------------------------------------------
  useEffect(() => {
    if (!userLoggedIn || !currentUser) return;

    const sessionsRef = collection(db, `users/${currentUser.uid}/sessions`);
    // FIXED: Removed limit(20) to show all sessions
    const q = query(sessionsRef, orderBy("timestamp", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSessions(list);
      latestSessionIdRef.current = list[0]?.id || null;
    });

    return () => unsub();
  }, [userLoggedIn, currentUser]);

  // -----------------------------------------------------
  // CALCULATE PIE CHART FROM LATEST SESSION
  // -----------------------------------------------------
  useEffect(() => {
    if (sessions.length === 0) {
      setEmotionPie([]);
      return;
    }

    const latest = sessions[0];
    // Use dashboard_data if available
    const dataMap = latest.dashboard_data || latest.detected_emotions;

    if (!dataMap) {
      setEmotionPie([]);
      return;
    }

    // Convert to array { name, value }
    const rawData = Object.entries(dataMap).map(([name, value]) => ({
      name,
      value: Number(value)
    }));

    // Sort by value desc
    rawData.sort((a, b) => b.value - a.value);

    // Take top 7
    const top = rawData.slice(0, 7);

    // Normalize to 100% for display
    const total = top.reduce((sum, item) => sum + item.value, 0);
    const finalData = top.map(item => ({
      ...item,
      value: total > 0 ? Number(((item.value / total) * 100).toFixed(1)) : 0
    }));

    setEmotionPie(finalData);

  }, [sessions]);


  // -----------------------------------------------------
  // LOAD REAL-TIME STRESS SCORES (Line Chart)
  // -----------------------------------------------------
  useEffect(() => {
    if (!userLoggedIn || !currentUser) return;

    const scoresRef = collection(db, `users/${currentUser.uid}/stress_scores`);
    const q = query(scoresRef, orderBy("timestamp", "asc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // ---------- Fix sorting ----------
      all.sort((a, b) => {
        const t1 = toJsDate(a.timestamp);
        const t2 = toJsDate(b.timestamp);
        return t1 - t2;
      });

      // ---------- Smooth Trend ----------
      const facial = all.filter((s) => s.type === "facial");
      const smoothed = [];
      const binMs = 25 * 1000; // 25-second smoothing

      if (facial.length > 0) {
        let bucket = [];
        let binStart = toJsDate(facial[0].timestamp).getTime();

        for (const item of facial) {
          const ts = toJsDate(item.timestamp).getTime();

          if (ts - binStart <= binMs) {
            bucket.push(item.score);
          } else {
            if (bucket.length > 0) {
              const avg = Math.round(
                bucket.reduce((a, b) => a + b, 0) / bucket.length
              );
              smoothed.push({
                time: new Date(binStart).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                facial: avg,
                masterStress: avg,
              });
            }
            binStart = ts;
            bucket = [item.score];
          }
        }

        // final flush
        if (bucket.length > 0) {
          const avg = Math.round(
            bucket.reduce((a, b) => a + b, 0) / bucket.length
          );
          smoothed.push({
            time: new Date(binStart).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            facial: avg,
            masterStress: avg,
          });
        }
      }

      setFusedData(smoothed);
    });

    return () => unsub();
  }, [userLoggedIn, currentUser]);

  // -----------------------------------------------------
  // UI
  // -----------------------------------------------------
  return (
    <div className="dashboard-bg min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* TITLE + Start Session */}
        <div className="flex justify-between items-center mb-6">
          <motion.h2
            className="text-3xl font-bold text-gray-800"
            variants={itemVariants}
            initial="hidden"
            animate="visible"
          >
            Stress Dashboard
          </motion.h2>

          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(79, 70, 229, 0.5)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => (window.location.href = "/session")}
            className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold shadow-lg transition-all"
          >
            <Play className="w-5 h-5 mr-2" />
            Start New Session
          </motion.button>
        </div>

        {/* SUMMARY CARDS */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <StatCard label="Total Sessions" value={summary.totalSessions} color="indigo" />
          <StatCard label="Total Readings" value={summary.totalReadings} color="blue" />
          <StatCard
            label="Avg Stress"
            value={
              sessions.length
                ? Math.floor(
                  sessions.reduce((a, b) => a + (b.averageScore || 0), 0) /
                  sessions.length
                ) + "%"
                : "—"
            }
            color="green"
          />
          <StatCard
            label="Highest Stress"
            value={
              sessions.length
                ? Math.max(...sessions.map((s) => s.averageScore || 0)) + "%"
                : "—"
            }
            color="red"
          />
        </motion.div>

        {/* LINE + PIE */}
        <motion.div className="grid grid-cols-1 lg:grid-cols-3 gap-6" variants={itemVariants}>
          {/* LINE CHART */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Stress Trend</h3>

            {mounted && fusedData.length > 0 ? (
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fusedData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line dataKey="masterStress" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 8, stroke: "#4F46E5", strokeWidth: 2, fill: "#fff" }} isAnimationActive={true} animationDuration={1500} />
                    <Line dataKey="facial" stroke="#10B981" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={1500} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-10">No data yet</p>
            )}
          </div>

          {/* PIE CHART */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 7 Emotions</h3>

            {mounted && emotionPie.length > 0 ? (
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={emotionPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      labelLine={false}
                      paddingAngle={4}
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {emotionPie.map((e, i) => (
                        <Cell
                          key={i}
                          fill={EMOTION_COLORS[e.name.toLowerCase()] || DEFAULT_COLOR}
                          className="hover:opacity-80 transition-opacity cursor-pointer"
                        />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-10">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                No emotion data found
              </div>
            )}
          </div>
        </motion.div>

        {/* AI SUMMARY GENERATOR BUTTON */}
        <motion.div className="mt-8 flex justify-center" variants={itemVariants}>
          <button
            onClick={() => (window.location.href = "/wellness")}
            className="flex items-center px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all"
          >
            <Sparkles className="w-6 h-6 mr-3" />
            AI Summary Generator
          </button>
        </motion.div>

        {/* ALL SESSIONS LIST */}
        <motion.div className="bg-white rounded-xl shadow p-6 mt-8" variants={itemVariants}>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">All Sessions History</h3>

          {sessions.length === 0 ? (
            <p className="text-center text-gray-500 py-10">No sessions yet</p>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {sessions.map((s) => {
                const info = getStressLevelInfo(s.averageScore);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${info.bgColor} ${info.color}`}>
                        {info.level}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Session {s.id.slice(-6)}</p>
                        <p className="text-sm text-gray-600">{getTimeAgo(s.timestamp)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">{s.averageScore}%</p>
                      <p className="text-sm text-gray-500">{s.scoresCount || "—"} readings</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ------------------ STAT CARD ------------------
function StatCard({ label, value, color }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
      className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm p-6 flex items-start space-x-4 border border-white/50"
    >
      <div className={`p-3 rounded-xl ${colors[color] || "bg-gray-100"}`}>
        <Activity className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <h4 className="text-2xl font-bold text-gray-900 mt-1">{value}</h4>
      </div>
    </motion.div>
  );
}