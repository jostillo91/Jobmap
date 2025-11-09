"use client";

import { useEffect, useRef } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  callback: () => void;
  description?: string;
}

/**
 * Hook for handling keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow Escape key to work even in inputs
        if (e.key === "Escape") {
          // Continue to check shortcuts
        } else {
          return;
        }
      }

      for (const shortcut of shortcutsRef.current) {
        const keyMatch = e.key === shortcut.key || e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl === undefined ? true : (e.ctrlKey || e.metaKey) === shortcut.ctrl;
        const shiftMatch = shortcut.shift === undefined ? true : e.shiftKey === shortcut.shift;
        const altMatch = shortcut.alt === undefined ? true : e.altKey === shortcut.alt;
        const metaMatch = shortcut.meta === undefined ? true : e.metaKey === shortcut.meta;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
          e.preventDefault();
          shortcut.callback();
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}




