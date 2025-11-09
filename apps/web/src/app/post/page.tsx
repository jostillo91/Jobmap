"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const formSchema = z.object({
  company: z.string().min(1, "Company name is required"),
  title: z.string().min(1, "Job title is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  employmentType: z.string().optional(),
  payMin: z.string().optional(),
  payMax: z.string().optional(),
  url: z.string().url("Must be a valid URL"),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().length(2, "State must be 2 letters"),
  postalCode: z.string().min(5, "Postal code is required"),
  country: z.string().default("US"),
});

type FormData = z.infer<typeof formSchema>;

function MapPreview({ lat, lon }: { lat: number | null; lon: number | null }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!mapContainer.current || !lat || !lon) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [lon, lat],
        zoom: 15,
      });
    } else {
      map.current.setCenter([lon, lat]);
    }

    // Update marker
    if (marker.current) {
      marker.current.setLngLat([lon, lat]);
    } else {
      const el = document.createElement("div");
      el.className = "w-6 h-6 bg-red-600 rounded-full border-2 border-white shadow-lg";
      marker.current = new mapboxgl.Marker(el).setLngLat([lon, lat]).addTo(map.current);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [lat, lon]);

  if (!lat || !lon) return null;

  return (
    <div className="mt-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">Location Preview</label>
      <div ref={mapContainer} className="w-full h-64 rounded-lg border border-gray-300" />
    </div>
  );
}

export default function PostJobPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    company: "",
    title: "",
    description: "",
    employmentType: "",
    payMin: "",
    payMax: "",
    url: "",
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewCoords, setPreviewCoords] = useState<{ lat: number | null; lon: number | null }>({
    lat: null,
    lon: null,
  });
  const [isValidatingAddress, setIsValidatingAddress] = useState(false);

  const validateAddress = async () => {
    if (!formData.street || !formData.city || !formData.state || !formData.postalCode) {
      setPreviewCoords({ lat: null, lon: null });
      return;
    }

    setIsValidatingAddress(true);
    try {
      const response = await fetch(`${API_BASE}/v1/employer/validate-address`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          street: formData.street,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
          country: formData.country,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewCoords({ lat: data.lat, lon: data.lon });
        setErrors((e) => ({ ...e, address: "" }));
      } else {
        setPreviewCoords({ lat: null, lon: null });
        setErrors((e) => ({ ...e, address: "Could not validate address" }));
      }
    } catch (error) {
      setPreviewCoords({ lat: null, lon: null });
    } finally {
      setIsValidatingAddress(false);
    }
  };

  // Validate address when address fields change
  useEffect(() => {
    const timer = setTimeout(() => {
      validateAddress();
    }, 500); // Debounce

    return () => clearTimeout(timer);
  }, [formData.street, formData.city, formData.state, formData.postalCode, formData.country]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      // Validate form
      const validated = formSchema.parse(formData);

      if (!previewCoords.lat || !previewCoords.lon) {
        setErrors({ address: "Please enter a valid address" });
        return;
      }

      setIsSubmitting(true);

      // Submit to API
      const response = await fetch(`${API_BASE}/v1/employer/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validated,
          payMin: validated.payMin ? parseInt(validated.payMin) : undefined,
          payMax: validated.payMax ? parseInt(validated.payMax) : undefined,
          employmentType: validated.employmentType || undefined,
          hCaptcha: "mock-token", // Mock for now
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 422) {
          setErrors({ address: data.message || "Please enter a valid address" });
        } else if (response.status === 429) {
          setErrors({ submit: "Too many requests. Please wait a moment and try again." });
        } else if (response.status >= 500) {
          setErrors({ submit: "Server error. Please try again later." });
        } else {
          setErrors({ submit: data.message || "Failed to submit job. Please check your information and try again." });
        }
        setIsSubmitting(false);
        return;
      }

      // Success - show toast and redirect
      // Note: Toast will be shown via URL param handling in home page
      router.push("/?success=Job posted successfully!");
    } catch (error) {
      if (error instanceof z.ZodError) {
        const zodErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            zodErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(zodErrors);
      } else {
        setErrors({ submit: "An error occurred. Please try again." });
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Post a Job</h1>

        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6 space-y-6">
          {/* Company */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name *
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {errors.company && <p className="text-red-600 text-sm mt-1">{errors.company}</p>}
          </div>

          {/* Job Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {errors.title && <p className="text-red-600 text-sm mt-1">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description * (min 10 characters)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {errors.description && (
              <p className="text-red-600 text-sm mt-1">{errors.description}</p>
            )}
          </div>

          {/* Employment Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Employment Type
            </label>
            <select
              value={formData.employmentType}
              onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select type</option>
              <option value="FULL_TIME">Full Time</option>
              <option value="PART_TIME">Part Time</option>
              <option value="CONTRACT">Contract</option>
              <option value="TEMP">Temporary</option>
              <option value="INTERN">Intern</option>
            </select>
          </div>

          {/* Pay Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Pay ($)</label>
              <input
                type="number"
                value={formData.payMin}
                onChange={(e) => setFormData({ ...formData, payMin: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Pay ($)</label>
              <input
                type="number"
                value={formData.payMax}
                onChange={(e) => setFormData({ ...formData, payMax: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Apply URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Apply URL *</label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://example.com/apply"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {errors.url && <p className="text-red-600 text-sm mt-1">{errors.url}</p>}
          </div>

          {/* Address Fields */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Location *</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                <input
                  type="text"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.street && <p className="text-red-600 text-sm mt-1">{errors.street}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {errors.city && <p className="text-red-600 text-sm mt-1">{errors.city}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State (2 letters)</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value.toUpperCase().slice(0, 2) })
                    }
                    maxLength={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {errors.state && <p className="text-red-600 text-sm mt-1">{errors.state}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {errors.postalCode && (
                  <p className="text-red-600 text-sm mt-1">{errors.postalCode}</p>
                )}
              </div>

              {isValidatingAddress && (
                <p className="text-sm text-gray-500">Validating address...</p>
              )}
              {errors.address && (
                <p className="text-red-600 text-sm">{errors.address}</p>
              )}

              <MapPreview lat={previewCoords.lat} lon={previewCoords.lon} />
            </div>
          </div>

          {/* Submit */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {errors.submit}
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isSubmitting || !previewCoords.lat}
              className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Submitting..." : "Post Job"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


