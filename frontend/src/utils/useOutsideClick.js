// frontend/src/utils/useOutsideClick.js
import { useEffect } from "react";

/**
 * useOutsideClick(ref, handler)
 * Trigger handler when clicking outside ref.current
 */
export default function useOutsideClick(ref, handler) {
  useEffect(() => {
    function handleClick(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) handler(e);
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [ref, handler]);
}
