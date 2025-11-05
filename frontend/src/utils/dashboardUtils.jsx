// Utility functions for dashboard data processing and formatting

export const calculateStressTrends = (sessions) => {
  if (!sessions || sessions.length === 0) {
    return {
      trend: "stable",
      trendPercentage: 0,
      improvement: false,
    };
  }

  const recentSessions = sessions.slice(0, 5);
  const olderSessions = sessions.slice(5, 10);

  if (olderSessions.length === 0) {
    return {
      trend: "stable",
      trendPercentage: 0,
      improvement: false,
    };
  }

  const recentAverage =
    recentSessions.reduce(
      (sum, session) => sum + (session.averageScore || 0),
      0
    ) / recentSessions.length;
  const olderAverage =
    olderSessions.reduce(
      (sum, session) => sum + (session.averageScore || 0),
      0
    ) / olderSessions.length;

  // Handle division by zero if olderAverage is 0
  if (olderAverage === 0) {
    return {
      trend: recentAverage > 0 ? "worsening" : "stable",
      trendPercentage: recentAverage > 0 ? 100 : 0,
      improvement: false,
    };
  }

  const trendPercentage = ((recentAverage - olderAverage) / olderAverage) * 100;
  const improvement = recentAverage < olderAverage;

  let trend = "stable";
  if (Math.abs(trendPercentage) > 5) {
    trend = improvement ? "improving" : "worsening";
  }

  return {
    trend,
    trendPercentage: Math.abs(trendPercentage),
    improvement,
  };
};

export const getStressLevelInfo = (score) => {
  if (score < 20)
    return {
      level: "Very Low",
      color: "text-green-700",
      bgColor: "bg-green-100",
      description: "Excellent stress management",
    };
  if (score < 40)
    return {
      level: "Low",
      color: "text-green-600",
      bgColor: "bg-green-100",
      description: "Good stress levels",
    };
  if (score < 60)
    return {
      level: "Medium",
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
      description: "Moderate stress levels",
    };
  if (score < 80)
    return {
      level: "High",
      color: "text-red-600",
      bgColor: "bg-red-100",
      description: "High stress levels",
    };
  return {
    level: "Very High",
    color: "text-red-700",
    bgColor: "bg-red-200",
    description: "Very high stress levels",
  };
};

export const formatTimestamp = (timestamp) => {
  if (!timestamp) return "N/A";

  try {
    if (timestamp.toDate) {
      return timestamp.toDate();
    }
    return new Date(timestamp);
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return new Date();
  }
};

export const getTimeAgo = (timestamp) => {
  const date = new Date(formatTimestamp(timestamp));
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000)
    return `${Math.floor(diffInSeconds / 86400)} days ago`;

  return date.toLocaleDateString();
};

export const calculateSessionStats = (sessions) => {
  if (!sessions || sessions.length === 0) {
    return {
      totalSessions: 0,
      averageStress: 0,
      bestSession: null,
      worstSession: null,
      totalReadings: 0,
      averageSessionLength: 0,
    };
  }

  const totalSessions = sessions.length;
  const sessionAverages = sessions.map((session) => session.averageScore || 0);
  const averageStress =
    sessionAverages.reduce((sum, score) => sum + score, 0) /
    sessionAverages.length;

  const bestSession = sessions.reduce((best, current) =>
    (current.averageScore || 0) < (best.averageScore || 0) ? current : best
  );

  const worstSession = sessions.reduce((worst, current) =>
    (current.averageScore || 0) > (worst.averageScore || 0) ? current : worst
  );

  const totalReadings = sessions.reduce(
    (sum, session) => sum + (session.scores?.length || 0),
    0
  );

  return {
    totalSessions,
    averageStress: Math.round(averageStress),
    bestSession,
    worstSession,
    totalReadings,
    averageSessionLength:
      totalReadings > 0 ? Math.round(totalReadings / totalSessions) : 0,
  };
};

export const generateInsights = (stats, trends) => {
  const insights = [];

  if (trends.improvement && trends.trendPercentage > 10) {
    insights.push({
      type: "positive",
      message: `Great improvement! Your stress levels have decreased by ${trends.trendPercentage.toFixed(
        1
      )}% in recent sessions.`,
    });
  } else if (!trends.improvement && trends.trendPercentage > 10) {
    insights.push({
      type: "warning",
      message: `Your stress levels have increased by ${trends.trendPercentage.toFixed(
        1
      )}% in recent sessions. Consider stress management techniques.`,
    }); // <-- ✅ FIXED: Removed stray 's'
  }

  if (stats.averageStress < 30) {
    insights.push({
      type: "positive",
      message:
        "Excellent stress management! You're maintaining very healthy stress levels.",
    });
  } else if (stats.averageStress > 70) {
    insights.push({
      type: "warning",
      message:
        "Your average stress levels are quite high. Consider implementing relaxation techniques.",
    });
  } // <-- ✅ FIXED: Removed stray 's'

  if (stats.totalSessions > 10) {
    insights.push({
      type: "info",
      message: `You've completed ${stats.totalSessions} sessions. Consistency is key to effective stress management.`,
    });
  }

  return insights;
};