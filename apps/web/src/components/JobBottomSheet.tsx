"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getJobDetail, JobDetail } from "@/lib/api";

interface JobBottomSheetProps {
  jobId: string | null;
  onClose: () => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatPay(payMin?: number, payMax?: number, currency?: string): string {
  if (!payMin && !payMax) return "Not specified";
  const curr = currency || "USD";
  const symbol = curr === "USD" ? "$" : curr;
  
  if (payMin && payMax) {
    return `${symbol}${Math.round(payMin / 1000)}k - ${symbol}${Math.round(payMax / 1000)}k`;
  }
  if (payMin) {
    return `${symbol}${Math.round(payMin / 1000)}k+`;
  }
  return `Up to ${symbol}${Math.round(payMax! / 1000)}k`;
}

function getGoogleMapsUrl(lat: number, lon: number, street?: string, city?: string, state?: string): string {
  const address = [street, city, state].filter(Boolean).join(", ");
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

export default function JobBottomSheet({ jobId, onClose }: JobBottomSheetProps) {
  const { data: job, isLoading, error } = useQuery<JobDetail>({
    queryKey: ["jobDetail", jobId],
    queryFn: () => getJobDetail(jobId!),
    enabled: !!jobId,
  });

  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const currentY = useRef<number>(0);

  // Handle drag to close
  useEffect(() => {
    if (!jobId || !sheetRef.current) return;

    const sheet = sheetRef.current;
    const handle = sheet.querySelector(".bottom-sheet-handle") as HTMLElement;

    const handleTouchStart = (e: TouchEvent) => {
      dragStartY.current = e.touches[0].clientY;
      currentY.current = 0;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (dragStartY.current === null) return;
      const deltaY = e.touches[0].clientY - dragStartY.current;
      if (deltaY > 0) {
        currentY.current = deltaY;
        sheet.style.transform = `translateY(${deltaY}px)`;
      }
    };

    const handleTouchEnd = () => {
      if (currentY.current > 100) {
        // Close if dragged down more than 100px
        onClose();
      } else {
        // Snap back
        sheet.style.transform = "";
      }
      dragStartY.current = null;
      currentY.current = 0;
    };

    handle?.addEventListener("touchstart", handleTouchStart);
    handle?.addEventListener("touchmove", handleTouchMove);
    handle?.addEventListener("touchend", handleTouchEnd);

    return () => {
      handle?.removeEventListener("touchstart", handleTouchStart);
      handle?.removeEventListener("touchmove", handleTouchMove);
      handle?.removeEventListener("touchend", handleTouchEnd);
    };
  }, [jobId, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  if (!jobId) return null;

  const address = [job?.street, job?.city, job?.state, job?.postalCode].filter(Boolean).join(", ");
  const directionsUrl = job ? getGoogleMapsUrl(job.latitude, job.longitude, job.street, job.city, job.state) : "#";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto md:hidden transition-transform duration-300 ease-out"
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-sheet-title"
        aria-describedby="job-sheet-description"
      >
        {/* Drag Handle */}
        <div className="bottom-sheet-handle sticky top-0 bg-white dark:bg-gray-800 pt-3 pb-2 flex justify-center z-10 touch-manipulation">
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-4">
              {isLoading ? (
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
              ) : job ? (
                <>
                  <h2 id="job-sheet-title" className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    {job.title}
                  </h2>
                  <p id="job-sheet-description" className="text-base text-gray-600 dark:text-gray-400">
                    {job.company}
                  </p>
                </>
              ) : null}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500 dark:text-gray-400 text-xl font-bold touch-manipulation"
              aria-label="Close job details"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-4">
          {isLoading ? (
            <div className="space-y-4" role="status" aria-live="polite">
              <div className="sr-only">Loading job details...</div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 animate-pulse" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6 animate-pulse" />
            </div>
          ) : error ? (
            <div className="text-center py-8 px-4">
              <div className="inline-block bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md mx-auto">
                <div className="text-4xl mb-3">⚠️</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Failed to Load Job Details
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  We couldn't load the job details. The job may have been removed or there was a connection issue.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors touch-manipulation"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          ) : job ? (
            <>
              {/* Job Info Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {job.payMin || job.payMax ? (
                  <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-3 py-1 rounded-full text-sm font-medium">
                    {formatPay(job.payMin, job.payMax, job.payCurrency)}
                  </span>
                ) : null}
                {job.employmentType && (
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full text-sm font-medium">
                    {job.employmentType.replace(/_/g, " ")}
                  </span>
                )}
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 px-3 py-1 rounded-full text-sm font-medium">
                  Posted {formatDate(job.postedAt)}
                </span>
              </div>

              {/* Location */}
              {address && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <span aria-hidden="true">📍</span> Location
                  </p>
                  <p className="text-gray-900 dark:text-gray-100" aria-label={`Location: ${address}${job.country ? `, ${job.country}` : ""}`}>
                    {address}
                  </p>
                  {job.country && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{job.country}</p>}
                </div>
              )}

              {/* Description */}
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Job Description</h3>
                <div
                  className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 prose-headings:text-gray-900 prose-headings:dark:text-white prose-strong:text-gray-900 prose-strong:dark:text-white"
                  dangerouslySetInnerHTML={{ __html: job.description.replace(/\n/g, "<br />") }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 pb-4">
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Get directions to ${job.company} at ${address || `${job.latitude}, ${job.longitude}`}`}
                  className="flex-1 text-center px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors text-gray-700 dark:text-gray-300 touch-manipulation"
                >
                  Get Directions
                </a>
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Apply for ${job.title} at ${job.company}`}
                  className="flex-1 text-center px-4 py-3 bg-primary-600 text-white hover:bg-primary-700 rounded-lg font-medium transition-colors touch-manipulation"
                >
                  Apply Now
                </a>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

