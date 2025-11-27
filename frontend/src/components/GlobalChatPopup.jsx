import React, { useRef } from "react";
import { useGlobalChat } from "../context/GlobalChatContext.jsx";
import useOutsideClick from "../utils/useOutsideClick.js";
import Chat from "./Chat";
import { motion, AnimatePresence } from "framer-motion";

export default function GlobalChatPopup() {
  const { open, closeChat, sessionId } = useGlobalChat();
  const panelRef = useRef(null);

  useOutsideClick(panelRef, () => {
    if (open) closeChat();
  });

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
          />

          {/* Chat Panel */}
          <motion.aside
            ref={panelRef}
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-4 bottom-24 z-[60] w-full max-w-[400px] h-[600px] max-h-[80vh] shadow-2xl rounded-2xl overflow-hidden pointer-events-auto"
          >
            <div className="h-full w-full">
              <Chat sessionId={sessionId} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
