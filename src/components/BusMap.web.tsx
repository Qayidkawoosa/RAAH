import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { GoogleMap, LoadScript, MarkerF, PolylineF } from '@react-google-maps/api';
import { BusMapProps } from './BusMap';

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

export const BusMap: React.FC<BusMapProps> = ({
  busLocation,
  busLocations = [],
  routeCoordinates,
  routeCoordinatesList = [],
  onBusPress,
  getPinColor,
}) => {
  const mapRef = useRef<google.maps.Map | null>(null);

  const allBuses = busLocation ? [busLocation, ...busLocations] : busLocations;
  const allRoutes = routeCoordinates ? [routeCoordinates, ...routeCoordinatesList] : routeCoordinatesList;

  const center = useMemo(() => {
    return allBuses.length > 0
      ? { lat: allBuses[0].latitude, lng: allBuses[0].longitude }
      : { lat: 34.08, lng: 74.80 };
  }, [allBuses]);

  const mapOptions = useMemo(
    () => ({
      styles: darkMapStyle,
      disableDefaultUI: true,
    }),
    []
  );

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const onLoad = (map: google.maps.Map) => {
    mapRef.current = map;
    if (allBuses.length > 1 && window.google?.maps?.LatLngBounds) {
      const bounds = new window.google.maps.LatLngBounds();
      allBuses.forEach((b) => bounds.extend({ lat: b.latitude, lng: b.longitude }));
      map.fitBounds(bounds);
    }
  };

  useEffect(() => {
    if (mapRef.current && busLocation) {
      mapRef.current.panTo({ lat: busLocation.latitude, lng: busLocation.longitude });
    }
  }, [busLocation]);

  return (
    <View style={styles.container}>
      <LoadScript googleMapsApiKey={apiKey}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={14}
          options={mapOptions}
          onLoad={onLoad}
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
              onClick={() => onBusPress?.(bus)}
              icon={{
                path: 'M2,2 L22,12 L2,22 L6,12 Z',
                fillColor: getPinColor
                  ? getPinColor(bus)
                  : bus.status === 'sos'
                  ? '#EF4444'
                  : bus.status === 'delayed'
                  ? '#F59E0B'
                  : '#22C55E',
                fillOpacity: 1,
                strokeWeight: 1,
                rotation: bus.heading,
                scale: 1,
              }}
            />
          ))}
        </GoogleMap>
      </LoadScript>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    overflow: 'hidden',
  },
});

export default BusMap;
