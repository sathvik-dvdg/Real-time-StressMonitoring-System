import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/authContext/AuthContext';
import { useGlobalChat } from '../context/GlobalChatContext';
import { Send, Sparkles, Activity, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';

// --- Helper component for the chat bubbles ---
const ChatBubble = ({ message }) => {
  const isUser = message.sender === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-4`}
    >
      <div
        className={`rounded-2xl px-5 py-3 max-w-[85%] text-sm shadow-sm backdrop-blur-sm ${isUser
          ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-br-none'
          : 'bg-white/80 text-gray-800 border border-white/50 rounded-bl-none'
          }`}
      >
        <ReactMarkdown>{message.text}</ReactMarkdown>
      </div>

      {/* Analysis Badge */}
      {message.analysis && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-1 flex flex-wrap gap-2 text-[10px]"
        >
          <span className={`px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${message.analysis.score > 50 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}>
            <Activity size={10} />
            Stress: {message.analysis.score}%
          </span>
          {message.analysis.emotions && message.analysis.emotions.map((e, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
              {e}
            </span>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
};

const suggestions = [
  "I feel stressed right now.",
  "Give me a relaxation tip.",
  "I'm not feeling productive."
];

const Chat = ({ sessionId: propSessionId }) => {
  const { currentUser } = useAuth();
  const { messages, sendMessage, isLoading, showHelpline, setShowHelpline } = useGlobalChat();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    if (input.trim()) {
      const userId = currentUser ? currentUser.uid : 'anonymous';
      sendMessage(input, propSessionId, userId);
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl border border-white/40 relative">

      {/* BACKGROUND EFFECTS */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 animate-pulse-slow"></div>
        <div className="absolute top-10 right-10 w-32 h-32 bg-blue-400/20 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute bottom-10 left-10 w-32 h-32 bg-purple-400/20 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
      </div>

      {/* HEADER */}
      <div className="bg-white/60 backdrop-blur-md p-4 border-b border-white/20 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg text-white shadow-lg shadow-indigo-500/30">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">AI Wellness Assistant</h3>
            <div className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] text-gray-500 font-medium">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <AnimatePresence initial={false}>
          {messages.map((msg, index) => (
            <ChatBubble key={index} message={msg} />
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl rounded-bl-none px-4 py-3 text-sm text-gray-500 shadow-sm border border-white/50 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-100"></span>
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-200"></span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* SUGGESTIONS */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
        {suggestions.map((s, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const userId = currentUser ? currentUser.uid : 'anonymous';
              sendMessage(s, propSessionId, userId);
            }}
            disabled={isLoading}
            className="whitespace-nowrap px-3 py-1.5 bg-white/60 backdrop-blur-sm border border-white/40 text-indigo-600 text-xs font-medium rounded-full hover:bg-white hover:shadow-md transition-all disabled:opacity-50"
          >
            {s}
          </motion.button>
        ))}
      </div>

      {/* INPUT AREA */}
      <div className="p-4 bg-white/60 backdrop-blur-md border-t border-white/20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2 relative"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-white/80 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500/50 rounded-xl text-sm transition-all shadow-inner placeholder-gray-400 outline-none"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </form>
      </div>

      {/* 🚨 HELPLINE MODAL */}
      <AnimatePresence>
        {showHelpline && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center border border-red-100"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Activity className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">You are not alone.</h3>
              <p className="text-gray-600 mb-6 text-sm">
                It sounds like you're going through a difficult time. Please reach out for support.
              </p>

              <div className="space-y-3">
                <a href="tel:988" className="block w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/30">
                  Call 988 (Suicide & Crisis Lifeline)
                </a>
                <a href="tel:112" className="block w-full py-3 bg-gray-100 text-gray-900 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
                  Call 112 (Emergency)
                </a>
              </div>

              <button
                onClick={() => setShowHelpline(false)}
                className="mt-6 text-sm text-gray-400 hover:text-gray-600 underline flex items-center justify-center gap-1 mx-auto"
              >
                <X size={14} />
                I'm okay, close this
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Chat;
