import React, { useRef } from "react";

// FIXED IMPORT
import { useGlobalChat } from "../context/GlobalChatContext.jsx";

import useOutsideClick from "../utils/useOutsideClick.js";
import Chat from "./Chat";

export default function GlobalChatPopup() {
  const { open, closeChat, sessionId } = useGlobalChat();
  const panelRef = useRef(null);

  useOutsideClick(panelRef, () => {
    if (open) closeChat();
  });

  return (
    <>
      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          open ? "opacity-60 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ background: "rgba(0,0,0,0.45)" }}
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={`
          fixed right-0 top-0 z-[60] h-full w-full max-w-md
          transform transition-transform duration-300 ease-out
          ${open ? "translate-x-0" : "translate-x-full"}
          bg-transparent pointer-events-auto
        `}
      >
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 bg-white/60 backdrop-blur-xl border-b border-white/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-indigo-600 flex items-center justify-center text-white font-bold">
                AI
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  AI Wellness Assistant
                </div>
                <div className="text-xs text-gray-700/70">
                  Here to help — quick tips & guidance
                </div>
              </div>
            </div>

            <button
              onClick={closeChat}
              className="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800"
            >
              Close
            </button>
          </div>

          <div className="flex-1 bg-white p-4 overflow-hidden">
            <div className="h-full">
              <Chat sessionId={sessionId} />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
