// frontend/src/App.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import NavBar from "./components/NavBar";
import { GlobalChatProvider } from "./context/GlobalChatContext";
import FloatingChatButton from "./components/FloatingChatButton";
import GlobalChatPopup from "./components/GlobalChatPopup";

export default function App() {
  return (
    <GlobalChatProvider>
      <div className="min-h-screen overflow-x-hidden">
        <NavBar />
        <main>
          <Outlet />
        </main>

        {/* Chat UI lives across the whole app */}
        <FloatingChatButton />
        <GlobalChatPopup />
      </div>
    </GlobalChatProvider>
  );
}
