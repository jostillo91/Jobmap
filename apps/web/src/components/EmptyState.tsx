"use client";

import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: string | ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export default function EmptyState({
  icon = "🔍",
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="text-6xl mb-4" aria-hidden="true">
        {typeof icon === "string" ? icon : icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}


