// FILE: frontend/src/context/GlobalChatContext.jsx
import React, { createContext, useContext, useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import axios from 'axios';

// 1. Create the Context
const GlobalChatContext = createContext();

// 2. EXPORT the Hook (This is what was missing/causing the error)
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

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    // Use the specific session ID if provided (e.g. from SessionPage), otherwise use global
    const currentSessionId = activeSessionId || globalSessionId.current;

    try {
      // 2. API Calls
      const chatPromise = axios.post(`${API_BASE_URL}/api/chat`, {
        prompt: prompt,
        userId: userId,
      });

      const stressPromise = axios.post(`${API_BASE_URL}/api/process_text`, {
        text: prompt,
        userId: userId,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString(),
      });

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
      const errorMessage = {
        sender: 'ai',
        text: "I'm having trouble connecting. Please try again.",
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