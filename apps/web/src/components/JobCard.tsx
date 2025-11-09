"use client";

import { JobPin } from "@/lib/api";
import ShareButton from "./ShareButton";
import { useToastContext } from "@/context/ToastContext";

interface JobCardProps {
  job: JobPin;
  isSelected?: boolean;
  isSaved?: boolean;
  onSave?: () => void;
  onClick?: () => void;
}

function formatDate(dateString: string): { text: string; isNew: boolean } {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let text: string;
  if (diffDays === 0) text = "Today";
  else if (diffDays === 1) text = "1 day ago";
  else if (diffDays < 7) text = `${diffDays} days ago`;
  else if (diffDays < 30) text = `${Math.floor(diffDays / 7)} weeks ago`;
  else text = `${Math.floor(diffDays / 30)} months ago`;

  return { text, isNew: diffDays <= 7 }; // New if posted within last week
}

function formatPay(payMin?: number, payMax?: number): string {
  if (!payMin && !payMax) return "";
  if (payMin && payMax) {
    return `$${Math.round(payMin / 1000)}k - $${Math.round(payMax / 1000)}k`;
  }
  if (payMin) {
    return `$${Math.round(payMin / 1000)}k+`;
  }
  return `Up to $${Math.round(payMax! / 1000)}k`;
}

function getGoogleMapsUrl(lat: number, lon: number, street?: string, city?: string, state?: string): string {
  const address = [street, city, state].filter(Boolean).join(", ");
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

export default function JobCard({ job, isSelected, isSaved, onSave, onClick }: JobCardProps) {
  const toast = useToastContext();
  const address = [job.street, job.city, job.state].filter(Boolean).join(", ");
  const payText = formatPay(job.payMin, job.payMax);
  const directionsUrl = getGoogleMapsUrl(job.lat, job.lon, job.street, job.city, job.state);
  const dateInfo = formatDate(job.postedAt);
  const isHighPay = (job.payMin && job.payMin >= 80000) || (job.payMax && job.payMax >= 100000);

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSave) {
      onSave();
      if (isSaved) {
        toast.success("Job removed from saved");
      } else {
        toast.success("Job saved!");
      }
    }
  };

  return (
    <article
      role="article"
      aria-label={`Job: ${job.title} at ${job.company}`}
      className={`bg-white dark:bg-gray-800 border rounded-lg p-3 md:p-4 cursor-pointer transition-all hover:shadow-md touch-manipulation ${
        isSelected ? "border-primary-500 dark:border-primary-400 shadow-md ring-2 ring-primary-200 dark:ring-primary-800" : "border-gray-200 dark:border-gray-700"
      }`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      tabIndex={0}
    >
      <h3 className="font-semibold text-base md:text-lg text-gray-900 dark:text-white mb-1">{job.title}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-2" aria-label={`Company: ${job.company}`}>{job.company}</p>

      <div className="flex flex-wrap gap-2 mb-3 text-xs">
        {payText && (
          <span className={`px-2 py-1 rounded font-medium ${
            isHighPay 
              ? "bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100" 
              : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
          }`}>
            {isHighPay && "💰 "}{payText}
          </span>
        )}
        {job.employmentType && (
          <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
            {job.employmentType.replace("_", " ")}
          </span>
        )}
        <span className={`px-2 py-1 rounded ${
          dateInfo.isNew 
            ? "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 font-medium" 
            : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
        }`}>
          {dateInfo.isNew && "🆕 "}{dateInfo.text}
        </span>
      </div>

      {address && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3" aria-label={`Location: ${address}`}>
          <span aria-hidden="true">📍</span> {address}
        </p>
      )}

      <div className="flex gap-2">
        {onSave && (
          <button
            onClick={handleSave}
            aria-label={isSaved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}
            className={`px-2 md:px-3 py-2 rounded transition-colors touch-manipulation min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 ${
              isSaved
                ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 active:bg-yellow-300 dark:active:bg-yellow-900/70"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500"
            }`}
            title={isSaved ? "Remove from saved" : "Save job"}
          >
            <span aria-hidden="true" className="text-lg">{isSaved ? "★" : "☆"}</span>
          </button>
        )}
        <ShareButton job={job} />
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Get directions to ${job.company} at ${address || `${job.lat}, ${job.lon}`}`}
          className="flex-1 text-center text-xs md:text-sm px-2 md:px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors text-gray-700 dark:text-gray-300 touch-manipulation active:bg-gray-300 dark:active:bg-gray-500"
          onClick={(e) => e.stopPropagation()}
        >
          Directions
        </a>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Apply for ${job.title} at ${job.company}`}
          className="flex-1 text-center text-xs md:text-sm px-2 md:px-3 py-2 bg-primary-600 text-white hover:bg-primary-700 rounded transition-colors touch-manipulation active:bg-primary-800"
          onClick={(e) => e.stopPropagation()}
        >
          Apply
        </a>
      </div>
    </article>
  );
}


