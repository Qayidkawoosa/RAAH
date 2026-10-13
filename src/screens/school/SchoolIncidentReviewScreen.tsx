import React, { useState, useEffect } from 'react';
import { Text, View, Alert, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppCard } from '../../components/ui/AppCard';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { Badge } from '../../components/ui/Badge';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';
import { SafetyEvent } from '../../types/fleet';
import { AppStackParamList } from '../../navigation/types';
import { tripService } from '../../services/tripService';
import { dmsEngine } from '../../services/dms/dmsEngine';
import { dmsTelemetryBus } from '../../services/dms/dmsTelemetryBus';

// Default initial events for the Queue
const mockQueueEvents: SafetyEvent[] = [
  {
    event_id: 'ev_001', trip_id: 't_123', bus_id: 'JK01-1234', driver_id: 'd_001', school_id: 'sch_1',
    source: 'cabin_cam', type: 'overcrowding', severity: 'warn', confidence: 0.88, status: 'auto_flagged',
    detected_at: new Date().toISOString(), lat: 0, lng: 0, speed_kmph: 40, duration_ms: 1000,
    clip_ref: null, thumbnail_ref: null, reviewed_by: null, reviewed_at: null, review_note: null
  },
  {
    event_id: 'ev_002', trip_id: 't_123', bus_id: 'JK01-9988', driver_id: 'd_002', school_id: 'sch_1',
    source: 'driver_cam', type: 'drowsiness', severity: 'critical', confidence: 0.92, status: 'auto_flagged',
    detected_at: new Date(Date.now() - 50000).toISOString(), lat: 0, lng: 0, speed_kmph: 60, duration_ms: 3000,
    clip_ref: null, thumbnail_ref: null, reviewed_by: null, reviewed_at: null, review_note: null
  }
];

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export const SchoolIncidentReviewScreen: React.FC = () => {
  const { colors, spacing } = useAppTheme();
  const navigation = useNavigation<Navigation>();
  const [queue, setQueue] = useState<SafetyEvent[]>(mockQueueEvents);

  useEffect(() => {
    let isMounted = true;
    // Load persisted safety events
    tripService.getSafetyEvents().then(persisted => {
      if (isMounted && persisted && persisted.length > 0) {
        setQueue(prev => {
          const ids = new Set(persisted.map(p => p.event_id));
          const unflagged = prev.filter(p => !ids.has(p.event_id));
          return [...persisted, ...unflagged];
        });
      }
    });

    // Real-time listener for incoming DMS safety events (local + cross-tab)
    const unsubscribeBus = dmsTelemetryBus.subscribeToSafetyEvents((event) => {
      if (isMounted) {
        setQueue(prev => [event, ...prev.filter(e => e.event_id !== event.event_id)]);
      }
    });

    // In-memory fallback
    const unsubscribeLocal = dmsEngine.onSafetyEvent((event) => {
      if (isMounted) {
        setQueue(prev => [event, ...prev.filter(e => e.event_id !== event.event_id)]);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeBus();
      unsubscribeLocal();
    };
  }, []);

  const handleAction = async (event_id: string, action: 'confirmed' | 'dismissed') => {
    setQueue(prev => prev.filter(e => e.event_id !== event_id));
    try {
      await tripService.updateSafetyEventStatus(event_id, action);
    } catch {
      // Continue anyway
    }
    Alert.alert(`Event ${action}`, `The event has been ${action}.`);
  };

  const renderEvent = (event: SafetyEvent) => (
    <AppCard key={event.event_id} style={{ marginBottom: spacing.md, padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={[typography.titleMedium, { color: colors.textPrimary, textTransform: 'capitalize' }]}>
          {event.type.replace('_', ' ')}
        </Text>
        <Badge 
          label={event.severity} 
          tone={event.severity === 'critical' ? 'danger' : event.severity === 'warn' ? 'warning' : 'info'} 
        />
      </View>
      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Bus: {event.bus_id} | Confidence: {(event.confidence * 100).toFixed(0)}%</Text>
      <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 10 }]}>Time: {new Date(event.detected_at).toLocaleTimeString()}</Text>

      {/* Incident Camera Evidence Screenshot */}
      {event.thumbnail_ref ? (
        <View style={{ height: 160, borderRadius: 8, overflow: 'hidden', marginBottom: 14, backgroundColor: '#000', borderWidth: 1, borderColor: colors.border }}>
          <Image
            source={{ uri: event.thumbnail_ref }}
            style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
          />
          <View style={{ position: 'absolute', bottom: 6, right: 8, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>INCIDENT SNAPSHOT</Text>
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <PrimaryButton 
          label="Dismiss" 
          variant="outline" 
          onPress={() => handleAction(event.event_id, 'dismissed')} 
          style={{ flex: 1 }} 
        />
        <PrimaryButton 
          label="Confirm" 
          variant="gradient" 
          onPress={() => handleAction(event.event_id, 'confirmed')} 
          style={{ flex: 1 }} 
        />
      </View>
    </AppCard>
  );

  return (
    <ScreenContainer>
      <ScreenHeader 
        title="Incident Review Queue" 
        subtitle={`${queue.length} events pending`} 
        showBrand 
        onBack={() => navigation.goBack()} 
      />
      
      <View style={{ paddingBottom: 40 }}>
        {queue.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={[typography.titleMedium, { color: colors.textSecondary }]}>Queue is empty</Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>All auto-flagged events have been reviewed.</Text>
            <PrimaryButton label="Back to Dashboard" onPress={() => navigation.goBack()} variant="outline" style={{ marginTop: 24 }} />
          </View>
        ) : (
          queue.map(renderEvent)
        )}
      </View>
    </ScreenContainer>
  );
};

export default SchoolIncidentReviewScreen;
