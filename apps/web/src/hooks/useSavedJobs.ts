"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "jobmap_saved_jobs";

export function useSavedJobs() {
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());

  // Load saved jobs from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const ids = JSON.parse(saved) as string[];
        setSavedJobIds(new Set(ids));
      }
    } catch (error) {
      // Silently fail - localStorage might be disabled or corrupted
      // User can still use the app, just won't see previously saved jobs
    }
  }, []);

  const saveJob = (jobId: string) => {
    const newSet = new Set(savedJobIds);
    newSet.add(jobId);
    setSavedJobIds(newSet);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(newSet)));
    } catch (error) {
      // Silently fail - localStorage might be disabled or full
      // State is still updated, just not persisted
    }
  };

  const unsaveJob = (jobId: string) => {
    const newSet = new Set(savedJobIds);
    newSet.delete(jobId);
    setSavedJobIds(newSet);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(newSet)));
    } catch (error) {
      // Silently fail - localStorage might be disabled or full
      // State is still updated, just not persisted
    }
  };

  const isSaved = (jobId: string) => savedJobIds.has(jobId);

  const toggleSave = (jobId: string) => {
    if (isSaved(jobId)) {
      unsaveJob(jobId);
    } else {
      saveJob(jobId);
    }
  };

  return {
    savedJobIds: Array.from(savedJobIds),
    isSaved,
    toggleSave,
    saveJob,
    unsaveJob,
  };
}
