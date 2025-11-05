//frontend/src/pages/Summarypage.jsx
import React from "react";
import Dashboard from "../components/Dashboard";
import { useAuth } from "../context/authContext/AuthContext";

const Summarypage = () => {
  const { userLoggedIn } = useAuth();

  if (!userLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600">
            Please log in to view your stress management summary.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Dashboard />
    </div>
  );
};

export default Summarypage;