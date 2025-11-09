import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ShareButton from "../ShareButton";
import { ToastProvider } from "@/context/ToastContext";

const mockJob = {
  id: "test-job-1",
  title: "Software Engineer",
  company: "Tech Corp",
  lat: 33.4484,
  lon: -112.074,
  url: "https://example.com/job",
  postedAt: "2024-01-01",
  source: "ADZUNA",
};

// Mock navigator.share
const mockShare = vi.fn();
Object.defineProperty(navigator, "share", {
  writable: true,
  value: mockShare,
});

// Mock navigator.clipboard
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.defineProperty(navigator, "clipboard", {
  writable: true,
  value: mockClipboard,
});

describe("ShareButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShare.mockClear();
    mockClipboard.writeText.mockClear();
  });

  it("renders share button", () => {
    render(
      <ToastProvider>
        <ShareButton job={mockJob} />
      </ToastProvider>
    );

    const button = screen.getByRole("button", { name: /share/i });
    expect(button).toBeInTheDocument();
  });

  it("has proper accessibility attributes", () => {
    render(
      <ToastProvider>
        <ShareButton job={mockJob} />
      </ToastProvider>
    );

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label", expect.stringContaining("Share"));
    expect(button).toHaveAttribute("title", "Share job");
  });

  it("uses Web Share API when available", async () => {
    mockShare.mockResolvedValue(undefined);

    render(
      <ToastProvider>
        <ShareButton job={mockJob} />
      </ToastProvider>
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockShare).toHaveBeenCalledWith({
        title: expect.stringContaining("Software Engineer"),
        text: expect.stringContaining("Tech Corp"),
        url: expect.stringContaining("test-job-1"),
      });
    });
  });

  it("falls back to clipboard when Web Share API fails", async () => {
    mockShare.mockRejectedValue(new Error("Share failed"));

    render(
      <ToastProvider>
        <ShareButton job={mockJob} />
      </ToastProvider>
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalled();
    });
  });
});


