"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

interface TooltipProps {
  content: string | ReactNode;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
  className?: string;
}

export default function Tooltip({
  content,
  children,
  position = "top",
  delay = 200,
  className = "",
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ top?: number; bottom?: number; left?: number; right?: number }>({});
  const timeoutRef = useRef<NodeJS.Timeout>();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      updatePosition();
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const updatePosition = () => {
    if (!tooltipRef.current || !triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const spacing = 8;

    switch (position) {
      case "top":
        setTooltipPosition({
          bottom: triggerRect.height + spacing,
          left: triggerRect.width / 2 - tooltipRect.width / 2,
        });
        break;
      case "bottom":
        setTooltipPosition({
          top: triggerRect.height + spacing,
          left: triggerRect.width / 2 - tooltipRect.width / 2,
        });
        break;
      case "left":
        setTooltipPosition({
          right: triggerRect.width + spacing,
          top: triggerRect.height / 2 - tooltipRect.height / 2,
        });
        break;
      case "right":
        setTooltipPosition({
          left: triggerRect.width + spacing,
          top: triggerRect.height / 2 - tooltipRect.height / 2,
        });
        break;
    }
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isVisible]);

  return (
    <div
      ref={triggerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg whitespace-nowrap pointer-events-none ${
            position === "top" ? "bottom-full mb-2" : ""
          } ${position === "bottom" ? "top-full mt-2" : ""}
          ${position === "left" ? "right-full mr-2" : ""}
          ${position === "right" ? "left-full ml-2" : ""}`}
          style={tooltipPosition}
          role="tooltip"
        >
          {typeof content === "string" ? content : content}
          {/* Arrow */}
          <div
            className={`absolute w-2 h-2 bg-gray-900 dark:bg-gray-700 transform rotate-45 ${
              position === "top" ? "top-full -mt-1 left-1/2 -translate-x-1/2" : ""
            } ${position === "bottom" ? "bottom-full -mb-1 left-1/2 -translate-x-1/2" : ""}
            ${position === "left" ? "left-full -ml-1 top-1/2 -translate-y-1/2" : ""}
            ${position === "right" ? "right-full -mr-1 top-1/2 -translate-y-1/2" : ""}`}
          />
        </div>
      )}
    </div>
  );
}


