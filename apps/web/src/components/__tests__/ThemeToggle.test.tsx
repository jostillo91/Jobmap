import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ThemeToggle from "../ThemeToggle";
import { ThemeProvider } from "@/context/ThemeContext";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorageMock.clear();
    document.documentElement.classList.remove("dark");
  });

  it("renders theme toggle button", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole("button", { name: /switch to/i });
    expect(button).toBeInTheDocument();
  });

  it("toggles theme when clicked", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole("button", { name: /switch to/i });
    
    // Initial state should be light (default)
    expect(button).toHaveAttribute("aria-label", expect.stringContaining("dark"));
    
    fireEvent.click(button);
    
    // After click, should switch to dark
    expect(localStorageMock.getItem("theme")).toBe("dark");
  });

  it("has proper accessibility attributes", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label");
    expect(button).toHaveAttribute("aria-pressed");
    expect(button).toHaveAttribute("title");
  });
});


