// FILE: frontend/src/context/GlobalChatContext.jsx
import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import axios from 'axios';

// 1. Create the Context
const GlobalChatContext = createContext();

// 2. EXPORT the Hook
export function useGlobalChat() {
  return useContext(GlobalChatContext);
}

// 3. EXPORT the Provider
export function GlobalChatProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: "Hello! I'm your AI wellness assistant. How are you feeling today?",
      timestamp: new Date().toISOString()
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [showHelpline, setShowHelpline] = useState(false);

  // Persistent session ID for the global chat context
  const globalSessionId = useRef(uuidv4());

  function openChat() { setOpen(true); }
  function closeChat() { setOpen(false); }
  function toggleChat() { setOpen((prev) => !prev); }

  // Shorten helper
  const shorten = (text, max = 280) => {
    if (!text) return "";
    return text.length > max ? text.substring(0, max) + "..." : text;
  };

  // Send Message Function
  const sendMessage = async (prompt, activeSessionId = null, userId = 'anonymous') => {
    if (isLoading || !prompt.trim()) return;

    // 1. Add User Message
    const userMessage = { sender: 'user', text: prompt, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:5000' : 'https://real-time-stressmonitoring-system-jln9.onrender.com';
    const AXIOS_TIMEOUT_MS = 60000;

    // Use the specific session ID if provided (e.g. from SessionPage), otherwise use global
    const currentSessionId = activeSessionId || globalSessionId.current;

    try {
      // 2. API Calls
      const chatPromise = axios.post(`${API_BASE_URL}/api/chat`, {
        prompt: prompt,
        userId: userId,
      }, { timeout: AXIOS_TIMEOUT_MS });

      const stressPromise = axios.post(`${API_BASE_URL}/api/process_text`, {
        text: prompt,
        userId: userId,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString(),
      }, { timeout: AXIOS_TIMEOUT_MS });

      const [chatResponse, stressResponse] = await Promise.all([
        chatPromise,
        stressPromise,
      ]);

      // 3. Add AI Message
      const aiMessage = {
        sender: 'ai',
        text: shorten(chatResponse.data.response),
        analysis: {
          score: stressResponse.data.stress_score,
          emotions: stressResponse.data.detected_emotions
        },
        timestamp: new Date().toISOString()
      };

      setMessages((prev) => [...prev, aiMessage]);

      // 4. Check Helpline
      if (stressResponse.data.helpline_trigger) {
        setShowHelpline(true);
      }

    } catch (error) {
      console.error("Error sending message:", error);
      let errorText = "I'm having trouble connecting. Please try again.";

      if (error.code === 'ECONNABORTED') {
        errorText = "Request timed out. Please check your connection.";
      } else if (error.response && error.response.data) {
        if (error.response.data.response) errorText = error.response.data.response;
        else if (error.response.data.error) errorText = error.response.data.error;
      }

      const errorMessage = {
        sender: 'ai',
        text: errorText,
        isError: true,
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    open,
    openChat,
    closeChat,
    toggleChat,
    sessionId: globalSessionId.current,
    messages,
    sendMessage,
    isLoading,
    showHelpline,
    setShowHelpline
  };

  return (
    <GlobalChatContext.Provider value={value}>
      {children}
    </GlobalChatContext.Provider>
  );
}