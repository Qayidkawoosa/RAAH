import React, { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { History } from 'lucide-react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { TripCard } from '../../components/TripCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { tripService } from '../../services/tripService';
import { Trip } from '../../types/trip';
import { useAuth } from '../../context/AuthContext';
import { AppStackParamList } from '../../navigation/types';
import { DEMO_BUS_NO } from '../../constants/demoRoute';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const TripHistoryScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<Navigation>();
  const [trips, setTrips] = useState<Trip[] | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!user) return;
    try {
      const history = await tripService.getTripHistory(
        user.uid,
        user.name,
        user.vehicleNo ?? user.assignedBusNo ?? DEMO_BUS_NO
      );
      setTrips(history);
    } catch {
      setTrips([]);
    }
  }, [user]);

  // Reload whenever the tab regains focus so a just-completed trip appears
  // immediately; pull-to-refresh covers the rest.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScreenContainer onRefresh={load}>
      <ScreenHeader title="Trip History" subtitle="Every trip, scored by the AI copilot" showBrand />
      {trips === null ? (
        <>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={86} style={{ marginBottom: 12 }} />
          ))}
        </>
      ) : trips.length === 0 ? (
        <EmptyState icon={History} title="No trips yet" message="Completed trips will appear here with their AI safety analysis." />
      ) : (
        trips.map((trip) => (
          <TripCard key={trip.id} trip={trip} onPress={(t) => navigation.navigate('TripDetail', { trip: t })} />
        ))
      )}
    </ScreenContainer>
  );
};

export default TripHistoryScreen;
