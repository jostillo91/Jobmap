import { EmploymentType, JobSource } from "@prisma/client";

export type JobPin = {
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
};

export type JobDetail = {
  id: string;
  source: string;
  sourceId: string;
  title: string;
  company: string;
  description: string;
  url: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  latitude: number;
  longitude: number;
  employmentType?: string;
  payMin?: number;
  payMax?: number;
  payCurrency?: string;
  postedAt: string;
  createdAt: string;
  updatedAt: string;
};






