"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

import { searchJobs } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useMapStore } from "@/store/mapStore";
import { useSavedJobs } from "@/hooks/useSavedJobs";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useToastContext } from "@/context/ToastContext";

import JobCard from "@/components/JobCard";
import JobCardSkeleton from "@/components/JobCardSkeleton";
import SearchInput from "@/components/SearchInput";
import ThemeToggle from "@/components/ThemeToggle";
import EmptyState from "@/components/EmptyState";
import Tooltip from "@/components/Tooltip";
import KeyboardShortcutsModal from "@/components/KeyboardShortcutsModal";

// Lazy load heavy components for better code splitting
const JobMap = dynamic(() => import("@/components/Map").then(mod => ({ default: mod.default })), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-100 dark:bg-gray-800 animate-pulse" />,
});

const JobDetailModal = dynamic(() => import("@/components/JobDetailModal"), {
  ssr: false,
});

const JobBottomSheet = dynamic(() => import("@/components/JobBottomSheet"), {
  ssr: false,
});

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function Home() {
  const { bounds, filters, selectedJobId, showSearchButton, setSelectedJobId, setShowSearchButton } =
    useMapStore();
  const [shouldSearch, setShouldSearch] = useState(true);
  const toast = useToastContext();
  const urlSearchParams = useSearchParams();
  const keywordInputRef = useRef<HTMLInputElement>(null);
  const companyInputRef = useRef<HTMLInputElement>(null);

  // Show success toast if redirected from job posting
  useEffect(() => {
    const success = urlSearchParams.get("success");
    if (success) {
      toast.success(success);
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [urlSearchParams, toast]);

  // Debounce bounds changes to prevent excessive API calls
  const debouncedBounds = useDebounce(bounds, 500); // 500ms debounce

  // Build search params
  const searchParams = useMemo(() => {
    if (!debouncedBounds) return null;
    return {
      bbox: `${debouncedBounds.minLon},${debouncedBounds.minLat},${debouncedBounds.maxLon},${debouncedBounds.maxLat}`,
      q: filters.keyword || undefined,
      company: filters.company || undefined,
      minPay: filters.minPay || undefined,
      maxAgeDays: filters.maxAgeDays || undefined,
      types: filters.employmentTypes.length > 0 ? filters.employmentTypes.join(",") : undefined,
      limit: 500, // Cap at 500 for performance
    };
  }, [debouncedBounds, filters]);

  // Fetch jobs
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["jobs", searchParams],
    queryFn: () => searchJobs(searchParams!),
    enabled: !!searchParams && shouldSearch,
    staleTime: 30000, // Consider data fresh for 30 seconds
    retry: 2, // Retry failed requests twice
  });

  const handleSearchClick = useCallback(() => {
    setShouldSearch(true);
    refetch();
    setShowSearchButton(false);
  }, [refetch, setShowSearchButton]);

  const [showJobModal, setShowJobModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const jobsPerPage = 20;
  const { isSaved, toggleSave, savedJobIds } = useSavedJobs();

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleJobClick = (jobId: string) => {
    setSelectedJobId(jobId === selectedJobId ? null : jobId);
    if (jobId !== selectedJobId) {
      setShowJobModal(true);
      setCurrentPage(1); // Reset to first page when selecting a job
    } else {
      setShowJobModal(false);
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, debouncedBounds]);

  const handleCloseModal = () => {
    setShowJobModal(false);
    setSelectedJobId(null);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "/",
      callback: () => {
        keywordInputRef.current?.focus();
      },
      description: "Focus search",
    },
    {
      key: "Escape",
      callback: () => {
        if (showJobModal) {
          handleCloseModal();
        } else if (showShortcutsModal) {
          setShowShortcutsModal(false);
        } else {
          keywordInputRef.current?.blur();
          companyInputRef.current?.blur();
        }
      },
      description: "Close modal or blur search",
    },
    {
      key: "?",
      callback: () => {
        setShowShortcutsModal(true);
      },
      description: "Show keyboard shortcuts",
    },
  ]);

  // Export jobs to CSV
  const handleExportCSV = useCallback(() => {
    if (!data?.jobs || data.jobs.length === 0) {
      toast.error("No jobs to export");
      return;
    }

    const headers = [
      "Title",
      "Company",
      "Location",
      "Street Address",
      "City",
      "State",
      "Salary Min",
      "Salary Max",
      "Employment Type",
      "Posted Date",
      "URL",
    ];

    const rows = data.jobs.map((job) => {
      const location = [job.street, job.city, job.state]
        .filter(Boolean)
        .join(", ");
      return [
        job.title,
        job.company,
        location || `${job.lat}, ${job.lon}`,
        job.street || "",
        job.city || "",
        job.state || "",
        job.payMin?.toString() || "",
        job.payMax?.toString() || "",
        job.employmentType || "",
        new Date(job.postedAt).toLocaleDateString(),
        job.url,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `jobs-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${data.count} jobs to CSV`);
  }, [data, toast]);

  return (
    <div id="main-content" className="flex flex-col md:flex-row h-screen dark:bg-gray-900 overflow-hidden">
      {/* Mobile: Map on top, Desktop: Left panel */}
      <div className="w-full md:w-96 bg-gray-50 dark:bg-gray-800 flex flex-col border-r border-gray-200 dark:border-gray-700 order-2 md:order-1">
        {/* Header */}
        <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <header className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">JobMap</h1>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setShowShortcutsModal(true)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                title="Keyboard shortcuts (Press ?)"
                aria-label="Show keyboard shortcuts"
              >
                ⌨️
              </button>
              <ThemeToggle />
              <a
                href="/saved"
                className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-3 py-1.5 rounded-md hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors flex items-center gap-1 min-h-[40px] whitespace-nowrap"
                title="View saved jobs"
              >
                ⭐ Saved ({savedJobIds.length})
              </a>
              <a
                href="/post"
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded-md hover:bg-primary-700 transition-colors min-h-[40px] flex items-center whitespace-nowrap"
              >
                Post a Job
              </a>
            </div>
          </header>

          {/* Filters */}
          <section aria-label="Search filters" className="space-y-3">
            {/* Filter Header with Reset */}
            {(filters.keyword || filters.company || filters.minPay || filters.maxAgeDays || filters.employmentTypes.length > 0) && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Active filters</span>
                <button
                  onClick={() => {
                    useMapStore.getState().resetFilters();
                    refetch();
                  }}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                  aria-label="Clear all filters"
                >
                  Clear all
                </button>
              </div>
            )}
            {/* Keyword Search */}
            <div>
              <SearchInput
                ref={keywordInputRef}
                value={filters.keyword || ""}
                onChange={(value) =>
                  useMapStore.getState().setFilters({ keyword: value })
                }
                placeholder="Search jobs... (Press / to focus)"
                type="title"
              />
            </div>

            {/* Company Filter */}
            <div>
              <SearchInput
                ref={companyInputRef}
                value={filters.company || ""}
                onChange={(value) =>
                  useMapStore.getState().setFilters({ company: value })
                }
                placeholder="Company name..."
                type="company"
              />
            </div>

            {/* Pay Slider */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label htmlFor="min-pay-slider" className="block text-sm text-gray-700 dark:text-gray-300">
                  Min Pay: {filters.minPay ? `$${filters.minPay.toLocaleString()}` : "Any"}
                </label>
                <Tooltip content="Filter jobs by minimum annual salary. Drag the slider to set your desired minimum pay.">
                  <span className="text-gray-400 dark:text-gray-500 cursor-help" aria-label="Help">ℹ️</span>
                </Tooltip>
              </div>
              <input
                id="min-pay-slider"
                type="range"
                min="0"
                max="200000"
                step="10000"
                value={filters.minPay || 0}
                onChange={(e) =>
                  useMapStore.getState().setFilters({
                    minPay: parseInt(e.target.value) || null,
                  })
                }
                aria-label="Minimum salary filter"
                aria-valuemin={0}
                aria-valuemax={200000}
                aria-valuenow={filters.minPay || 0}
                aria-valuetext={filters.minPay ? `$${filters.minPay.toLocaleString()}` : "Any"}
                className="w-full"
              />
            </div>

            {/* Employment Type Checkboxes - Multi-select */}
            <fieldset>
              <div className="flex items-center gap-2 mb-2">
                <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300">Employment Type</legend>
                <Tooltip content="Select one or more employment types to filter jobs. You can select multiple types at once.">
                  <span className="text-gray-400 dark:text-gray-500 cursor-help" aria-label="Help">ℹ️</span>
                </Tooltip>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Employment type filters">
                {["FULL_TIME", "PART_TIME", "CONTRACT", "TEMP", "INTERN"].map((type) => (
                  <label key={type} className="flex items-center text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.employmentTypes.includes(type)}
                      onChange={(e) => {
                        const currentTypes = filters.employmentTypes;
                        const newTypes = e.target.checked
                          ? [...currentTypes, type]
                          : currentTypes.filter((t) => t !== type);
                        useMapStore.getState().setFilters({
                          employmentTypes: newTypes,
                          employmentType: newTypes.length === 1 ? newTypes[0] : null, // Keep backward compat
                        });
                      }}
                      aria-label={`Filter by ${type.replace(/_/g, " ")} employment type`}
                      className="mr-1"
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300">{type.replace(/_/g, " ")}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Max Age Days */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label htmlFor="max-age-select" className="block text-sm text-gray-700 dark:text-gray-300">
                  Posted Date
                </label>
                <Tooltip content="Filter jobs by how recently they were posted. Only show jobs posted within the selected time period.">
                  <span className="text-gray-400 dark:text-gray-500 cursor-help" aria-label="Help">ℹ️</span>
                </Tooltip>
              </div>
              <select
                id="max-age-select"
                value={filters.maxAgeDays || ""}
                onChange={(e) =>
                  useMapStore.getState().setFilters({
                    maxAgeDays: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                aria-label="Filter jobs by posting date"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
              <option value="">Any time</option>
              <option value="7">Last week</option>
              <option value="30">Last month</option>
              <option value="90">Last 3 months</option>
            </select>
            </div>
          </section>
        </div>

        {/* Results List with Pagination */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col" role="region" aria-label="Job search results">
          {/* Results Count and Export */}
          {data && data.count > 0 && (
            <div className="mb-4 flex justify-between items-center flex-wrap gap-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">{data.count.toLocaleString()}</span>{" "}
                {data.count === 1 ? "job" : "jobs"} found
                {filters.keyword && (
                  <span className="ml-2">
                    for "<span className="font-medium">{filters.keyword}</span>"
                  </span>
                )}
                {data.count > jobsPerPage && (
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-500">
                    (Showing page {currentPage} of {Math.ceil(data.count / jobsPerPage)})
                  </span>
                )}
              </div>
              <button
                onClick={handleExportCSV}
                aria-label={`Export ${data.count} jobs to CSV file`}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2"
                title="Export jobs to CSV"
              >
                <span aria-hidden="true">📥</span> Export CSV
              </button>
            </div>
          )}
          {isLoading ? (
            <div className="space-y-3" role="status" aria-live="polite" aria-label="Loading jobs">
              <div className="sr-only">Loading jobs, please wait...</div>
              <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                Searching for jobs...
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <JobCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            (() => {
              const errorInfo = getErrorMessage(error);
              return (
                <div className="text-center py-8 px-4">
                  <div className="inline-block bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md mx-auto">
                    <div className="text-4xl mb-3">{errorInfo.icon || "⚠️"}</div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {errorInfo.title || "Failed to Load Jobs"}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{errorInfo.message}</p>
                    {errorInfo.suggestions && errorInfo.suggestions.length > 0 && (
                      <div className="mb-4 text-left">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Suggestions:</p>
                        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                          {errorInfo.suggestions.map((suggestion, idx) => (
                            <li key={idx}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      onClick={() => refetch()}
                      className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                    >
                      {errorInfo.action || "Try Again"}
                    </button>
                  </div>
                </div>
              );
            })()
          ) : data?.jobs.length ? (
            <>
              <div className="space-y-3 flex-1">
                {data.jobs
                  .slice((currentPage - 1) * jobsPerPage, currentPage * jobsPerPage)
                  .map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      isSelected={job.id === selectedJobId}
                      isSaved={isSaved(job.id)}
                      onSave={() => toggleSave(job.id)}
                      onClick={() => handleJobClick(job.id)}
                    />
                  ))}
              </div>
              {/* Pagination */}
              {data.jobs.length > jobsPerPage && (
                <nav aria-label="Job results pagination" className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      aria-label={`Go to previous page, page ${currentPage - 1}`}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400" aria-current="page">
                      Page {currentPage} of {Math.ceil(data.count / jobsPerPage)}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(Math.ceil(data.count / jobsPerPage), p + 1))}
                      disabled={currentPage >= Math.ceil(data.count / jobsPerPage)}
                      aria-label={`Go to next page, page ${currentPage + 1}`}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </nav>
              )}
            </>
          ) : (
            <EmptyState
              icon="📍"
              title="No jobs found"
              description={
                filters.keyword || filters.company || filters.minPay || filters.employmentTypes.length > 0
                  ? "No jobs match your current filters. Try adjusting your search criteria or clearing filters to see more results."
                  : "No jobs found in this area. Try zooming out on the map, panning to a different location, or adjusting your search filters."
              }
              action={
                filters.keyword || filters.company || filters.minPay || filters.employmentTypes.length > 0
                  ? {
                      label: "Clear Filters",
                      onClick: () => {
                        useMapStore.getState().resetFilters();
                        refetch();
                      },
                    }
                  : undefined
              }
            />
          )}
        </div>
      </div>

      {/* Mobile: Map on top, Desktop: Right panel */}
      <div className="flex-1 relative order-1 md:order-2 min-h-0 min-w-0">
        <JobMap jobs={data?.jobs || []} onJobClick={(job) => handleJobClick(job.id)} />

        {/* Search This Area Button - Sticky on mobile, appears on desktop too */}
        {showSearchButton && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
            <button
              onClick={handleSearchClick}
              aria-label="Search for jobs in the current map area"
              className="bg-primary-600 text-white px-6 py-3 rounded-lg shadow-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              Search This Area
            </button>
          </div>
        )}
      </div>

      {/* Job Detail Modal (Desktop) */}
      <JobDetailModal jobId={showJobModal && !isMobile ? selectedJobId : null} onClose={handleCloseModal} />
      
      {/* Job Bottom Sheet (Mobile) */}
      <JobBottomSheet jobId={showJobModal && isMobile ? selectedJobId : null} onClose={handleCloseModal} />
      
      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal isOpen={showShortcutsModal} onClose={() => setShowShortcutsModal(false)} />
    </div>
  );
}
