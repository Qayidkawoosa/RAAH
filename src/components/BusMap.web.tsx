import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { GoogleMap, LoadScript, MarkerF, PolylineF } from '@react-google-maps/api';
import { BusMapProps } from './BusMap';
import { DEMO_STOPS } from '../constants/demoRoute';
import { BusLocation } from '../hooks/useBusLocations';

const containerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '12px',
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
];

const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

/**
 * Hook to dynamically load Leaflet CSS & JS into the DOM without external package dependencies.
 */
function useLeafletLoader() {
  const [loaded, setLoaded] = useState(() => {
    return typeof window !== 'undefined' && !!(window as any).L;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ((window as any).L) {
      setLoaded(true);
      return;
    }

    // Inject Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS_URL;
      document.head.appendChild(link);
    }

    // Inject custom styling for bus badges, dark mode controls, and tooltips
    if (!document.getElementById('leaflet-custom-styles')) {
      const style = document.createElement('style');
      style.id = 'leaflet-custom-styles';
      style.innerHTML = `
        .leaflet-bus-icon {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-stop-tooltip {
          background-color: rgba(15, 23, 42, 0.92) !important;
          color: #F8FAFC !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          font-size: 10px !important;
          font-weight: 600 !important;
          padding: 3px 7px !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
        }
        .leaflet-stop-tooltip::before {
          border-top-color: rgba(15, 23, 42, 0.92) !important;
        }
        .leaflet-bar {
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          border-radius: 8px !important;
          overflow: hidden !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
        }
        .leaflet-bar a {
          background-color: rgba(15, 23, 42, 0.9) !important;
          color: #F8FAFC !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        .leaflet-bar a:hover {
          background-color: rgba(30, 41, 59, 0.95) !important;
          color: #38BDF8 !important;
        }
        .leaflet-control-attribution {
          background: rgba(15, 23, 42, 0.75) !important;
          color: #94A3B8 !important;
          font-size: 9px !important;
          border-radius: 4px !important;
          padding: 2px 6px !important;
        }
        .leaflet-control-attribution a {
          color: #60A5FA !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Inject Leaflet JS
    let script = document.getElementById('leaflet-js') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = LEAFLET_JS_URL;
      script.async = true;
      document.head.appendChild(script);
    }

    const onLoad = () => setLoaded(true);
    script.addEventListener('load', onLoad);

    const interval = setInterval(() => {
      if ((window as any).L) {
        setLoaded(true);
        clearInterval(interval);
      }
    }, 100);

    return () => {
      script?.removeEventListener('load', onLoad);
      clearInterval(interval);
    };
  }, []);

  return loaded;
}

/**
 * Creates a custom HTML badge divIcon for Leaflet with glowing status border and bus icon.
 */
function createBusDivIcon(
  L: any,
  bus: BusLocation,
  getPinColor?: (bus: BusLocation) => string
) {
  const color = getPinColor
    ? getPinColor(bus)
    : bus.status === 'sos'
    ? '#EF4444'
    : bus.status === 'delayed'
    ? '#F59E0B'
    : '#10B981';

  const heading = bus.heading || 0;
  const speedOrTag =
    bus.speedKmh !== undefined && bus.speedKmh > 0
      ? `${bus.speedKmh} km/h`
      : bus.status === 'sos'
      ? 'SOS'
      : bus.status === 'delayed'
      ? 'DELAYED'
      : bus.busId.split('-').slice(-2).join('-');

  const html = `
    <div style="
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      padding: 3px 8px 3px 5px;
      border-radius: 9999px;
      border: 2px solid ${color};
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5), 0 0 10px ${color}88;
      cursor: pointer;
      transform: translate(-50%, -50%);
      white-space: nowrap;
      user-select: none;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: transform 0.15s ease-out;
    ">
      <div style="
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transform: rotate(${heading}deg);
        box-shadow: 0 0 8px ${color}aa;
      ">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
          <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
        </svg>
      </div>
      <div style="display: flex; flex-direction: column; text-align: left; line-height: 1.1;">
        <span style="font-size: 11px; font-weight: 700; color: #F8FAFC; letter-spacing: 0.2px;">${bus.busId}</span>
        <span style="font-size: 8.5px; font-weight: 600; color: ${color}; text-transform: uppercase;">${speedOrTag}</span>
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'leaflet-bus-icon',
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/**
 * Free OpenStreetMap interactive web map via Leaflet.
 * Rendered when no Google Maps API key is configured.
 */
const LeafletWebMap: React.FC<BusMapProps> = ({
  busLocation,
  busLocations = [],
  routeCoordinates,
  routeCoordinatesList = [],
  onBusPress,
  getPinColor,
}) => {
  const leafletLoaded = useLeafletLoader();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, { marker: any; bus: BusLocation }>>(new Map());
  const polylinesRef = useRef<any[]>([]);
  const stopsRef = useRef<any[]>([]);
  const onBusPressRef = useRef(onBusPress);
  onBusPressRef.current = onBusPress;

  const allBuses = useMemo(() => {
    return busLocation ? [busLocation, ...busLocations] : busLocations;
  }, [busLocation, busLocations]);

  const allRoutes = useMemo(() => {
    return routeCoordinates
      ? [routeCoordinates, ...routeCoordinatesList]
      : routeCoordinatesList;
  }, [routeCoordinates, routeCoordinatesList]);

  const primaryBus = allBuses[0] || null;

  // Initialize Leaflet map centered on Srinagar (34.0837, 74.7973)
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || mapInstanceRef.current || !(window as any).L) {
      return;
    }

    const L = (window as any).L;

    const map = L.map(mapContainerRef.current, {
      center: [34.0837, 74.7973],
      zoom: 13,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // OpenStreetMap Tile Layer
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    // Handle container dimension updates dynamically
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      ro = new ResizeObserver(() => {
        map.invalidateSize();
      });
      ro.observe(mapContainerRef.current);
    }

    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timeout);
      ro?.disconnect();
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();
      polylinesRef.current.forEach((p) => p.remove());
      polylinesRef.current = [];
      stopsRef.current.forEach((s) => s.remove());
      stopsRef.current = [];
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [leafletLoaded]);

  // Render demo bus stops with tooltips
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !(window as any).L) return;
    const L = (window as any).L;

    stopsRef.current.forEach((s) => s.remove());
    stopsRef.current = [];

    DEMO_STOPS.forEach((stop) => {
      const stopMarker = L.circleMarker([stop.location.latitude, stop.location.longitude], {
        radius: 4.5,
        color: '#FFFFFF',
        weight: 1.5,
        fillColor: '#3B82F6',
        fillOpacity: 0.9,
      }).addTo(map);

      stopMarker.bindTooltip(stop.name, {
        direction: 'top',
        offset: [0, -6],
        className: 'leaflet-stop-tooltip',
      });

      stopsRef.current.push(stopMarker);
    });
  }, [leafletLoaded]);

  // Draw active routes using L.polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !(window as any).L) return;
    const L = (window as any).L;

    polylinesRef.current.forEach((p) => p.remove());
    polylinesRef.current = [];

    allRoutes.forEach((route) => {
      if (route && route.length > 0) {
        const latLngs = route.map((pt) => [pt.latitude, pt.longitude] as [number, number]);

        const glowLine = L.polyline(latLngs, {
          color: '#8B5CF6',
          weight: 7,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        const mainLine = L.polyline(latLngs, {
          color: '#A78BFA',
          weight: 3.5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        polylinesRef.current.push(glowLine, mainLine);
      }
    });
  }, [allRoutes, leafletLoaded]);

  // Render bus pins with custom HTML badges and update coordinates dynamically using marker.setLatLng()
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !(window as any).L) return;
    const L = (window as any).L;

    const currentBusIds = new Set(allBuses.map((b) => b.busId));

    // Clean up markers no longer active
    markersRef.current.forEach(({ marker }, id) => {
      if (!currentBusIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Update or create markers
    allBuses.forEach((bus) => {
      const existing = markersRef.current.get(bus.busId);
      if (existing) {
        existing.marker.setLatLng([bus.latitude, bus.longitude]);
        if (
          existing.bus.status !== bus.status ||
          existing.bus.speedKmh !== bus.speedKmh ||
          existing.bus.heading !== bus.heading
        ) {
          existing.marker.setIcon(createBusDivIcon(L, bus, getPinColor));
        }
        existing.bus = bus;
      } else {
        const marker = L.marker([bus.latitude, bus.longitude], {
          icon: createBusDivIcon(L, bus, getPinColor),
          zIndexOffset: 1000,
        }).addTo(map);

        marker.on('click', () => {
          const current = markersRef.current.get(bus.busId);
          onBusPressRef.current?.(current ? current.bus : bus);
        });

        markersRef.current.set(bus.busId, { marker, bus });
      }
    });
  }, [allBuses, getPinColor, leafletLoaded]);

  // Smoothly center when focused on a single bus
  const focusedBusIdRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !busLocation) return;
    if (focusedBusIdRef.current !== busLocation.busId) {
      focusedBusIdRef.current = busLocation.busId;
      map.panTo([busLocation.latitude, busLocation.longitude], { animate: true });
    }
  }, [busLocation]);

  return (
    <View style={styles.vectorContainer}>
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          backgroundColor: '#0B132B',
        }}
      />

      {!leafletLoaded && (
        <View style={styles.loadingOverlay}>
          <View style={styles.liveDot} />
          <Text style={styles.hudText}>LOADING OPENSTREETMAP...</Text>
        </View>
      )}

      {/* Live HUD Overlay */}
      <View style={styles.hudBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.hudText}>
          {primaryBus ? `${primaryBus.busId} · LIVE GPS` : 'LIVE GPS · OPENSTREETMAP'}
        </Text>
      </View>

      {primaryBus && (
        <View style={styles.coordsBadge}>
          <Text style={styles.coordsText}>
            {primaryBus.latitude.toFixed(4)}°N, {primaryBus.longitude.toFixed(4)}°E
          </Text>
        </View>
      )}
    </View>
  );
};

export const BusMap: React.FC<BusMapProps> = (props) => {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // If a valid Google Maps API Key is configured, use Google Maps.
  // Otherwise, use Leaflet OpenStreetMap as the default web map.
  if (apiKey && apiKey.trim().length > 10) {
    const mapRef = useRef<any>(null);
    const allBuses = props.busLocation
      ? [props.busLocation, ...(props.busLocations || [])]
      : props.busLocations || [];
    const allRoutes = props.routeCoordinates
      ? [props.routeCoordinates, ...(props.routeCoordinatesList || [])]
      : props.routeCoordinatesList || [];

    const center = useMemo(() => {
      return allBuses.length > 0
        ? { lat: allBuses[0].latitude, lng: allBuses[0].longitude }
        : { lat: 34.08, lng: 74.80 };
    }, [allBuses]);

    return (
      <View style={styles.container}>
        <LoadScript googleMapsApiKey={apiKey}>
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={14}
            options={{ styles: darkMapStyle, disableDefaultUI: true }}
            onLoad={(map) => {
              mapRef.current = map;
            }}
          >
            {allRoutes.map((route, i) => (
              <PolylineF
                key={`route-${i}`}
                path={route.map((c) => ({ lat: c.latitude, lng: c.longitude }))}
                options={{ strokeColor: '#8B5CF6', strokeWeight: 4 }}
              />
            ))}
            {allBuses.map((bus) => (
              <MarkerF
                key={bus.busId}
                position={{ lat: bus.latitude, lng: bus.longitude }}
                title={bus.busId}
                onClick={() => props.onBusPress?.(bus)}
              />
            ))}
          </GoogleMap>
        </LoadScript>
      </View>
    );
  }

  return <LeafletWebMap {...props} />;
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    borderRadius: 12,
    overflow: 'hidden',
  },
  vectorContainer: {
    ...StyleSheet.absoluteFill,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0B132B',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0B132B',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    zIndex: 999,
  },
  hudBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 1001,
    pointerEvents: 'none',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  hudText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'system-ui, sans-serif',
  },
  coordsBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 1001,
    pointerEvents: 'none',
  },
  coordsText: {
    color: '#94A3B8',
    fontSize: 9,
    fontFamily: 'monospace',
  },
});

export default BusMap;
