import React, { useState, useEffect } from 'react'; // <-- 1. THE FIX IS HERE
import { useAuth } from '../context/authContext/AuthContext';
import { doCreateUserWithEmailAndPassword, doSignInWithEmailAndPassword, doSignInWithGoogle } from '../database/auth'
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion'; 

const LoginPage = () => {
  const { userLoggedIn} = useAuth(); 

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const navigate = useNavigate(); // Get the navigate function

  // 2. This useEffect will now work correctly
  useEffect(() => {
    if (userLoggedIn) {
      navigate('/summary'); // Redirect to dashboard if logged in
    }
  }, [userLoggedIn, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isSigningIn) return;
    setIsSigningIn(true);
    setErrorMessage('');
    try {
      await doSignInWithEmailAndPassword(email, password);
      navigate('/summary'); // Navigate on success
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
      navigate('/summary'); // Navigate on success
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
      navigate('/summary'); // Navigate on success
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSigningIn(false);
    }
  };
  
  const formContent = isSignUp ? (
     <>
       <div className="flex flex-col items-start pb-8">
         <h1 className="text-3xl font-bold tracking-tighter text-slate-800">Create an account!</h1>
         <p className="text-base text-slate-500">Sign up to get started.</p>
       </div>
       <form className="flex flex-col gap-y-4" onSubmit={handleSignUp}>
         {errorMessage && <p className="text-red-500 text-sm text-center">{errorMessage}</p>}
         <input
           className="form-input w-full rounded-lg border-slate-300 px-4 py-3 text-base placeholder:text-slate-400"
           placeholder="Full Name"
           type="text"
           value={fullName}
           onChange={(e) => setFullName(e.target.value)}
           required
         />
         <input
           className="form-input w-full rounded-lg border-slate-300 px-4 py-3 text-base placeholder:text-slate-400"
           placeholder="E-mail"
           type="email"
           value={email}
           onChange={(e) => setEmail(e.target.value)}
           required
         />
         <input
           className="form-input w-full rounded-lg border-slate-300 px-4 py-3 text-base placeholder:text-slate-400"
           placeholder="Password"
           type="password"
           value={password}
           onChange={(e) => setPassword(e.target.value)}
           required
         />
         <input
           className="form-input w-full rounded-lg border-slate-300 px-4 py-3 text-base placeholder:text-slate-400"
           placeholder="Confirm Password"
           type="password"
           value={confirmPassword}
           onChange={(e) => setConfirmPassword(e.target.value)}
           required
         />
         <button
           type="submit"
           className={`flex h-12 w-full items-center justify-center rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 px-5 text-base font-semibold text-white shadow-lg shadow-blue-500/30 ${isSigningIn ? 'opacity-50 cursor-not-allowed' : ''}`}
           disabled={isSigningIn}
         >
           <span className="truncate">{isSigningIn ? 'Signing Up...' : 'SIGN UP'}</span>
         </button>
       </form>
       <p className="pt-6 text-center text-sm text-slate-600">
         Already have an account?{' '}
         <button className="font-semibold text-purple-500" onClick={() => { setIsSignUp(false); setErrorMessage(''); }}>
           Sign in.
         </button>
       </p>
     </>
   ) : (
     <>
       <div className="flex flex-col items-start pb-8">
         <h1 className="text-3xl font-bold tracking-tighter text-slate-800">Welcome Back!</h1>
         <p className="text-base text-slate-500">Sign in to your account.</p>
       </div>
       <form className="flex flex-col gap-y-4" onSubmit={handleLogin}>
         {errorMessage && <p className="text-red-500 text-sm text-center">{errorMessage}</p>}
         <input
           className="form-input w-full rounded-lg border-slate-300 px-4 py-3 text-base placeholder:text-slate-400"
           placeholder="E-mail"
           type="email"
           value={email}
           onChange={(e) => setEmail(e.target.value)}
           required
         />
         <input
           className="form-input w-full rounded-lg border-slate-300 px-4 py-3 text-base placeholder:text-slate-400"
           placeholder="Password"
           type="password"
           value={password}
           onChange={(e) => setPassword(e.target.value)}
           required
         />
         <div className="flex items-center justify-between text-sm pt-2">
           <label className="flex items-center text-slate-600">
             <input
               className="form-checkbox h-4 w-4 rounded text-purple-600 border-slate-300 focus:ring-purple-500"
               type="checkbox"
             />
             <span className="ml-2">Remember me</span>
           </label>
           <a className="font-semibold text-purple-500 hover:text-purple-600" href="#">
             Forgot password?
           </a>
         </div>
         <button
           type="submit"
           className={`flex h-12 w-full items-center justify-center rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 px-5 text-base font-semibold text-white shadow-lg shadow-blue-500/30 ${isSigningIn ? 'opacity-50 cursor-not-allowed' : ''}`}
           disabled={isSigningIn}
         >
           <span className="truncate">{isSigningIn ? 'Signing In...' : 'SIGN IN'}</span>
         </button>
         <button
           type="button"
           className={`flex h-12 w-full items-center justify-center rounded-lg bg-white px-5 text-base font-semibold text-slate-800 shadow-lg border border-slate-300 ${isSigningIn ? 'opacity-50 cursor-not-allowed' : ''}`}
           onClick={onGoogleSignIn}
           disabled={isSigningIn}
         >
           <img src="https" alt="Google logo" className="h-6 w-6 mr-2" />
           <span className="truncate">SIGN IN WITH GOOGLE</span>
         </button>
       </form>
       <p className="pt-6 text-center text-sm text-slate-600">
         Don't have an account?{' '}
         <button className="font-semibold text-purple-500" onClick={() => { setIsSignUp(true); setErrorMessage(''); }}>
           Create.
         </button>
       </p>
     </>
   );

  const welcomeContent = isSignUp ? (
     <div className="relative h-full w-full">
       <div className="relative flex h-full flex-col items-center justify-center p-6 text-center">
         <h2 className="text-2xl font-bold text-slate-800">Welcome!</h2>
         <ul className="mt-4 list-disc space-y-2 pl-5 text-left text-slate-600">
           <li>Track your stress levels seamlessly.</li>
           <li>Get real-time AI-powered feedback.</li>
           <li>Unlock your wellness insights.</li>
         </ul>
       </div>
     </div>
   ) : (
     <div className="relative h-full w-full">
       <div className="relative flex h-full flex-col items-center justify-center p-6 text-center">
         <h2 className="text-2xl font-bold text-slate-800">Welcome Back!</h2>
         <p className="text-base text-slate-600">
           Sign in to view your dashboard and start a new session.
         </p>
       </div>
     </div>
   );

  return (
    <>
      <div className="relative flex size-full min-h-screen flex-col justify-center bg-gray-50 group/design-root overflow-x-hidden p-6">
        
        <motion.div 
          className="flex w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden"
          
          initial={{ opacity: 0, y: 50 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.6, ease: "easeOut" }} 
        >
          <div className="w-1/2 p-8 flex flex-col justify-center">
            {formContent}
          </div>
          <div className="w-1/2 bg-gradient-to-b from-purple-100 to-blue-100 relative">
            {welcomeContent}
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default LoginPage;