import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { MapPin, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BusStop, LatLng } from '../types/trip';
import { Student } from '../types/fleet';

interface LiveMapProps {
  busLocation?: LatLng | null;
  heading?: number;
  height?: number;
  followBus?: boolean;
  pickupLocation?: LatLng | null;
  idleBuses?: { busNo: string; location: LatLng }[];
  stopStudentCounts?: Record<string, number>;
  students?: Student[];
  isolatedStopName?: string | null;
  onExpand?: () => void;
  routePath?: LatLng[];
  stops?: BusStop[];
}

export const LiveMap: React.FC<LiveMapProps> = ({
  height,
  stops = [],
  students = [],
  isolatedStopName = null,
}) => {
  const { colors, roundness } = useAppTheme();
  const [dropoffStatus, setDropoffStatus] = useState<Record<string, 'dropped' | 'not_dropped'>>({});

  useEffect(() => {
    let active = true;
    const pollStatus = async () => {
      try {
        const stored = await AsyncStorage.getItem('@raasta_dropoff_status');
        if (stored && active) {
          setDropoffStatus(JSON.parse(stored));
        }
      } catch (e) {}
    };

    const interval = setInterval(pollStatus, 1000);
    pollStatus();

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const visibleStops = isolatedStopName ? stops.filter(s => s.name === isolatedStopName) : stops;

  return (
    <View style={[styles.wrap, height !== undefined ? { height } : styles.fill, { borderRadius: roundness.lg, borderColor: colors.border, backgroundColor: colors.card }]}>
      {visibleStops.length > 0 ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 14, color: colors.textPrimary, marginBottom: 16 }}>
            {isolatedStopName ? 'Your Drop-off Location' : 'Live Route & Drop-off Status'}
          </Text>
          {visibleStops.map((stop, index) => {
            const statusKey = `stop_${stop.name}`;
            const status = dropoffStatus[statusKey];
            const stopStudents = students.filter(s => s.pickupStop === stop.name);
            
            let PinIcon = MapPin;
            let pinColor = colors.textSecondary;
            
            if (status === 'dropped') {
              PinIcon = CheckCircle2;
              pinColor = colors.success;
            } else if (status === 'not_dropped') {
              PinIcon = AlertCircle;
              pinColor = colors.danger;
            }

            return (
              <View key={stop.name} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ width: 2, backgroundColor: index === visibleStops.length - 1 ? 'transparent' : colors.border, position: 'absolute', left: 11, top: 24, bottom: -16 }} />
                <View style={{ backgroundColor: '#fff', borderRadius: 12 }}>
                  <PinIcon size={24} color={pinColor} />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={{ fontFamily: 'Poppins-Medium', color: colors.textPrimary, fontSize: 14 }}>
                    {stop.name}
                  </Text>
                  {stopStudents.length > 0 && !isolatedStopName && (
                    <Text style={{ fontSize: 11, color: colors.primary, fontFamily: 'Poppins-Medium', marginBottom: 2 }}>
                      Students: {stopStudents.map(s => s.name.split(' ')[0]).join(', ')}
                    </Text>
                  )}
                  {status ? (
                    <Text style={{ fontSize: 12, color: pinColor, fontFamily: 'Poppins-Medium' }}>
                      {status === 'dropped' ? '✓ Dropped' : '✕ Missing/Not Dropped'}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      Pending
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <MapPin size={40} color={colors.primary} />
          <Text style={{ marginTop: 12, color: colors.textPrimary, fontFamily: 'Poppins-Medium' }}>Map View</Text>
          <Text style={{ marginTop: 4, color: colors.textSecondary, fontSize: 12, textAlign: 'center', paddingHorizontal: 20 }}>
            Interactive map is optimized for the mobile app prototype.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  fill: { flex: 1 },
});
