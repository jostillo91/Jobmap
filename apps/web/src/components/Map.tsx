"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Supercluster from "supercluster";
import { JobPin } from "@/lib/api";
import { useMapStore } from "@/store/mapStore";

interface MapProps {
  jobs?: JobPin[];
  onJobClick?: (job: JobPin) => void;
}

// Type for supercluster cluster/point feature
interface ClusterFeature {
  id?: number;
  type: "Feature";
  properties: {
    cluster: boolean;
    point_count?: number;
    jobId?: string;
    job?: JobPin;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}

function JobMapComponent(props: MapProps = { jobs: [] }) {
  // Safely destructure with defaults
  const { jobs = [], onJobClick } = props;
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const clusterRef = useRef<Supercluster | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapboxError, setMapboxError] = useState<string | null>(null);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const { bounds, setBounds, setShowSearchButton, selectedJobId } = useMapStore();
  
  // Track loading state based on jobs prop changes
  useEffect(() => {
    if (jobs.length === 0 && isLoaded) {
      setIsLoadingJobs(true);
      const timer = setTimeout(() => setIsLoadingJobs(false), 1000);
      return () => clearTimeout(timer);
    } else if (jobs.length > 0) {
      setIsLoadingJobs(false);
    }
  }, [jobs.length, isLoaded]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setMapboxError("MAPBOX_TOKEN not set. Please set NEXT_PUBLIC_MAPBOX_TOKEN in your .env.local file.");
      return;
    }

    setMapboxError(null);

    mapboxgl.accessToken = token;

    // Initialize map centered on Phoenix
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-112.074, 33.4484], // Phoenix
      zoom: 11,
    });

    map.current.on("load", () => {
      setIsLoaded(true);
      // Set initial bounds after map loads
      const mapBounds = map.current?.getBounds();
      if (mapBounds) {
        setBounds({
          minLon: mapBounds.getWest(),
          minLat: mapBounds.getSouth(),
          maxLon: mapBounds.getEast(),
          maxLat: mapBounds.getNorth(),
        });
      }
    });

    // Debounced bounds update to prevent excessive state updates
    let moveTimeout: NodeJS.Timeout | null = null;
    const handleMove = () => {
      if (moveTimeout) clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => {
        if (!map.current) return;
        const mapBounds = map.current.getBounds();
        if (mapBounds) {
          setBounds({
            minLon: mapBounds.getWest(),
            minLat: mapBounds.getSouth(),
            maxLon: mapBounds.getEast(),
            maxLat: mapBounds.getNorth(),
          });
          setShowSearchButton(true);
        }
      }, 300); // 300ms debounce for bounds updates
    };

    map.current.on("moveend", handleMove);
    map.current.on("dragend", handleMove);
    map.current.on("zoomend", handleMove);

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [setBounds, setShowSearchButton]);

  // Update markers when jobs change (with performance optimization)
  useEffect(() => {
    if (!map.current || !isLoaded || jobs.length === 0) {
      // Clear markers if no jobs
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      return;
    }

    // Use requestAnimationFrame for smooth rendering
    const frameId = requestAnimationFrame(() => {
      if (!map.current) return;

      // Clear existing markers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      // Initialize supercluster with optimized settings
      // Smaller radius = tighter clustering, markers show individually when zoomed in
      if (!clusterRef.current) {
        clusterRef.current = new Supercluster({
          radius: 50, // Standard cluster radius - allows natural clustering without grid pattern
          maxZoom: 15, // High max zoom - markers show individually when zoomed in close
          minZoom: 0, // Min zoom to generate clusters on
          minPoints: 2, // Minimum points to form a cluster
          extent: 512, // Tile extent (radius is calculated relative to this)
          nodeSize: 64, // Size of the KD-tree leaf node (affects performance)
        });
      }

      // Create points for clustering (limit to visible area for performance)
      const mapBounds = map.current.getBounds();
      if (!mapBounds) return;
      
      const visibleJobs = jobs.filter((job) => {
        const lat = job.lat;
        const lon = job.lon;
        return (
          lat >= mapBounds.getSouth() &&
          lat <= mapBounds.getNorth() &&
          lon >= mapBounds.getWest() &&
          lon <= mapBounds.getEast()
        );
      });

      // Use exact coordinates - no spreading
      // Map clustering will handle overlapping markers naturally
      const points = visibleJobs.map((job) => {
        return {
          type: "Feature" as const,
          properties: {
            cluster: false,
            jobId: job.id,
            job: job, // Store job with exact coordinates
          },
          geometry: {
            type: "Point" as const,
            coordinates: [job.lon, job.lat], // Use exact coordinates from database
          },
        };
      });

      // Get current zoom and bounds for clustering
      const zoom = Math.floor(map.current.getZoom());
      const bbox: [number, number, number, number] = [
        mapBounds.getWest(),
        mapBounds.getSouth(),
        mapBounds.getEast(),
        mapBounds.getNorth(),
      ];

      clusterRef.current.load(points);
      const clusters = clusterRef.current.getClusters(bbox, zoom) as ClusterFeature[];

      // Create markers (batch DOM operations)
      const markerElements: mapboxgl.Marker[] = [];

      clusters.forEach((cluster: ClusterFeature) => {
        const [lon, lat] = cluster.geometry.coordinates;
        const isCluster = cluster.properties.cluster;

        // Create marker element
        const el = document.createElement("div");
        el.className = "marker";

        if (isCluster) {
          // Cluster marker - larger touch target for mobile
          el.innerHTML = `
            <div class="cluster-marker bg-primary-600 text-white rounded-full flex items-center justify-center font-bold shadow-lg touch-manipulation" style="width: 44px; height: 44px; min-width: 44px; min-height: 44px;">
              ${cluster.properties.point_count}
            </div>
          `;
          // Use touchstart for better mobile responsiveness
          el.addEventListener("click", () => {
            if (!map.current || !clusterRef.current) return;
            const expansionZoom = Math.min(
              clusterRef.current.getClusterExpansionZoom(cluster.id as number),
              20
            );
            map.current.easeTo({
              center: [lon, lat],
              zoom: expansionZoom,
            });
          });
        } else {
          // Individual job marker - larger touch target for mobile
          const job = cluster.properties.job as JobPin;
          const isSelected = job.id === selectedJobId;
          el.innerHTML = `
            <div class="job-marker bg-red-600 text-white rounded-full flex items-center justify-center font-bold shadow-lg border-2 touch-manipulation ${
              isSelected ? "border-yellow-400 scale-125" : "border-white"
            }" style="width: 40px; height: 40px; min-width: 40px; min-height: 40px;">
              💼
            </div>
          `;
          el.addEventListener("click", () => {
            onJobClick?.(job);
          });
        }

        const marker = new mapboxgl.Marker(el).setLngLat([lon, lat]).addTo(map.current!);
        markerElements.push(marker);
      });

      markersRef.current = markerElements;
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [jobs, isLoaded, onJobClick, selectedJobId]);

  // Center on selected job
  useEffect(() => {
    if (!map.current || !selectedJobId) return;
    const job = jobs.find((j) => j.id === selectedJobId);
    if (job) {
      map.current.flyTo({
        center: [job.lon, job.lat],
        zoom: 15,
        duration: 1000,
      });
    }
  }, [selectedJobId, jobs]);

  if (mapboxError) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800 p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">🗺️</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Mapbox Token Required</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Please set NEXT_PUBLIC_MAPBOX_TOKEN in your .env.local file.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Get your token from{" "}
            <a
              href="https://account.mapbox.com/access-tokens/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
            >
              Mapbox
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      {/* Loading overlay */}
      {isLoadingJobs && (
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center z-10 backdrop-blur-sm">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2" role="status" aria-label="Loading jobs">
              <span className="sr-only">Loading jobs...</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading jobs...</p>
          </div>
        </div>
      )}
      <style jsx global>{`
        .marker {
          cursor: pointer;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .cluster-marker {
          transition: transform 0.2s;
          user-select: none;
          -webkit-user-select: none;
        }
        .cluster-marker:hover {
          transform: scale(1.1);
        }
        .cluster-marker:active {
          transform: scale(0.95);
        }
        .job-marker {
          transition: transform 0.2s;
          user-select: none;
          -webkit-user-select: none;
        }
        .job-marker:hover {
          transform: scale(1.15);
        }
        .job-marker:active {
          transform: scale(0.95);
        }
        .touch-manipulation {
          touch-action: manipulation;
        }
      `}</style>
    </div>
  );
}

export default JobMapComponent;

