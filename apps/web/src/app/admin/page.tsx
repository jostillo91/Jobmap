"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Job {
  id: string;
  title: string;
  company: string;
  url: string;
  lat: number;
  lon: number;
  payMin?: number;
  payMax?: number;
  postedAt: string;
  street?: string;
  city?: string;
  state?: string;
  employmentType?: string;
  source: string;
}

async function fetchPendingJobs(adminKey: string): Promise<{ jobs: Job[]; total: number }> {
  const response = await fetch(`${API_BASE}/v1/admin/jobs?status=PENDING&limit=100`, {
    headers: {
      "x-admin-key": adminKey,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function approveJob(id: string, adminKey: string): Promise<void> {
  const response = await fetch(`${API_BASE}/v1/admin/jobs/${id}/approve`, {
    method: "POST",
    headers: {
      "x-admin-key": adminKey,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
}

async function rejectJob(id: string, adminKey: string): Promise<void> {
  const response = await fetch(`${API_BASE}/v1/admin/jobs/${id}/reject`, {
    method: "POST",
    headers: {
      "x-admin-key": adminKey,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const queryClient = useQueryClient();

  // Check if admin key is stored
  useEffect(() => {
    const stored = localStorage.getItem("admin-key");
    if (stored) {
      setAdminKey(stored);
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    if (adminKey) {
      localStorage.setItem("admin-key", adminKey);
      setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin-key");
    setAdminKey("");
    setIsAuthenticated(false);
  };

  // Fetch pending jobs
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "pending-jobs", adminKey],
    queryFn: () => fetchPendingJobs(adminKey),
    enabled: isAuthenticated && !!adminKey,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (id: string) => approveJob(id, adminKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "pending-jobs"] });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectJob(id, adminKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "pending-jobs"] });
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white shadow-md rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Admin Login</h1>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Key
              </label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter admin key"
              />
            </div>
            <button
              onClick={handleLogin}
              className="w-full bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin Moderation</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Logout
          </button>
        </div>

        {isLoading ? (
          <div className="text-center text-gray-500 py-12">Loading pending jobs...</div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            Error loading jobs: {error instanceof Error ? error.message : "Unknown error"}
          </div>
        ) : data?.jobs.length === 0 ? (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            ✅ No pending jobs! All caught up.
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Pending Jobs ({data?.total || 0})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pay
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Posted
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data?.jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{job.title}</div>
                        <div className="text-xs text-gray-500">{job.source}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{job.company}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {[job.street, job.city, job.state].filter(Boolean).join(", ") || "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {job.payMin && job.payMax
                            ? `$${Math.round(job.payMin / 1000)}k - $${Math.round(job.payMax / 1000)}k`
                            : job.payMin
                            ? `$${Math.round(job.payMin / 1000)}k+`
                            : "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(job.postedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveMutation.mutate(job.id)}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => rejectMutation.mutate(job.id)}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}






