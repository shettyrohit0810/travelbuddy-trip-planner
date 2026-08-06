'use client';

import React, { useEffect, useRef, useState } from 'react';
// Import Leaflet styles
import 'leaflet/dist/leaflet.css';

interface InteractiveMapProps {
  destination: string;
}

export default function InteractiveMap({ destination }: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Resolve destination name to coordinates using Nominatim
  useEffect(() => {
    if (!destination) return;
    
    setIsLoading(true);
    setError(null);
    
    const resolveLocation = async () => {
      try {
        // User Agent is required by Nominatim's usage policy
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}&limit=1`,
          {
            headers: {
              'User-Agent': 'TravelBuddy-Travel-Planner'
            }
          }
        );
        
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            setCoords({ lat, lon });
            setIsLoading(false);
            return;
          }
        }
        console.warn('Destination lookup returned no results, trying fallback coordinates.');
        // Set coordinates directly from fallback keys
        const fallbacks: Record<string, { lat: number; lon: number }> = {
          kyoto: { lat: 35.0116, lon: 135.7681 },
          rome: { lat: 41.9028, lon: 12.4964 },
          paris: { lat: 48.8566, lon: 2.3522 },
          tokyo: { lat: 35.6762, lon: 139.6503 },
          rajasthan: { lat: 27.0238, lon: 74.2179 },
          goa: { lat: 15.2993, lon: 74.1240 },
          assam: { lat: 26.2006, lon: 92.9376 }
        };
        const q = destination.toLowerCase();
        const fallback = Object.keys(fallbacks).find(key => q.includes(key));
        if (fallback) {
          setCoords(fallbacks[fallback]);
        } else {
          // Default center (Delhi, India area instead of Rome)
          setCoords({ lat: 28.6139, lon: 77.2090 });
        }
        setIsLoading(false);
      } catch (err) {
        console.error('Nominatim geocoding failed, using fallback:', err);
        // Cohesive fallbacks for popular cities
        const fallbacks: Record<string, { lat: number; lon: number }> = {
          kyoto: { lat: 35.0116, lon: 135.7681 },
          rome: { lat: 41.9028, lon: 12.4964 },
          paris: { lat: 48.8566, lon: 2.3522 },
          tokyo: { lat: 35.6762, lon: 139.6503 },
          rajasthan: { lat: 27.0238, lon: 74.2179 },
          goa: { lat: 15.2993, lon: 74.1240 },
          assam: { lat: 26.2006, lon: 92.9376 }
        };
        
        const q = destination.toLowerCase();
        const fallback = Object.keys(fallbacks).find(key => q.includes(key));
        
        if (fallback) {
          setCoords(fallbacks[fallback]);
        } else {
          setCoords({ lat: 28.6139, lon: 77.2090 });
        }
        setIsLoading(false);
      }
    };

    resolveLocation();
  }, [destination]);

  // 2. Initialize Leaflet Map once coordinates are resolved
  useEffect(() => {
    if (typeof window === 'undefined' || !coords || !mapRef.current) return;

    // Dynamically import Leaflet on client side
    const initMap = async () => {
      const L = (await import('leaflet')).default;

      // Fix default marker icon issues in Webpack/Next.js
      // Leaflet default icons look for local assets which can be broken by bundlers
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      });

      // Cleanup previous map instance if it exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Initialize map container
      if (!mapRef.current) return;
      const map = L.map(mapRef.current).setView([coords.lat, coords.lon], 11);
      mapInstanceRef.current = map;

      // Add high-quality OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
      }).addTo(map);

      // Add custom marker with popup
      L.marker([coords.lat, coords.lon])
        .addTo(map)
        .bindPopup(`<b>${destination}</b><br/>Exploring this region!`)
        .openPopup();
    };

    initMap();

    // Cleanup map on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [coords, destination]);

  return (
    <div className="w-full h-full min-h-[300px] relative rounded-2xl overflow-hidden bg-surface-container-low border border-surface-variant/30">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface/80 backdrop-blur-sm animate-fade-in">
          <span className="material-symbols-outlined animate-spin text-primary text-4xl mb-2">hourglass_empty</span>
          <p className="text-on-surface-variant text-[13px] font-medium">Resolving destination coordinates...</p>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full min-h-[300px] z-0" />
    </div>
  );
}
