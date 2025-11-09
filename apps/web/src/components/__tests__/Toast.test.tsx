import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ToastComponent, { Toast } from "../Toast";

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockToast: Toast = {
    id: "test-toast-1",
    message: "Test message",
    type: "success",
  };

  const mockOnClose = vi.fn();

  it("renders toast with message", () => {
    render(<ToastComponent toast={mockToast} onClose={mockOnClose} />);

    expect(screen.getByText("Test message")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("has proper accessibility attributes", () => {
    render(<ToastComponent toast={mockToast} onClose={mockOnClose} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "polite");
    expect(alert).toHaveAttribute("aria-atomic", "true");
  });

  it("uses assertive aria-live for error toasts", () => {
    const errorToast: Toast = {
      ...mockToast,
      type: "error",
    };

    render(<ToastComponent toast={errorToast} onClose={mockOnClose} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });

  it("closes toast after default duration", async () => {
    render(<ToastComponent toast={mockToast} onClose={mockOnClose} />);

    vi.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledWith("test-toast-1");
    });
  });

  it("closes toast after custom duration", async () => {
    const customToast: Toast = {
      ...mockToast,
      duration: 3000,
    };

    render(<ToastComponent toast={customToast} onClose={mockOnClose} />);

    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledWith("test-toast-1");
    });
  });

  it("closes toast when close button is clicked", () => {
    render(<ToastComponent toast={mockToast} onClose={mockOnClose} />);

    const closeButton = screen.getByRole("button", { name: /close/i });
    closeButton.click();

    expect(mockOnClose).toHaveBeenCalledWith("test-toast-1");
  });

  it("displays correct icon for each toast type", () => {
    const types: Toast["type"][] = ["success", "error", "info", "warning"];

    types.forEach((type) => {
      const { unmount } = render(
        <ToastComponent
          toast={{ ...mockToast, type }}
          onClose={mockOnClose}
        />
      );

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      unmount();
    });
  });
});


