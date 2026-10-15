import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { GoogleMap, LoadScript, MarkerF, PolylineF } from '@react-google-maps/api';
import { BusMapProps } from './BusMap';
import { DEMO_STOPS } from '../constants/demoRoute';

const containerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '12px',
};

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
];

/**
 * High-performance vector map for Web testing and deterministic offline demos.
 * Renders Dal Lake, Srinagar roads, stops, and real-time moving buses with zero API keys.
 */
const OfflineVectorWebMap: React.FC<BusMapProps> = ({
  busLocation,
  busLocations = [],
  routeCoordinates,
  routeCoordinatesList = [],
  onBusPress,
  getPinColor,
}) => {
  const allBuses = useMemo(() => {
    return busLocation ? [busLocation, ...busLocations] : busLocations;
  }, [busLocation, busLocations]);

  const allRoutes = useMemo(() => {
    return routeCoordinates ? [routeCoordinates, ...routeCoordinatesList] : routeCoordinatesList;
  }, [routeCoordinates, routeCoordinatesList]);

  // Compute Srinagar bounding box dynamically from route coordinates
  const bounds = useMemo(() => {
    let minLat = 34.06;
    let maxLat = 34.15;
    let minLng = 74.78;
    let maxLng = 74.88;

    const allPts = allRoutes.flat();
    if (allPts.length > 0) {
      minLat = Math.min(...allPts.map((p) => p.latitude));
      maxLat = Math.max(...allPts.map((p) => p.latitude));
      minLng = Math.min(...allPts.map((p) => p.longitude));
      maxLng = Math.max(...allPts.map((p) => p.longitude));
    }

    const padLat = (maxLat - minLat) * 0.15 || 0.01;
    const padLng = (maxLng - minLng) * 0.15 || 0.01;

    return {
      minLat: minLat - padLat,
      maxLat: maxLat + padLat,
      minLng: minLng - padLng,
      maxLng: maxLng + padLng,
    };
  }, [allRoutes]);

  const WIDTH = 600;
  const HEIGHT = 320;

  // Project geographic coordinates (lat, lng) to SVG pixel space
  const project = (lat: number, lng: number) => {
    const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * WIDTH;
    const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * HEIGHT;
    return {
      x: Math.max(10, Math.min(WIDTH - 10, x)),
      y: Math.max(10, Math.min(HEIGHT - 10, y)),
    };
  };

  const primaryBus = allBuses[0] || null;

  return (
    <View style={styles.vectorContainer}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0B132B" />
            <stop offset="100%" stopColor="#1C2541" />
          </linearGradient>

          <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1F3A60" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#14213D" stopOpacity="0.95" />
          </linearGradient>

          <filter id="busGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
            <feFlood floodColor="#8B5CF6" floodOpacity="0.6" result="flood" />
            <feComposite in="flood" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Map Background */}
        <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="url(#bgGrad)" />

        {/* Stylized Grid Lines */}
        {Array.from({ length: 7 }).map((_, i) => (
          <line
            key={`grid-x-${i}`}
            x1={(i + 1) * (WIDTH / 8)}
            y1="0"
            x2={(i + 1) * (WIDTH / 8)}
            y2={HEIGHT}
            stroke="#ffffff"
            strokeOpacity="0.04"
            strokeDasharray="4 4"
          />
        ))}
        {Array.from({ length: 4 }).map((_, i) => (
          <line
            key={`grid-y-${i}`}
            x1="0"
            y1={(i + 1) * (HEIGHT / 5)}
            x2={WIDTH}
            y2={(i + 1) * (HEIGHT / 5)}
            stroke="#ffffff"
            strokeOpacity="0.04"
            strokeDasharray="4 4"
          />
        ))}

        {/* Stylized Dal Lake Water Silhouette */}
        <path
          d={`M ${WIDTH * 0.45} ${HEIGHT * 0.15} Q ${WIDTH * 0.65} ${HEIGHT * 0.18} ${WIDTH * 0.72} ${HEIGHT * 0.42} Q ${WIDTH * 0.75} ${HEIGHT * 0.68} ${WIDTH * 0.58} ${HEIGHT * 0.75} Q ${WIDTH * 0.42} ${HEIGHT * 0.65} ${WIDTH * 0.40} ${HEIGHT * 0.45} Z`}
          fill="url(#waterGrad)"
          stroke="#3A86FF"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />
        <text
          x={WIDTH * 0.56}
          y={HEIGHT * 0.45}
          fill="#60A5FA"
          fontSize="11"
          fontWeight="600"
          letterSpacing="2"
          textAnchor="middle"
          opacity="0.6"
          fontFamily="system-ui, sans-serif"
        >
          DAL LAKE · دال جھیل
        </text>

        {/* Route Polylines */}
        {allRoutes.map((route, rIdx) => {
          if (!route || route.length === 0) return null;
          const pathD = route
            .map((pt, pIdx) => {
              const { x, y } = project(pt.latitude, pt.longitude);
              return `${pIdx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(' ');

          return (
            <g key={`route-group-${rIdx}`}>
              {/* Outer Glow */}
              <path
                d={pathD}
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="6"
                strokeOpacity="0.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Main Route Line */}
              <path
                d={pathD}
                fill="none"
                stroke="#A78BFA"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#routeGlow)"
              />
            </g>
          );
        })}

        {/* Key Bus Stops */}
        {DEMO_STOPS.map((stop, idx) => {
          const { x, y } = project(stop.location.latitude, stop.location.longitude);
          return (
            <g key={`stop-${idx}`}>
              <circle cx={x} cy={y} r="5" fill="#3B82F6" stroke="#ffffff" strokeWidth="1.5" />
              <text
                x={x + 7}
                y={y + 3}
                fill="#E2E8F0"
                fontSize="9"
                fontWeight="500"
                fontFamily="system-ui, sans-serif"
                opacity="0.85"
              >
                {stop.name}
              </text>
            </g>
          );
        })}

        {/* Moving Bus Markers */}
        {allBuses.map((bus) => {
          const { x, y } = project(bus.latitude, bus.longitude);
          const color = getPinColor
            ? getPinColor(bus)
            : bus.status === 'sos'
            ? '#EF4444'
            : bus.status === 'delayed'
            ? '#F59E0B'
            : '#10B981';

          return (
            <g
              key={bus.busId}
              transform={`translate(${x}, ${y})`}
              style={{ cursor: 'pointer', transition: 'transform 0.4s ease-out' }}
              onClick={() => onBusPress?.(bus)}
            >
              {/* Pulsing Radar Ring */}
              <circle cx="0" cy="0" r="16" fill={color} fillOpacity="0.2">
                <animate
                  attributeName="r"
                  values="10;22;10"
                  dur="2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="fill-opacity"
                  values="0.35;0.05;0.35"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>

              {/* Direction Indicator */}
              <g transform={`rotate(${bus.heading || 0})`}>
                <polygon
                  points="0,-14 9,10 0,6 -9,10"
                  fill={color}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  filter="url(#busGlow)"
                />
              </g>

              {/* Bus Center Dot */}
              <circle cx="0" cy="0" r="4.5" fill="#FFFFFF" />

              {/* Speed / Bus ID Tag */}
              <g transform="translate(14, -8)">
                <rect
                  x="0"
                  y="-10"
                  width="72"
                  height="18"
                  rx="4"
                  fill="#0F172A"
                  fillOpacity="0.88"
                  stroke={color}
                  strokeWidth="1"
                />
                <text
                  x="36"
                  y="2"
                  fill="#F8FAFC"
                  fontSize="8.5"
                  fontWeight="bold"
                  fontFamily="system-ui, sans-serif"
                  textAnchor="middle"
                >
                  {bus.speedKmh ? `${bus.speedKmh} km/h` : bus.busId.split('-').slice(-2).join('-')}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* Live HUD Overlay */}
      <View style={styles.hudBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.hudText}>
          {primaryBus ? `${primaryBus.busId} · LIVE GPS` : 'OFFLINE GPS SIMULATION'}
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
  // Otherwise, use the built-in deterministic Offline Vector Web Map.
  if (apiKey && apiKey.trim().length > 10) {
    const mapRef = useRef<google.maps.Map | null>(null);
    const allBuses = props.busLocation ? [props.busLocation, ...(props.busLocations || [])] : (props.busLocations || []);
    const allRoutes = props.routeCoordinates ? [props.routeCoordinates, ...(props.routeCoordinatesList || [])] : (props.routeCoordinatesList || []);

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
            onLoad={(map) => { mapRef.current = map; }}
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

  return <OfflineVectorWebMap {...props} />;
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    overflow: 'hidden',
  },
  vectorContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0B132B',
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
  },
  coordsText: {
    color: '#94A3B8',
    fontSize: 9,
    fontFamily: 'monospace',
  },
});

export default BusMap;
