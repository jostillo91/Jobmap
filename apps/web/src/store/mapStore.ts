import { create } from "zustand";

export interface MapBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface JobFilters {
  keyword: string;
  company: string;
  minPay: number | null;
  maxAgeDays: number | null;
  employmentType: string | null; // Keep for backward compatibility, but use employmentTypes array
  employmentTypes: string[]; // Multi-select employment types
}

interface MapStore {
  bounds: MapBounds | null;
  filters: JobFilters;
  selectedJobId: string | null;
  showSearchButton: boolean;
  setBounds: (bounds: MapBounds) => void;
  setFilters: (filters: Partial<JobFilters>) => void;
  setSelectedJobId: (id: string | null) => void;
  setShowSearchButton: (show: boolean) => void;
  resetFilters: () => void;
}

const defaultFilters: JobFilters = {
  keyword: "",
  company: "",
  minPay: null,
  maxAgeDays: null,
  employmentType: null,
  employmentTypes: [],
};

// Default Phoenix bounds
const defaultBounds: MapBounds = {
  minLon: -112.2,
  minLat: 33.3,
  maxLon: -111.9,
  maxLat: 33.6,
};

export const useMapStore = create<MapStore>((set) => ({
  bounds: defaultBounds,
  filters: defaultFilters,
  selectedJobId: null,
  showSearchButton: false,
  setBounds: (bounds) => set({ bounds }),
  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),
  setSelectedJobId: (id) => set({ selectedJobId: id }),
  setShowSearchButton: (show) => set({ showSearchButton: show }),
  resetFilters: () => set({ filters: defaultFilters }),
}));


