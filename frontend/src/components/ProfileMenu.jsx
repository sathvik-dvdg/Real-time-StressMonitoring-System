import React from 'react';
import { useAuth } from '../context/authContext/AuthContext';
import { doSignOut } from '../database/auth'; // Assuming you have this function
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, LogIn } from 'lucide-react'; // Optional: icons

const ProfileMenu = () => {
  // 1. Ask your "global manager" who is logged in
  const { userLoggedIn, currentUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await doSignOut();
      navigate('/login'); // Redirect to login after logout
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // 2. Decide what to render
  if (userLoggedIn && currentUser) {
    // --- USER IS LOGGED IN ---
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">
          Hi, {currentUser.displayName || currentUser.email}
        </span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    );
  } else {
    // --- USER IS LOGGED OUT ---
    return (
      <Link
        to="/login"
        className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
      >
        <LogIn size={16} />
        <span>Login</span>
      </Link>
    );
  }
};

export default ProfileMenu;