import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/authContext/AuthContext';
import {
  doCreateUserWithEmailAndPassword,
  doSignInWithEmailAndPassword,
  doSignInWithGoogle
} from '../database/auth';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Smile, ArrowRight } from 'lucide-react';

const LoginPage = () => {
  const { userLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Motivational quotes that change on refresh (or toggle)
  const quotes = [
    "Peace comes from within. Do not seek it without.",
    "Every moment is a fresh beginning.",
    "Breath is the bridge which connects life to consciousness.",
    "Calmness is the cradle of power."
  ];
  const [quote, setQuote] = useState(quotes[0]);

  useEffect(() => {
    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, [isSignUp]);

  useEffect(() => {
    if (userLoggedIn) {
      navigate('/');
    }
  }, [userLoggedIn, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isSigningIn) return;
    setIsSigningIn(true);
    setErrorMessage('');
    try {
      await doSignInWithEmailAndPassword(email, password);
      navigate('/');
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    if (isSigningIn) return;
    setIsSigningIn(true);
    setErrorMessage('');
    try {
      await doCreateUserWithEmailAndPassword(email, password);
      navigate('/');
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const onGoogleSignIn = async (e) => {
    e.preventDefault();
    if (isSigningIn) return;
    setIsSigningIn(true);
    setErrorMessage('');
    try {
      await doSignInWithGoogle();
      navigate('/');
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSigningIn(false);
    }
  };

  // Animation Variants
  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3 } }
  };

  return (
    <div className="login-bg min-h-screen flex items-center justify-center p-6">
      <AnimatePresence mode='wait'>
        <motion.div
          key={isSignUp ? "signup" : "login"}
          className="glass-card w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row relative z-10"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* LEFT PANEL: FORM */}
          <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white/40 backdrop-blur-sm">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
                {isSignUp ? "Create Account" : "Welcome Back"}
              </h1>
              <p className="text-slate-600 mt-2">
                {isSignUp ? "Join us to start your wellness journey." : "Sign in to continue your progress."}
              </p>
            </div>

            <form className="flex flex-col gap-5" onSubmit={isSignUp ? handleSignUp : handleLogin}>
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-red-100 text-red-600 text-sm rounded-lg text-center"
                >
                  {errorMessage}
                </motion.div>
              )}

              {isSignUp && (
                <div className="relative">
                  <input
                    className="w-full rounded-xl border-none bg-white/60 px-4 py-3 text-base shadow-sm focus:ring-2 focus:ring-purple-400 outline-none transition-all placeholder:text-slate-400"
                    placeholder="Full Name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              )}

              <input
                className="w-full rounded-xl border-none bg-white/60 px-4 py-3 text-base shadow-sm focus:ring-2 focus:ring-purple-400 outline-none transition-all placeholder:text-slate-400"
                placeholder="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <input
                className="w-full rounded-xl border-none bg-white/60 px-4 py-3 text-base shadow-sm focus:ring-2 focus:ring-purple-400 outline-none transition-all placeholder:text-slate-400"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {isSignUp && (
                <input
                  className="w-full rounded-xl border-none bg-white/60 px-4 py-3 text-base shadow-sm focus:ring-2 focus:ring-purple-400 outline-none transition-all placeholder:text-slate-400"
                  placeholder="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              )}

              {!isSignUp && (
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center text-slate-600 cursor-pointer">
                    <input className="form-checkbox h-4 w-4 text-purple-600 rounded border-slate-300 focus:ring-purple-400" type="checkbox" />
                    <span className="ml-2">Remember me</span>
                  </label>
                  <a className="font-medium text-purple-600 hover:text-purple-700 transition-colors" href="#">
                    Forgot password?
                  </a>
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.02, boxShadow: "0 10px 25px -5px rgba(124, 58, 237, 0.4)" }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className={`mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold tracking-wide shadow-lg transition-all ${isSigningIn ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                disabled={isSigningIn}
              >
                {isSigningIn ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {isSignUp ? 'SIGN UP' : 'SIGN IN'} <ArrowRight className="w-5 h-5" />
                  </span>
                )}
              </motion.button>

              {!isSignUp && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold shadow-sm hover:bg-slate-50 transition-all"
                  onClick={onGoogleSignIn}
                  disabled={isSigningIn}
                >
                  <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5 mr-3" alt="Google" />
                  Sign in with Google
                </motion.button>
              )}
            </form>

            <div className="mt-8 text-center">
              <p className="text-slate-600">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{' '}
                <button
                  className="font-bold text-purple-600 hover:text-purple-700 transition-colors"
                  onClick={() => { setIsSignUp(!isSignUp); setErrorMessage(''); }}
                >
                  {isSignUp ? "Sign In" : "Create Account"}
                </button>
              </p>
            </div>
          </div>

          {/* RIGHT PANEL: WELCOME / DECORATIVE */}
          <div className="hidden md:flex w-1/2 bg-gradient-to-br from-purple-600 to-indigo-600 p-12 flex-col justify-between text-white relative overflow-hidden">
            {/* Abstract Shapes */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-400/20 rounded-full blur-3xl -ml-16 -mb-16"></div>

            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                <Sparkles className="w-6 h-6 text-yellow-300" />
              </div>
              <h2 className="text-4xl font-bold leading-tight mb-4">
                {isSignUp ? "Begin Your Journey" : "Welcome Back"}
              </h2>
              <p className="text-indigo-100 text-lg">
                Experience real-time stress monitoring and AI-powered wellness insights.
              </p>
            </div>

            <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
              <Smile className="w-8 h-8 text-yellow-300 mb-4" />
              <p className="text-lg font-medium italic">"{quote}"</p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default LoginPage;
