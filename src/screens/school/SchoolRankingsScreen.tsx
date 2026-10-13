import React, { useCallback, useEffect, useState } from 'react';
import { Trophy } from 'lucide-react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { RankingRow } from '../../components/RankingRow';
import { tripService } from '../../services/tripService';
import { DriverRanking } from '../../types/fleet';

const SchoolRankingsScreen: React.FC = () => {
  const [rankings, setRankings] = useState<DriverRanking[] | null>(null);

  const load = useCallback(async (): Promise<void> => {
    await tripService
      .getRankings()
      .then(setRankings)
      .catch(() => setRankings([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScreenContainer onRefresh={load}>
      <ScreenHeader title="Driver Rankings" subtitle="AI safety scores across the fleet" showBrand />
      {rankings === null ? (
        [0, 1, 2, 3].map((i) => <Skeleton key={i} height={72} style={{ marginBottom: 10 }} />)
      ) : rankings.length === 0 ? (
        <EmptyState icon={Trophy} title="No rankings yet" message="Driver safety rankings appear after the first scored trips." />
      ) : (
        rankings.map((ranking, index) => (
          <RankingRow key={ranking.driverId} ranking={ranking} position={index + 1} />
        ))
      )}
    </ScreenContainer>
  );
};

export default SchoolRankingsScreen;
