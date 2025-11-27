// frontend/src/pages/WellnessPage.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/authContext/AuthContext";
import { db } from "../database/firebaseconfig";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

import RecommendationPanel from "../components/RecommendationPanel";
import ConsultantFinder from "../components/ConsultantFinder";

export default function WellnessPage() {
    const { currentUser, userLoggedIn } = useAuth();
    const navigate = useNavigate();
    const [latestSession, setLatestSession] = useState(null);
    const [emotionPie, setEmotionPie] = useState([]);

    // Load latest session for recommendations
    useEffect(() => {
        if (!userLoggedIn || !currentUser) return;

        const sessionsRef = collection(db, `users/${currentUser.uid}/sessions`);
        const q = query(sessionsRef, orderBy("timestamp", "desc"), limit(1));

        const unsub = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                setLatestSession(data);

                // Process emotion data for summary
                const dataMap = data.dashboard_data || data.detected_emotions;
                if (dataMap) {
                    const rawData = Object.entries(dataMap).map(([name, value]) => ({
                        name,
                        value: Number(value)
                    }));
                    rawData.sort((a, b) => b.value - a.value);
                    const top = rawData.slice(0, 7);
                    const total = top.reduce((sum, item) => sum + item.value, 0);
                    const finalData = top.map(item => ({
                        ...item,
                        value: total > 0 ? Number(((item.value / total) * 100).toFixed(1)) : 0
                    }));
                    setEmotionPie(finalData);
                }
            }
        });

        return () => unsub();
    }, [userLoggedIn, currentUser]);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
    };

    return (
        <div className="wellness-bg min-h-screen p-6 relative">
            {/* Floating Particles */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-10 left-10 w-4 h-4 bg-blue-400 rounded-full opacity-20 animate-bounce"></div>
                <div className="absolute bottom-20 right-20 w-6 h-6 bg-purple-400 rounded-full opacity-20 animate-pulse"></div>
                <div className="absolute top-1/2 left-1/3 w-3 h-3 bg-green-400 rounded-full opacity-20 animate-ping"></div>
            </div>

            <div className="max-w-7xl mx-auto relative z-10">
                <motion.div
                    className="mb-8 flex items-center"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="flex items-center text-gray-600 hover:text-indigo-600 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Back to Dashboard
                    </button>
                </motion.div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-8"
                >
                    <motion.div variants={itemVariants} className="bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/50">
                        <div className="flex items-center space-x-3 mb-2">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Sparkles className="w-6 h-6 text-purple-600 animate-spin-slow" />
                            </div>
                            <h1 className="text-3xl font-bold text-gray-900">AI Wellness Summary</h1>
                        </div>
                        <p className="text-gray-600 ml-14">Personalized recommendations and professional support based on your latest session.</p>
                    </motion.div>

                    {/* AI RECOMMENDATIONS */}
                    <motion.div variants={itemVariants}>
                        <RecommendationPanel
                            stressScore={latestSession?.averageScore}
                            emotionData={latestSession ? (latestSession.dashboard_data || latestSession.detected_emotions) : {}}
                            emotionSummary={emotionPie.slice(0, 3).map(e => `${e.name} (${e.value}%)`).join(", ")}
                            autoRefresh={true}
                        />
                    </motion.div>

                    {/* CONSULTANT FINDER */}
                    <motion.div variants={itemVariants}>
                        <ConsultantFinder />
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
