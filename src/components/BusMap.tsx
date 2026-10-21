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
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] }
];

export const BusMap: React.FC<BusMapProps> = ({ busLocation, busLocations = [], routeCoordinates, routeCoordinatesList = [], onBusPress, getPinColor }) => {
  const mapRef = useRef<MapView>(null);
  
  const allBuses = busLocation ? [busLocation, ...busLocations] : busLocations;
  const allRoutes = routeCoordinates ? [routeCoordinates, ...routeCoordinatesList] : routeCoordinatesList;

  const initialRegion = allBuses.length > 0 ? {
    latitude: allBuses[0].latitude,
    longitude: allBuses[0].longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
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
    }
  }, [busLocation, allBuses]);

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
            strokeColor="#8B5CF6"
            strokeWidth={4}
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
