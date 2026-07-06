'use client';

import { useEffect, useRef, useState } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

let initialized = false;

function initLoader() {
  if (initialized) return;
  initialized = true;
  setOptions({
    key: GOOGLE_MAPS_API_KEY,
    v: 'weekly',
  });
}

interface GoogleMapProps {
  polyline?: string; // encoded polyline string
  markers?: { lat: number; lng: number; label?: string; color?: 'red' | 'green' | 'blue' | 'orange' }[];
  liveLocation?: { lat: number; lng: number } | null;
  className?: string;
  zoom?: number;
  center?: { lat: number; lng: number };
  snapMarkersToRoute?: boolean;
  connectMarkersToRoute?: boolean;
}

type MapPoint = { lat: number; lng: number };

function projectPointOnPath(point: MapPoint, path: MapPoint[]) {
  let nearest = point;
  let nearestDistance = Number.POSITIVE_INFINITY;
  let segmentIndex = 0;
  let segmentRatio = 0;

  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index];
    const end = path[index + 1];
    const meanLatitude = ((start.lat + end.lat + point.lat) / 3) * Math.PI / 180;
    const longitudeScale = Math.cos(meanLatitude);
    const segmentX = (end.lng - start.lng) * longitudeScale;
    const segmentY = end.lat - start.lat;
    const pointX = (point.lng - start.lng) * longitudeScale;
    const pointY = point.lat - start.lat;
    const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;
    const ratio = segmentLengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, (pointX * segmentX + pointY * segmentY) / segmentLengthSquared));
    const candidate = {
      lat: start.lat + ratio * (end.lat - start.lat),
      lng: start.lng + ratio * (end.lng - start.lng),
    };
    const distance = (candidate.lat - point.lat) ** 2
      + ((candidate.lng - point.lng) * longitudeScale) ** 2;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = candidate;
      segmentIndex = index;
      segmentRatio = ratio;
    }
  }

  return { point: nearest, segmentIndex, segmentRatio, distanceSquared: nearestDistance };
}

function nearestPointOnPath(
  point: { lat: number; lng: number },
  path: Array<{ lat: number; lng: number }>,
) {
  if (path.length < 2) return point;
  return projectPointOnPath(point, path).point;
}

function connectPointsToRoute(path: MapPoint[], markers: MapPoint[]) {
  if (path.length < 2 || markers.length === 0) return path;

  const pointsBySegment = new Map<number, Array<{ marker: MapPoint; projected: MapPoint; ratio: number; distanceSquared: number }>>();
  markers.forEach((marker) => {
    const projection = projectPointOnPath(marker, path);
    const segmentPoints = pointsBySegment.get(projection.segmentIndex) || [];
    segmentPoints.push({ marker, projected: projection.point, ratio: projection.segmentRatio, distanceSquared: projection.distanceSquared });
    pointsBySegment.set(projection.segmentIndex, segmentPoints);
  });

  const connectedPath: MapPoint[] = [path[0]];
  for (let index = 0; index < path.length - 1; index += 1) {
    const segmentPoints = (pointsBySegment.get(index) || []).sort((a, b) => a.ratio - b.ratio);
    segmentPoints.forEach(({ marker, projected, distanceSquared }) => {
      connectedPath.push(projected);
      // Keep points on their real coordinates and add a visible return leg to the base route.
      if (distanceSquared > 1e-12) connectedPath.push(marker, projected);
    });
    connectedPath.push(path[index + 1]);
  }
  return connectedPath;
}

export default function GoogleMap({ polyline, markers, liveLocation, className = 'h-64 w-full rounded-2xl', zoom, center, snapMarkersToRoute = false, connectMarkersToRoute = false }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const liveMarkerRef = useRef<google.maps.Marker | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError('Google Maps API key not configured');
      return;
    }

    initLoader();
    Promise.all([
      importLibrary('maps'),
      importLibrary('geometry'),
    ]).then(() => {
      setLoaded(true);
    }).catch(() => {
      setError('Failed to load Google Maps');
    });
  }, []);

  // Initialize map once
  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstanceRef.current) return;

    const defaultCenter = center || { lat: 58.5953, lng: 25.0136 }; // Estonia
    const map = new google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: zoom || 7,
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ],
    });
    mapInstanceRef.current = map;
  }, [loaded, center, zoom]);

  // Update polyline and markers when props change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // Draw polyline
    let markerPositions = markers || [];
    if (polyline && google.maps.geometry) {
      const path = google.maps.geometry.encoding.decodePath(polyline);
      const pathLiterals = path.map((point) => ({ lat: point.lat(), lng: point.lng() }));
      if (snapMarkersToRoute) {
        markerPositions = markerPositions.map((marker) => ({
          ...marker,
          ...nearestPointOnPath(marker, pathLiterals),
        }));
      }
      const displayPath = connectMarkersToRoute
        ? connectPointsToRoute(pathLiterals, markerPositions)
        : path;
      const poly = new google.maps.Polyline({
        path: displayPath,
        strokeColor: '#F97316',
        strokeOpacity: 0.9,
        strokeWeight: 4,
        geodesic: true,
      });
      poly.setMap(map);
      polylineRef.current = poly;

      // Fit bounds to polyline + markers
      const bounds = new google.maps.LatLngBounds();
      displayPath.forEach(p => bounds.extend(p));
      markerPositions.forEach(m => bounds.extend({ lat: m.lat, lng: m.lng }));
      map.fitBounds(bounds, 40);
    } else if (markers && markers.length > 0) {
      // No polyline, but markers — fit to markers
      const bounds = new google.maps.LatLngBounds();
      markers.forEach(m => bounds.extend({ lat: m.lat, lng: m.lng }));
      map.fitBounds(bounds, 40);
    }

    // Draw markers
    if (markerPositions) {
      markerPositions.forEach(m => {
        const marker = new google.maps.Marker({
          position: { lat: m.lat, lng: m.lng },
          map,
          label: m.label ? { text: m.label, color: '#fff', fontSize: '11px', fontWeight: 'bold' } : undefined,
          icon: m.color ? {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: m.color === 'green' ? '#16a34a' : m.color === 'blue' ? '#2563eb' : m.color === 'orange' ? '#F97316' : '#ef4444',
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#fff',
            scale: 8,
          } : undefined,
        });
        markersRef.current.push(marker);
      });
    }
  }, [loaded, polyline, markers, snapMarkersToRoute, connectMarkersToRoute]);

  // Update live location marker
  useEffect(() => {
    if (!mapInstanceRef.current || !liveLocation) return;

    if (liveMarkerRef.current) {
      liveMarkerRef.current.setPosition(liveLocation);
    } else {
      liveMarkerRef.current = new google.maps.Marker({
        position: liveLocation,
        map: mapInstanceRef.current,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          fillColor: '#2563eb',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#fff',
          scale: 6,
          rotation: 0,
        },
        title: 'Driver location',
      });
    }

    mapInstanceRef.current.panTo(liveLocation);
  }, [liveLocation]);

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 text-sm text-gray-500`}>
        {error}
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100`}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-deliivo-orange" />
      </div>
    );
  }

  return <div ref={mapRef} className={className} />;
}
