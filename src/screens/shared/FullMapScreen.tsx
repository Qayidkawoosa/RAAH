import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { LiveMap } from '../../components/LiveMap';
import { Badge } from '../../components/ui/Badge';
import { useBusTracking } from '../../hooks/useBusTracking';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';
import { ALL_ROUTES } from '../../constants/demoRoute';
import { AppStackParamList } from '../../navigation/types';
import { tripService } from '../../services/tripService';
import { LatLng } from '../../types/trip';
import { formatSpeed } from '../../utils/format';
import { busStatusBadge } from '../../utils/busStatus';

type FullMapRoute = RouteProp<AppStackParamList, 'FullMap'>;

/** Edge-to-edge live map: route, stops, live bus, pickup, parked fleet. */
const FullMapScreen: React.FC = () => {
  const { params } = useRoute<FullMapRoute>();
  const navigation = useNavigation();
  const { colors, shadows } = useAppTheme();
  const { bus } = useBusTracking(params.busNo);

  const routeConfig = ALL_ROUTES.find((r) => r.busNo === params.busNo) ?? ALL_ROUTES[0];
  const pickup = routeConfig.stops.find((stop) => stop.name === params.pickupStopName);
  const [idleBuses, setIdleBuses] = useState<{ busNo: string; location: LatLng }[]>([]);
  const [stopCounts, setStopCounts] = useState<Record<string, number>>({});

  // Pill on each stop = how many students of this bus board there.
  useEffect(() => {
    tripService
      .getStudents()
      .then((students) => {
        const counts: Record<string, number> = {};
        students
          .filter((student) => student.busNo === params.busNo && student.pickupStop)
          .forEach((student) => {
            counts[student.pickupStop as string] = (counts[student.pickupStop as string] ?? 0) + 1;
          });
        setStopCounts(counts);
      })
      .catch(() => setStopCounts({}));
  }, [params.busNo]);

  // Other fleet buses are parked at the school; spread them slightly so the
  // markers don't stack on one point.
  useEffect(() => {
    const school = routeConfig.stops[routeConfig.stops.length - 1].location;
    tripService
      .getFleet()
      .then((fleet) =>
        setIdleBuses(
          fleet
            .filter((fleetBus) => fleetBus.busNo !== params.busNo)
            .map((fleetBus, index) => ({
              busNo: fleetBus.busNo,
              location: {
                latitude: school.latitude + 0.0006,
                longitude: school.longitude + 0.0009 * (index + 1),
              },
            }))
        )
      )
      .catch(() => setIdleBuses([]));
  }, [params.busNo, routeConfig]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.mapWrap}>
        <LiveMap
          busLocation={bus?.location ?? null}
          heading={bus?.heading ?? 0}
          pickupLocation={pickup?.location ?? null}
          idleBuses={idleBuses}
          stopStudentCounts={stopCounts}
          routePath={routeConfig.path}
          stops={routeConfig.stops}
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={[styles.back, shadows.md, { backgroundColor: colors.card }]}
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        {bus ? (
          <View style={[styles.status, shadows.md, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.statusText}>
              <Text style={[typography.titleMedium, { color: colors.textPrimary }]} numberOfLines={1}>
                {params.busNo}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
                {formatSpeed(bus.speedKmh)} · next stop {bus.nextStop}
                {bus.etaMinutes > 0 ? ` · ${bus.etaMinutes} min` : ''}
              </Text>
            </View>
            <Badge {...busStatusBadge(bus.status, 'rto')} />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  mapWrap: { flex: 1 },
  back: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusText: { flex: 1, paddingRight: 10 },
});

export default FullMapScreen;
