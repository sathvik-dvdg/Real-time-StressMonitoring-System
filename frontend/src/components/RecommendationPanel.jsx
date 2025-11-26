// frontend/src/components/RecommendationPanel.jsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw, Zap, Heart, Phone, Loader, AlertCircle } from "lucide-react";
import { fetchRecommendations } from "./recommendationService";

export default function RecommendationPanel({ stressScore, emotionData, emotionSummary, autoRefresh = true }) {
    const [recommendations, setRecommendations] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Auto-fetch recommendations when stress/emotion data changes
    useEffect(() => {
        if (autoRefresh && stressScore !== null && stressScore !== undefined) {
            loadRecommendations();
        }
    }, [stressScore, emotionData, autoRefresh]);

    const loadRecommendations = async () => {
        if (stressScore === null || stressScore === undefined) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = await fetchRecommendations(stressScore, emotionData || {});
            setRecommendations(data);
        } catch (err) {
            console.error("Error loading recommendations:", err);
            setError(err.message || "Failed to load recommendations");
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        loadRecommendations();
    };

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-800 flex items-center">
                    <Sparkles className="w-6 h-6 mr-2 text-purple-600" />
                    AI-Powered Wellness Recommendations
                </h3>

                <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="p-2 rounded-lg bg-white shadow hover:shadow-md transition-all disabled:opacity-50"
                    title="Refresh recommendations"
                >
                    <RefreshCw className={`w-5 h-5 text-indigo-600 ${loading ? "animate-spin" : ""}`} />
                </button>
            </div>

            {/* Stress Level Indicator */}
            {stressScore !== null && stressScore !== undefined && (
                <div className="mb-6 p-4 bg-white rounded-lg shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">Current Stress Level</span>
                        <span className={`text-2xl font-bold ${getStressColor(stressScore)}`}>
                            {stressScore}%
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full transition-all duration-500 ${getStressBarColor(stressScore)}`}
                            style={{ width: `${stressScore}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Emotion Summary */}
            {emotionSummary && (
                <div className="mb-6 p-4 bg-white rounded-lg shadow-sm">
                    <p className="text-sm font-medium text-gray-600 mb-2">Detected Emotions:</p>
                    <p className="text-gray-800">
                        Your recent session showed <strong>{emotionSummary}</strong>
                    </p>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start"
                >
                    <AlertCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                </motion.div>
            )}

            {/* Loading State */}
            {loading && !recommendations && (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                    <p className="text-gray-600">Generating personalized recommendations...</p>
                </div>
            )}

            {/* Recommendations Display */}
            <AnimatePresence mode="wait">
                {recommendations && !loading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                    >
                        {/* Immediate Actions */}
                        {recommendations.immediate_actions && recommendations.immediate_actions.length > 0 && (
                            <RecommendationSection
                                title="Immediate Actions"
                                icon={<Zap className="w-5 h-5" />}
                                items={recommendations.immediate_actions}
                                color="indigo"
                            />
                        )}

                        {/* Wellness Activities */}
                        {recommendations.wellness_activities && recommendations.wellness_activities.length > 0 && (
                            <RecommendationSection
                                title="Wellness Activities"
                                icon={<Heart className="w-5 h-5" />}
                                items={recommendations.wellness_activities}
                                color="purple"
                            />
                        )}

                        {/* Professional Support */}
                        {recommendations.professional_support && recommendations.professional_support.length > 0 && (
                            <RecommendationSection
                                title="Professional Support"
                                icon={<Phone className="w-5 h-5" />}
                                items={recommendations.professional_support}
                                color="pink"
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Empty State */}
            {!loading && !recommendations && !error && (
                <div className="text-center py-12 text-gray-500">
                    <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-lg">Start a session to get personalized recommendations</p>
                </div>
            )}
        </div>
    );
}

// Recommendation Section Component
function RecommendationSection({ title, icon, items, color }) {
    const colorClasses = {
        indigo: {
            bg: "bg-indigo-100",
            text: "text-indigo-700",
            border: "border-indigo-200",
            iconBg: "bg-indigo-600",
        },
        purple: {
            bg: "bg-purple-100",
            text: "text-purple-700",
            border: "border-purple-200",
            iconBg: "bg-purple-600",
        },
        pink: {
            bg: "bg-pink-100",
            text: "text-pink-700",
            border: "border-pink-200",
            iconBg: "bg-pink-600",
        },
    };

    const colors = colorClasses[color] || colorClasses.indigo;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`p-5 ${colors.bg} border ${colors.border} rounded-xl`}
        >
            <div className="flex items-center mb-4">
                <div className={`p-2 ${colors.iconBg} rounded-lg text-white mr-3`}>
                    {icon}
                </div>
                <h4 className={`text-lg font-bold ${colors.text}`}>{title}</h4>
            </div>

            <ul className="space-y-3">
                {items.map((item, index) => (
                    <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-start"
                    >
                        <span className={`inline-block w-2 h-2 ${colors.iconBg} rounded-full mt-2 mr-3 flex-shrink-0`} />
                        <span className="text-gray-800 text-sm leading-relaxed">{item}</span>
                    </motion.li>
                ))}
            </ul>
        </motion.div>
    );
}

// Helper functions
function getStressColor(score) {
    if (score < 30) return "text-green-600";
    if (score < 60) return "text-yellow-600";
    return "text-red-600";
}

function getStressBarColor(score) {
    if (score < 30) return "bg-green-500";
    if (score < 60) return "bg-yellow-500";
    return "bg-red-500";
}
