import React from "react";
import { MessageCircle } from "lucide-react";

// FIXED IMPORT
import { useGlobalChat } from "../context/GlobalChatContext.jsx";

export default function FloatingChatButton() {
  const { open, toggleChat } = useGlobalChat();

  return (
    <button
      aria-label="Open chat"
      onClick={toggleChat}
      className="
        fixed z-[60] right-6 bottom-6 md:right-10 md:bottom-10
        w-14 h-14 md:w-16 md:h-16 rounded-full shadow-2xl
        bg-gradient-to-br from-indigo-600 to-indigo-500 text-white
        flex items-center justify-center ring-0 focus:outline-none
        active:scale-95 transform-gpu transition
      "
      title={open ? "Close chat" : "Open chat"}
    >
      <MessageCircle size={22} />
    </button>
  );
}
