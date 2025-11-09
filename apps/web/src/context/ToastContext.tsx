"use client";

import { createContext, useContext, ReactNode } from "react";
import { useToast as useToastHook, useToastReturn } from "@/hooks/useToast";

const ToastContext = createContext<useToastReturn | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const toast = useToastHook();

  return (
    <ToastContext.Provider value={toast}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToastContext must be used within ToastProvider");
  }
  return context;
}





