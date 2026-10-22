import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { BusLocation } from '../hooks/useBusLocations';

export interface BusMapProps {
  busLocation?: BusLocation | null;
  busLocations?: BusLocation[];
  routeCoordinates?: { latitude: number; longitude: number }[];
  routeCoordinatesList?: { latitude: number; longitude: number }[][];
  onBusPress?: (bus: BusLocation) => void;
  getPinColor?: (bus: BusLocation) => string;
  routeStrokeColor?: string;
  stops?: { name: string; latitude: number; longitude: number }[];
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] }
];

export const BusMap: React.FC<BusMapProps> = ({
  busLocation,
  busLocations = [],
  routeCoordinates,
  routeCoordinatesList = [],
  onBusPress,
  getPinColor,
  routeStrokeColor = '#8B5CF6',
  stops = [],
}) => {
  const mapRef = useRef<MapView>(null);
  
  const allBuses = busLocation ? [busLocation, ...busLocations] : busLocations;
  const allRoutes = routeCoordinates ? [routeCoordinates, ...routeCoordinatesList] : routeCoordinatesList;

  const firstRoutePt = allRoutes.length > 0 && allRoutes[0].length > 0 ? allRoutes[0][0] : null;

  const initialRegion = allBuses.length > 0 ? {
    latitude: allBuses[0].latitude,
    longitude: allBuses[0].longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  } : firstRoutePt ? {
    latitude: firstRoutePt.latitude,
    longitude: firstRoutePt.longitude,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  } : {
    latitude: 34.08,
    longitude: 74.80,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  useEffect(() => {
    if (mapRef.current && allBuses.length > 1) {
      const coords = allBuses.map(b => ({ latitude: b.latitude, longitude: b.longitude }));
      mapRef.current.fitToCoordinates(coords, { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true });
    } else if (mapRef.current && (busLocation || allBuses.length === 1)) {
      const target = busLocation || allBuses[0];
      mapRef.current.animateToRegion({
        latitude: target.latitude,
        longitude: target.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    } else if (mapRef.current && allRoutes.length > 0 && allRoutes[0].length > 1) {
      mapRef.current.fitToCoordinates(allRoutes[0], { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true });
    }
  }, [busLocation, allBuses, allRoutes]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        customMapStyle={darkMapStyle}
        userInterfaceStyle="dark"
      >
        {allRoutes.map((route, i) => (
          <Polyline
            key={`route-${i}`}
            coordinates={route}
            strokeColor={routeStrokeColor}
            strokeWidth={5}
          />
        ))}
        {stops.map((stop, idx) => (
          <Marker
            key={`stop-${idx}`}
            coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
            title={stop.name}
            description={`Stop #${idx + 1}`}
            pinColor="#8B5CF6"
          />
        ))}
        {allBuses.map((bus) => (
          <Marker
            key={bus.busId}
            coordinate={{ latitude: bus.latitude, longitude: bus.longitude }}
            title={bus.busId}
            description={`Status: ${bus.status}`}
            rotation={bus.heading}
            pinColor={getPinColor ? getPinColor(bus) : (bus.status === 'sos' ? '#EF4444' : bus.status === 'delayed' ? '#F59E0B' : '#22C55E')}
            onPress={() => onBusPress?.(bus)}
          />
        ))}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
});
