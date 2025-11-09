"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, ReactNode } from "react";
import { ToastProvider } from "@/context/ToastContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { useToast } from "@/hooks/useToast";
import ToastContainer from "@/components/ToastContainer";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <ToastContainerWrapper>{children}</ToastContainerWrapper>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function ToastContainerWrapper({ children }: { children: ReactNode }) {
  const { toasts, removeToast } = useToast();

  return (
    <>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
}
