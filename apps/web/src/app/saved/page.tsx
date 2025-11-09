"use client";

import { useQuery } from "@tanstack/react-query";
import { getJobDetail, JobDetail } from "@/lib/api";
import { useSavedJobs } from "@/hooks/useSavedJobs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import ThemeToggle from "@/components/ThemeToggle";
import EmptyState from "@/components/EmptyState";

// Lazy load modal for better code splitting
const JobDetailModal = dynamic(() => import("@/components/JobDetailModal"), {
  ssr: false,
});

export default function SavedJobsPage() {
  const router = useRouter();
  const { savedJobIds, isSaved, toggleSave } = useSavedJobs();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Fetch all saved job details
  const { data: jobs, isLoading } = useQuery<JobDetail[]>({
    queryKey: ["savedJobs", savedJobIds],
    queryFn: async () => {
      const jobPromises = savedJobIds.map((id) => getJobDetail(id));
      return Promise.all(jobPromises);
    },
    enabled: savedJobIds.length > 0,
  });

  const handleJobClick = (jobId: string) => {
    setSelectedJobId(jobId);
  };

  const handleCloseModal = () => {
    setSelectedJobId(null);
  };

  const handleUnsave = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSave(jobId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8">
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" role="status" aria-label="Loading">
                <span className="sr-only">Loading saved jobs...</span>
              </div>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Loading saved jobs...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!savedJobIds.length) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8">
            <EmptyState
              icon="⭐"
              title="No Saved Jobs Yet"
              description="Start saving jobs you're interested in by clicking the star icon on any job card. Your saved jobs will appear here for easy access."
              action={{
                label: "Browse Jobs",
                onClick: () => router.push("/"),
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8">
            <EmptyState
              icon="🗑️"
              title="Some Jobs May Have Been Removed"
              description="Some of your saved jobs are no longer available. They may have been filled, expired, or removed by the employer."
              action={{
                label: "Browse New Jobs",
                onClick: () => router.push("/"),
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Saved Jobs</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{jobs.length} saved {jobs.length === 1 ? "job" : "jobs"}</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => router.push("/")}
              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
            >
              ← Back to Map
            </button>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="space-y-4">
          {jobs.map((job) => {
            const address = [job.street, job.city, job.state, job.postalCode].filter(Boolean).join(", ");
            const payText =
              job.payMin || job.payMax
                ? `$${Math.round((job.payMin || 0) / 1000)}k - $${Math.round((job.payMax || 0) / 1000)}k`
                : "";

            return (
              <article
                key={job.id}
                role="article"
                aria-label={`Saved job: ${job.title} at ${job.company}`}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleJobClick(job.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleJobClick(job.id);
                  }
                }}
                tabIndex={0}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{job.title}</h2>
                    <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">{job.company}</p>
                  </div>
                  <button
                    onClick={(e) => handleUnsave(job.id, e)}
                    aria-label={`Remove ${job.title} from saved jobs`}
                    className="ml-4 p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                    title="Remove from saved"
                  >
                    <span aria-hidden="true">★</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {payText && (
                    <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-3 py-1 rounded-full text-sm">
                      {payText}
                    </span>
                  )}
                  {job.employmentType && (
                    <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full text-sm">
                      {job.employmentType.replace(/_/g, " ")}
                    </span>
                  )}
                  <span className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 px-3 py-1 rounded-full text-sm">
                    {new Date(job.postedAt).toLocaleDateString()}
                  </span>
                </div>

                {address && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4" aria-label={`Location: ${address}`}>
                    <span aria-hidden="true">📍</span> {address}
                  </p>
                )}

                <div className="flex gap-3">
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Apply for ${job.title} at ${job.company}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 text-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Apply Now
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Job Detail Modal */}
      <JobDetailModal jobId={selectedJobId} onClose={handleCloseModal} />
    </div>
  );
}


