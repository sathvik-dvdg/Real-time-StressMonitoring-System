import React from "react";
import { MessageCircle, X } from "lucide-react";
import { useGlobalChat } from "../context/GlobalChatContext.jsx";
import { motion, AnimatePresence } from "framer-motion";

export default function FloatingChatButton() {
  const { open, toggleChat } = useGlobalChat();

  return (
    <motion.button
      aria-label={open ? "Close chat" : "Open chat"}
      onClick={toggleChat}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className={`
        fixed z-[60] right-6 bottom-6 md:right-10 md:bottom-10
        w-14 h-14 md:w-16 md:h-16 rounded-full shadow-2xl
        flex items-center justify-center ring-0 focus:outline-none
        transform-gpu transition-all duration-300
        ${open
          ? "bg-gray-800 text-white rotate-90"
          : "bg-gradient-to-br from-indigo-600 to-purple-600 text-white"
        }
      `}
    >
      {/* Pulsing Ring when closed */}
      {!open && (
        <span className="absolute inset-0 rounded-full bg-indigo-500 opacity-75 animate-ping"></span>
      )}

      <AnimatePresence mode="wait">
        {open ? (
          <motion.div
            key="close"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
          >
            <X size={24} />
          </motion.div>
        ) : (
          <motion.div
            key="open"
            initial={{ rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -90, opacity: 0 }}
          >
            <MessageCircle size={24} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
