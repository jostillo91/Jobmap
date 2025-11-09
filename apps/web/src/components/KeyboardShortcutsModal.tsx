"use client";

import { useEffect, useRef } from "react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { key: "/", description: "Focus search input" },
  { key: "Escape", description: "Close modal or blur search" },
  { key: "Enter", description: "Select job or submit search" },
  { key: "Space", description: "Select job (when focused)" },
  { key: "Tab", description: "Navigate between elements" },
  { key: "Shift + Tab", description: "Navigate backwards" },
];

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus close button when modal opens
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 100);

    // Close on Escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 id="shortcuts-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">
            Keyboard Shortcuts
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500 dark:text-gray-400"
            aria-label="Close keyboard shortcuts"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="px-6 py-4">
          <div className="space-y-3">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">{shortcut.description}</span>
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-sm font-mono border border-gray-300 dark:border-gray-600">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


