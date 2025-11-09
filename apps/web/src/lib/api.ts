import { z } from "zod";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const JobPinSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  url: z.string(),
  lat: z.number(),
  lon: z.number(),
  payMin: z.number().optional(),
  payMax: z.number().optional(),
  postedAt: z.string(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  employmentType: z.string().optional(),
  source: z.string(),
});

export const JobDetailSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourceId: z.string(),
  title: z.string(),
  company: z.string(),
  description: z.string(),
  url: z.string(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  employmentType: z.string().optional(),
  payMin: z.number().optional(),
  payMax: z.number().optional(),
  payCurrency: z.string().optional(),
  postedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type JobPin = z.infer<typeof JobPinSchema>;
export type JobDetail = z.infer<typeof JobDetailSchema>;

export interface SearchJobsParams {
  bbox: string; // minLon,minLat,maxLon,maxLat
  q?: string;
  company?: string;
  minPay?: number;
  maxAgeDays?: number;
  type?: string; // Single type (backward compatibility)
  types?: string; // Comma-separated list of types
  limit?: number;
}

export interface SearchJobsResponse {
  jobs: JobPin[];
  count: number;
}

export async function searchJobs(params: SearchJobsParams): Promise<SearchJobsResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("bbox", params.bbox);
  if (params.q) searchParams.set("q", params.q);
  if (params.company) searchParams.set("company", params.company);
  if (params.minPay) searchParams.set("minPay", params.minPay.toString());
  if (params.maxAgeDays) searchParams.set("maxAgeDays", params.maxAgeDays.toString());
  if (params.types) searchParams.set("types", params.types); // Multi-select types
  else if (params.type) searchParams.set("type", params.type); // Single type (backward compat)
  if (params.limit) searchParams.set("limit", params.limit.toString());

  const response = await fetch(`${API_BASE}/v1/jobs/search?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = (await response.json()) as { jobs: unknown[]; count: number };
  return {
    jobs: data.jobs.map((job) => JobPinSchema.parse(job)),
    count: data.count,
  };
}

export async function getJobDetail(id: string): Promise<JobDetail> {
  const response = await fetch(`${API_BASE}/v1/jobs/${id}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = (await response.json()) as unknown;
  return JobDetailSchema.parse(data);
}

export async function getSearchSuggestions(
  query: string,
  type: "title" | "company" = "title"
): Promise<string[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const response = await fetch(
    `${API_BASE}/v1/jobs/suggestions?q=${encodeURIComponent(query)}&type=${type}`
  );
  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { suggestions?: string[] };
  return data.suggestions || [];
}
