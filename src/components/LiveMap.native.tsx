import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Region, Details } from 'react-native-maps';

let MapView: any;
let Circle: any;
let Marker: any;
let Polyline: any;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Circle = Maps.Circle;
  Marker = Maps.Marker;
  Polyline = Maps.Polyline;
}
import { Bus, MapPin, Maximize2 } from 'lucide-react-native';
import { LatLng, BusStop } from '../types/trip';
import { DEMO_REGION, DEMO_ROUTE_PATH, DEMO_STOPS } from '../constants/demoRoute';
import { useAppTheme } from '../hooks/useAppTheme';

interface LiveMapProps {
  busLocation: LatLng | null;
  heading?: number;
  /** Fixed height; omit to fill the parent container (full-screen view). */
  height?: number;
  followBus?: boolean;
  /** Highlights the parent's chosen pickup stop. */
  pickupLocation?: LatLng | null;
  /** Parked buses to show as muted markers (full-map fleet view). */
  idleBuses?: { busNo: string; location: LatLng }[];
  /** Students boarding at each stop, keyed by stop name. */
  stopStudentCounts?: Record<string, number>;
  /** Shows an expand button that opens the full-screen map. */
  onExpand?: () => void;
  /** Custom route path polyline points. */
  routePath?: LatLng[];
  /** Custom route stops. */
  stops?: BusStop[];
}

/** How long the camera leaves the map alone after the user pans or zooms. */
const GESTURE_GRACE_MS = 12_000;

/** Shared map: real road route, stops, live bus, optional pickup point. */
export const LiveMap: React.FC<LiveMapProps> = ({
  busLocation,
  heading = 0,
  height,
  followBus = true,
  pickupLocation = null,
  idleBuses = [],
  stopStudentCounts,
  onExpand,
  routePath = DEMO_ROUTE_PATH,
  stops = DEMO_STOPS,
}) => {
  const { colors, roundness, isDark, shadows } = useAppTheme();
  const mapRef = useRef<any>(null);
  const lastGestureAt = useRef(0);
  const hasCentered = useRef(false);

  useEffect(() => {
    if (!busLocation || !followBus) return;
    // Respect the user's gestures: pause auto-follow after a pan/zoom, and
    // never override their zoom level — only recenter.
    if (Date.now() - lastGestureAt.current < GESTURE_GRACE_MS) return;
    if (!hasCentered.current) {
      hasCentered.current = true;
      mapRef.current?.animateCamera({ center: busLocation, zoom: 14 }, { duration: 800 });
    } else {
      mapRef.current?.animateCamera({ center: busLocation }, { duration: 900 });
    }
  }, [busLocation, followBus]);

  const handleRegionChange = (_region: Region, details: Details): void => {
    if (details.isGesture) lastGestureAt.current = Date.now();
  };

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.wrap, height !== undefined ? { height } : styles.fill, { borderRadius: roundness.lg, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }]}>
        <MapPin size={40} color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.textPrimary, fontFamily: 'Poppins-Medium' }}>Map View</Text>
        <Text style={{ marginTop: 4, color: colors.textSecondary, fontSize: 12, textAlign: 'center', paddingHorizontal: 20 }}>
          Interactive map is optimized for the mobile app prototype.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        height !== undefined ? { height } : styles.fill,
        { borderRadius: roundness.lg, borderColor: colors.border },
      ]}
    >
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEMO_REGION}
        onRegionChangeComplete={handleRegionChange}
        showsCompass={false}
        toolbarEnabled={false}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
      >
        <Polyline coordinates={routePath} strokeColor={colors.primary} strokeWidth={4} />
        {stops.map((stop) => (
          <Circle
            key={stop.name}
            center={stop.location}
            radius={80}
            strokeColor={colors.primaryDark}
            fillColor={`${colors.primary}33`}
          />
        ))}
        {stopStudentCounts
          ? stops.filter((stop) => (stopStudentCounts[stop.name] ?? 0) > 0).map((stop) => (
              <Marker
                key={`count-${stop.name}`}
                coordinate={stop.location}
                anchor={{ x: 0.5, y: 2 }}
                title={`${stop.name}: ${stopStudentCounts[stop.name]} student${stopStudentCounts[stop.name] > 1 ? 's' : ''} board here`}
              >
                <View style={[styles.countPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.countText, { color: colors.textPrimary }]}>
                    {stopStudentCounts[stop.name]}
                  </Text>
                </View>
              </Marker>
            ))
          : null}
        {pickupLocation ? (
          <Marker coordinate={pickupLocation} anchor={{ x: 0.5, y: 1 }}>
            <View style={[styles.pickupMarker, { backgroundColor: colors.warning }]}>
              <MapPin size={15} color="#FFFFFF" strokeWidth={2.4} />
            </View>
          </Marker>
        ) : null}
        {idleBuses.map((idle) => (
          <Marker key={idle.busNo} coordinate={idle.location} anchor={{ x: 0.5, y: 0.5 }} title={`${idle.busNo} (parked)`}>
            <View style={[styles.idleMarker, { backgroundColor: colors.textSecondary }]}>
              <Bus size={13} color="#FFFFFF" strokeWidth={2.2} />
            </View>
          </Marker>
        ))}
        {busLocation ? (
          <Marker coordinate={busLocation} rotation={heading} anchor={{ x: 0.5, y: 0.5 }} flat>
            <View style={[styles.busMarker, { backgroundColor: colors.primary }]}>
              <Bus size={16} color="#FFFFFF" strokeWidth={2.2} />
            </View>
          </Marker>
        ) : null}
      </MapView>
      {onExpand ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open full map"
          onPress={onExpand}
          style={[styles.expand, shadows.sm, { backgroundColor: colors.card }]}
        >
          <Maximize2 size={16} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  fill: { flex: 1 },
  busMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  countPill: {
    minWidth: 24,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  countText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 11,
  },
  idleMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    opacity: 0.85,
  },
  pickupMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  expand: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
