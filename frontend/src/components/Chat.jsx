import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/authContext/AuthContext';
import { Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// --- Shortening Function ---
const shorten = (text, max = 280) => {
  if (!text) return "";
  return text.length > max ? text.substring(0, max) + "..." : text;
};

// --- Helper component for the chat bubbles ---
const ChatBubble = ({ message }) => {
  const isUser = message.sender === 'user';
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-4`}>
      <div
        className={`rounded-lg px-4 py-3 max-w-xs text-sm prose ${isUser
          ? 'bg-indigo-600 text-white prose-invert'
          : 'bg-gray-200 text-gray-900'
          }`}
      >
        <ReactMarkdown>{message.text}</ReactMarkdown>
      </div>

      {/* Analysis Badge */}
      {message.analysis && (
        <div className="mt-1 flex flex-wrap gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded-full font-semibold ${message.analysis.score > 50 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}>
            Stress: {message.analysis.score}%
          </span>
          {message.analysis.emotions && message.analysis.emotions.map((e, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
              {e}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const suggestions = [
  "I feel stressed right now.",
  "Give me a relaxation tip.",
  "I'm not feeling productive."
];

const Chat = ({ sessionId }) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: "Hello! You can ask me for hints or just tell me how you're feeling.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHelpline, setShowHelpline] = useState(false); // Added showHelpline state
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (prompt) => {
    if (isLoading) return;

    const userId = currentUser ? currentUser.uid : 'anonymous';
    const userMessage = { sender: 'user', text: prompt };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    try {
      const chatPromise = axios.post(`${API_BASE_URL}/api/chat`, {
        prompt: prompt,
        userId: userId,
      });

      const stressPromise = axios.post(`${API_BASE_URL}/api/process_text`, {
        text: prompt,
        userId: userId,
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
      });

      const [chatResponse, stressResponse] = await Promise.all([
        chatPromise,
        stressPromise,
      ]);

      // ✨ APPLY SHORTENING HERE
      const aiMessage = {
        sender: 'ai',
        text: shorten(chatResponse.data.response),
        analysis: {
          score: stressResponse.data.stress_score,
          emotions: stressResponse.data.detected_emotions
        }
      };

      setMessages((prev) => [...prev, aiMessage]);

      // 🚨 HELPLINE TRIGGER CHECK
      if (stressResponse.data.helpline_trigger) {
        setShowHelpline(true);
      }

    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = {
        sender: 'ai',
        text: "Sorry, I'm having trouble connecting right now. Please try again."
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-xl overflow-hidden shadow-sm border border-gray-100 relative">
      {/* HEADER */}
      <div className="bg-white p-4 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">AI Wellness Assistant</h3>
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-xs text-gray-500">Online</span>
        </div>
      </div>

      {/* MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <ChatBubble key={index} message={msg} />
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 rounded-lg px-4 py-3 text-sm text-gray-500 animate-pulse">
              Typing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* SUGGESTIONS */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => sendMessage(s)}
            disabled={isLoading}
            className="whitespace-nowrap px-3 py-1 bg-indigo-50 text-indigo-600 text-xs rounded-full hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {/* INPUT AREA */}
      <div className="p-4 bg-white border-t border-gray-100">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) sendMessage(input);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-gray-100 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded-xl text-sm transition-all"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* 🚨 HELPLINE MODAL */}
      {showHelpline && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">You are not alone.</h3>
            <p className="text-gray-600 mb-6">
              It sounds like you're going through a difficult time. Please reach out for support.
            </p>

            <div className="space-y-3">
              <a href="tel:988" className="block w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg">
                Call 988 (Suicide & Crisis Lifeline)
              </a>
              <a href="tel:112" className="block w-full py-3 bg-gray-100 text-gray-900 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
                Call 112 (Emergency)
              </a>
            </div>

            <button
              onClick={() => setShowHelpline(false)}
              className="mt-6 text-sm text-gray-400 hover:text-gray-600 underline"
            >
              I'm okay, close this
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
