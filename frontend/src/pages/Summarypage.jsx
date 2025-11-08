import React from "react";
import Dashboard from "../components/Dashboard"; // <-- Make sure this path is correct
import { useAuth } from "../context/authContext/AuthContext";
import { Link } from "react-router-dom";

const Summarypage = () => {
  const { userLoggedIn } = useAuth();

  // If the user is not logged in, show a prompt
  if (!userLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white shadow-lg rounded-lg">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-6">
            Please log in to view your stress management summary.
          </p>
          <Link
            to="/login"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // If the user is logged in, show the dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      <Dashboard />
    </div>
  );
};

export default Summarypage;