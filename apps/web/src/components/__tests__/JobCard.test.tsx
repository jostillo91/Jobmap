import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import JobCard from "../JobCard";
import { ToastProvider } from "@/context/ToastContext";

const mockJob = {
  id: "test-job-1",
  title: "Software Engineer",
  company: "Tech Corp",
  lat: 33.4484,
  lon: -112.074,
  url: "https://example.com/job",
  postedAt: "2024-01-01T00:00:00Z",
  source: "ADZUNA",
  street: "123 Main St",
  city: "Phoenix",
  state: "AZ",
  payMin: 50000,
  payMax: 70000,
  employmentType: "FULL_TIME",
};

describe("JobCard", () => {
  const mockOnClick = vi.fn();
  const mockOnSave = vi.fn();

  it("renders job information", () => {
    render(
      <ToastProvider>
        <JobCard job={mockJob} onClick={mockOnClick} onSave={mockOnSave} />
      </ToastProvider>
    );

    expect(screen.getByText("Software Engineer")).toBeInTheDocument();
    expect(screen.getByText("Tech Corp")).toBeInTheDocument();
  });

  it("has proper accessibility attributes", () => {
    render(
      <ToastProvider>
        <JobCard job={mockJob} onClick={mockOnClick} onSave={mockOnSave} />
      </ToastProvider>
    );

    const article = screen.getByRole("article");
    expect(article).toHaveAttribute("aria-label", expect.stringContaining("Software Engineer"));
    expect(article).toHaveAttribute("tabIndex", "0");
  });

  it("calls onClick when clicked", () => {
    render(
      <ToastProvider>
        <JobCard job={mockJob} onClick={mockOnClick} onSave={mockOnSave} />
      </ToastProvider>
    );

    const article = screen.getByRole("article");
    fireEvent.click(article);

    expect(mockOnClick).toHaveBeenCalled();
  });

  it("calls onClick when Enter key is pressed", () => {
    render(
      <ToastProvider>
        <JobCard job={mockJob} onClick={mockOnClick} onSave={mockOnSave} />
      </ToastProvider>
    );

    const article = screen.getByRole("article");
    fireEvent.keyDown(article, { key: "Enter" });

    expect(mockOnClick).toHaveBeenCalled();
  });

  it("calls onClick when Space key is pressed", () => {
    render(
      <ToastProvider>
        <JobCard job={mockJob} onClick={mockOnClick} onSave={mockOnSave} />
      </ToastProvider>
    );

    const article = screen.getByRole("article");
    fireEvent.keyDown(article, { key: " " });

    expect(mockOnClick).toHaveBeenCalled();
  });

  it("calls onSave when save button is clicked", () => {
    render(
      <ToastProvider>
        <JobCard job={mockJob} onClick={mockOnClick} onSave={mockOnSave} />
      </ToastProvider>
    );

    const saveButton = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalled();
  });

  it("shows saved state when isSaved is true", () => {
    render(
      <ToastProvider>
        <JobCard
          job={mockJob}
          onClick={mockOnClick}
          onSave={mockOnSave}
          isSaved={true}
        />
      </ToastProvider>
    );

    const saveButton = screen.getByRole("button", { name: /remove/i });
    expect(saveButton).toBeInTheDocument();
  });

  it("renders location information when available", () => {
    render(
      <ToastProvider>
        <JobCard job={mockJob} onClick={mockOnClick} onSave={mockOnSave} />
      </ToastProvider>
    );

    expect(screen.getByText(/123 Main St/i)).toBeInTheDocument();
  });

  it("renders salary information when available", () => {
    render(
      <ToastProvider>
        <JobCard job={mockJob} onClick={mockOnClick} onSave={mockOnSave} />
      </ToastProvider>
    );

    expect(screen.getByText(/\$50k/i)).toBeInTheDocument();
  });

  it("has accessible links for directions and apply", () => {
    render(
      <ToastProvider>
        <JobCard job={mockJob} onClick={mockOnClick} onSave={mockOnSave} />
      </ToastProvider>
    );

    const directionsLink = screen.getByRole("link", { name: /directions/i });
    const applyLink = screen.getByRole("link", { name: /apply/i });

    expect(directionsLink).toHaveAttribute("href");
    expect(applyLink).toHaveAttribute("href", mockJob.url);
    expect(applyLink).toHaveAttribute("target", "_blank");
    expect(applyLink).toHaveAttribute("rel", "noopener noreferrer");
  });
});


