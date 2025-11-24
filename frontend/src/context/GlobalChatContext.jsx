// FILE: frontend/src/context/GlobalChatContext.jsx
import React, { createContext, useContext, useState, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

// 1. Create the Context
const GlobalChatContext = createContext();

// 2. EXPORT the Hook (This is what was missing/causing the error)
export function useGlobalChat() {
  return useContext(GlobalChatContext);
}

// 3. EXPORT the Provider
export function GlobalChatProvider({ children }) {
  const [open, setOpen] = useState(false);
  
  // Create a persistent session id (re-used across pages)
  const sessionIdRef = useRef(uuidv4());

  function openChat() {
    setOpen(true);
  }

  function closeChat() {
    setOpen(false);
  }

  function toggleChat() {
    setOpen((prev) => !prev);
  }

  const value = {
    open,
    openChat,
    closeChat,
    toggleChat,
    sessionId: sessionIdRef.current,
  };

  return (
    <GlobalChatContext.Provider value={value}>
      {children}
    </GlobalChatContext.Provider>
  );
}