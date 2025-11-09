"use client";

import { JobPin } from "@/lib/api";
import { useToastContext } from "@/context/ToastContext";

interface ShareButtonProps {
  job: JobPin;
  className?: string;
}

export default function ShareButton({ job, className = "" }: ShareButtonProps) {
  const toast = useToastContext();

  const jobUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/job/${job.id}`
    : `https://jobmap.app/job/${job.id}`;

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Try Web Share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${job.title} at ${job.company}`,
          text: `Check out this job: ${job.title} at ${job.company}`,
          url: jobUrl,
        });
        return;
      } catch (err) {
        // User cancelled or error, fall through to copy
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(jobUrl);
      toast.success("Job link copied to clipboard!");
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = jobUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      toast.success("Job link copied to clipboard!");
    }
  };

  return (
    <button
      onClick={handleShare}
      aria-label={`Share ${job.title} at ${job.company}`}
      className={`px-3 py-2 rounded transition-colors bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 ${className}`}
      title="Share job"
    >
      <span aria-hidden="true">🔗</span> Share
    </button>
  );
}

