//frontend/src/components/dashboard.jsx
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

export default function Dashboard() {
  const { currentUser, userLoggedIn } = useAuth();
  const [scores, setScores] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryStats, setSummaryStats] = useState({
    totalSessions: 0,
    averageStress: 0,
    highestStress: 0,
    lowestStress: 100,
    totalReadings: 0,
    lastSessionDate: null,
  });
  const [trends, setTrends] = useState({
    trend: "stable",
    trendPercentage: 0,
    improvement: false,
  });
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    if (!userLoggedIn || !currentUser) {
      setScores([]);
      setSessions([]);
      setLoading(false);
      return;
    }

    // Fetch individual stress scores
    const scoresRef = collection(db, `users/${currentUser.uid}/stress_scores`);
    const scoresQuery = query(
      scoresRef,
      orderBy("timestamp", "desc"),
      limit(100)
    );

    // Fetch session summaries
    const sessionsRef = collection(db, `users/${currentUser.uid}/sessions`);
    const sessionsQuery = query(
      sessionsRef,
      orderBy("timestamp", "desc"),
      limit(20)
    );

    const unsubscribeScores = onSnapshot(scoresQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setScores(data);
    });

    const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSessions(data);

      // Calculate summary statistics using utility functions
      const stats = calculateSessionStats(data);
      const trendsData = calculateStressTrends(data);
      const insightsData = generateInsights(stats, trendsData);

      if (data.length > 0) {
        const allScores = data.flatMap((session) => session.scores || []);
        const allStressValues = allScores.map((score) => score.score || 0);
        const highestStress =
          allStressValues.length > 0 ? Math.max(...allStressValues) : 0;
        const lowestStress =
          // FIX: Default for lowestStress should be 100 (max) to match initial
          // state logic, not 0.
          allStressValues.length > 0 ? Math.min(...allStressValues) : 100;

        const lastSessionDate = data[0]?.timestamp?.toDate?.() || null;

        setSummaryStats({
          ...stats,
          highestStress: Math.round(highestStress),
          lowestStress: Math.round(lowestStress),
          lastSessionDate,
        });
      }

      setTrends(trendsData);
      setInsights(insightsData);
      setLoading(false);
    });

    return () => {
      unsubscribeScores();
      unsubscribeSessions();
    };
  }, [userLoggedIn, currentUser]);

  const formatDateTime = (timestamp) => {
    const date = formatTimestamp(timestamp);
    return date.toLocaleString();
  };

  if (!userLoggedIn) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Dashboard</h2>
        <p className="text-gray-600">
          Please log in to view your stress dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">
        Stress Management Dashboard
      </h2>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">Loading your dashboard...</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg
                    className="w-6 h-6 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    Total Sessions
                  </p>
               <p className="text-2xl font-bold text-gray-900">
                    {summaryStats.totalSessions}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg
                    className="w-6 h-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    Average Stress
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {summaryStats.averageStress}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <svg
                    className="w-6 h-6 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    Highest Stress
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {summaryStats.highestStress}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg
                    className="w-6 h-6 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    Total Readings
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {summaryStats.totalReadings}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Insights and Trends */}
          {insights.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Insights & Trends
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Trend Indicator */}
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div
                    className={`p-3 rounded-full ${
                      trends.improvement
                        ? "bg-green-100"
                        : trends.trend === "worsening"
                        ? "bg-red-100"
                        : "bg-gray-100"
                    }`}
                  >
                    {trends.improvement ? (
                      <svg
                        className="w-6 h-6 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                    ) : trends.trend === "worsening" ? (
                      <svg
                        className="w-6 h-6 text-red-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-6 h-6 text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                           strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20 12H4"
                        />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {trends.improvement
                        ? "Improving"
                        : trends.trend === "worsening"
                        ? "Needs Attention"
                        : "Stable"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {trends.trendPercentage > 0 &&
                        `${trends.trendPercentage.toFixed(1)}% ${
                          trends.improvement ? "decrease" : "increase"
                        } in recent sessions`}
                         {trends.trendPercentage === 0 &&
                        "No significant change detected"}
                    </p>
                  </div>
                </div>

                {/* Insights */}
                <div className="space-y-2">
                  {insights.slice(0, 2).map((insight, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg text-sm ${
                        insight.type === "positive"
                           ? "bg-green-50 text-green-800"
                          : insight.type === "warning"
                          ? "bg-yellow-50 text-yellow-800"
                          : "bg-blue-50 text-blue-800"
                      }`}
                    >
                      {insight.message}
                   </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recent Sessions */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">
              Recent Sessions
            </h3>
            {sessions.length === 0 ? (
              <p className="text-gray-600 text-center py-8">
                No sessions recorded yet. Start your first session to see data
                here.
              </p>
           ) : (
              <div className="space-y-4">
                {sessions.slice(0, 5).map((session) => {
                  const stressInfo = getStressLevelInfo(session.averageScore);
                  return (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <div
                          // FIX: Added backticks (`) to create a template
                          // literal for the className.
                          className={`px-3 py-1 rounded-full text-sm font-medium ${stressInfo.bgColor} ${stressInfo.color}`}
                        >
                          {stressInfo.level}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                           Session{" "}
                            {session.sessionId?.slice(-8) ||
                              session.id.slice(-8)}
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

          {/* Recent Individual Scores Chart */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">
             Recent Stress Readings
            </h3>
            {scores.length === 0 ? (
              <p className="text-gray-600 text-center py-8">
                No individual readings available.
        	     </p>
            ) : (
              <div className="h-64 bg-gray-50 rounded-lg p-4 overflow-x-auto">
                <div className="flex items-end justify-between h-full gap-1">
              	   {scores.slice(0, 50).map((item, index) => (
                    <div
                      key={item.id}
                      className="flex flex-col items-center group"
                    >
                      <div
                        className="w-3 bg-indigo-500 rounded-t transition-all duration-300 hover:bg-indigo-600 cursor-pointer relative"
                        style={{
        	                 height: `${
                              Math.min(100, Math.max(5, item.score || 0)) * 2
                          }px`,
                        }}
        	               title={`Score: ${Math.round(
                         item.score || 0
                        )}% - ${formatDateTime(item.timestamp)}`}
                      ></div>
                      {index % 5 === 0 && (
                       <span className="text-[10px] text-gray-500 mt-1 transform -rotate-45 origin-top-left">
                          {Math.round(item.score || 0)}
                        </span>
              	     )}
                 </div>
                  ))}
                </div>
  	         </div>
            )}
    	   </div>
         {/* Latest Reading */}
          {scores.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
                 <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Latest Reading
              </h3>
              <div className="flex items-center justify-between">
              	 <div className="flex items-center space-x-4">
                  <div className="text-5xl font-bold text-indigo-600">
                    {Math.round(scores[0].score || 0)}%
      	         </div>
                  <div>
                   <p className="text-gray-600">
                        {formatDateTime(scores[0].timestamp)}
    	             </p>
                    <div
                      className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-medium ${
                        getStressLevelInfo(scores[0].score).bgColor
                      } ${getStressLevelInfo(scores[0].score).color}`}
  	             >
                      {getStressLevelInfo(scores[0].score).level} Stress Level
                   </div>
        	       </div>
                </div>
      	         <div className="text-right text-sm text-gray-600">
                  <p>Face Detected: {scores[0].face_detected ? "Yes" : "No"}</p>
               </div>
              </div>
  	       </div>
          )}
  	   </div>
      )}
  	 </div>
  );
}