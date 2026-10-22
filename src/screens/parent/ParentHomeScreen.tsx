import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BellRing, Gauge, MapPin, User, GraduationCap, CheckCircle2 } from 'lucide-react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppCard } from '../../components/ui/AppCard';
import { StatCard } from '../../components/ui/StatCard';
import { Badge } from '../../components/ui/Badge';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { Skeleton } from '../../components/ui/Skeleton';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { BusMap } from '../../components/BusMap';
import { ScheduleBanner } from '../../components/ScheduleBanner';
import { busStatusBadge } from '../../utils/busStatus';
import { useAuth } from '../../context/AuthContext';
import { useBusTracking } from '../../hooks/useBusTracking';
import { useBusLocations } from '../../hooks/useBusLocations';
import { usePickupProximity } from '../../hooks/usePickupProximity';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';
import { DEMO_BUS_NO, ALL_ROUTES } from '../../constants/demoRoute';
import { AppStackParamList } from '../../navigation/types';
import { Student } from '../../types/fleet';
import { tripService } from '../../services/tripService';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const PICKUP_KEY = '@raasta_pickup_stop';

const proximityMessage: Record<string, string> = {
  approaching: 'Bus arriving in 5 minutes — get ready.',
  imminent: 'Bus arriving in under 2 minutes — head to the stop now!',
  arrived: 'Bus has reached the pickup stop.',
  passed: 'Bus has passed this stop.',
};

const ParentHomeScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<Navigation>();
  const { colors, spacing } = useAppTheme();

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [pickupName, setPickupName] = useState<string | null>(null);

  const [linkCode, setLinkCode] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [showLinkCard, setShowLinkCard] = useState(false);

  const [dropoffStatus, setDropoffStatus] = useState<Record<string, 'dropped' | 'not_dropped'>>({});

  const loadDropoffStatus = async () => {
    try {
      const stored = await AsyncStorage.getItem('@raasta_dropoff_status');
      if (stored) {
        setDropoffStatus(JSON.parse(stored));
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadDropoffStatus();
    // Poll for drop-off notifications updated by the driver or system
    const interval = setInterval(loadDropoffStatus, 1500);
    return () => clearInterval(interval);
  }, []);

  const busNo = selectedStudent?.busNo ?? user?.assignedBusNo ?? DEMO_BUS_NO;
  const { bus, events } = useBusTracking(busNo);
  const { location: simLocation } = useBusLocations(busNo);

  const currentParentBusLocation = React.useMemo(() => {
    if (bus && bus.location) {
      return {
        busId: busNo,
        latitude: bus.location.latitude,
        longitude: bus.location.longitude,
        heading: bus.heading ?? 45,
        speedKmh: Math.round(bus.speedKmh ?? 0),
        status: (bus.status === 'active' ? 'on_route' : 'at_stop') as any,
        etaMinutes: bus.etaMinutes ?? 12,
        nextStopName: bus.nextStop ?? 'School',
        lastUpdated: bus.updatedAt ?? Date.now(),
        schoolName: user?.schoolName,
      };
    }
    return simLocation;
  }, [bus, simLocation, busNo, user]);

  const routeConfig = ALL_ROUTES.find((r) => r.busNo === busNo) ?? ALL_ROUTES[0];
  const PICKUP_STOPS = routeConfig.stops.slice(0, -1);

  const pickupStop = PICKUP_STOPS.find((stop) => stop.name === pickupName) ?? null;
  const proximity = usePickupProximity(bus, pickupStop);

  // When bus arrives at the pickup/drop-off stop, automatically register drop-off
  useEffect(() => {
    if (proximity.phase === 'arrived' && selectedStudent) {
      (async () => {
        try {
          const stored = await AsyncStorage.getItem('@raasta_dropoff_status');
          const current = stored ? JSON.parse(stored) : {};
          if (current[selectedStudent.id] !== 'dropped') {
            const updated = {
              ...current,
              [selectedStudent.id]: 'dropped',
              [`stop_${selectedStudent.pickupStop}`]: 'dropped',
            };
            setDropoffStatus(updated);
            await AsyncStorage.setItem('@raasta_dropoff_status', JSON.stringify(updated));
          }
        } catch (e) {}
      })();
    }
  }, [proximity.phase, selectedStudent]);

  const handleLinkChild = async () => {
    if (!user || !linkCode.trim()) return;
    setIsLinking(true);
    setLinkError(null);
    try {
      const code = linkCode.trim().toLowerCase();
      const allStudents = await tripService.getStudents();
      const formattedCode = code.replace('stu-', 'stu_');
      const targetCode = formattedCode.startsWith('stu_') ? formattedCode : `stu_${formattedCode}`;

      const matched = allStudents.find((s) => {
        const studentName = s.name.toLowerCase();
        return (
          s.id.toLowerCase() === code ||
          targetCode === code ||
          s.id.replace('stu_', 'stu-').toLowerCase() === code ||
          studentName.includes(code) ||
          code.includes(studentName)
        );
      });

      if (!matched) {
        setLinkError('Invalid invite code. Try STU-2, Zoya, or Arman.');
        setIsLinking(false);
        return;
      }

      await tripService.linkParentToStudent(matched.id, user.name);

      // Reload students list
      const updated = await tripService.getStudents();
      const myStudents = updated.filter((s) => s.parentName === user.name);
      setStudents(myStudents);

      // Select the newly added child
      const newChild = myStudents.find((s) => s.id === matched.id);
      if (newChild) {
        setSelectedStudent(newChild);
        if (newChild.pickupStop) setPickupName(newChild.pickupStop);
      }

      setLinkCode('');
      setShowLinkCard(false);
      Alert.alert('Linked Successfully', `${matched.name} is now connected to your account.`);
    } catch (err) {
      setLinkError('Failed to link child. Check connection.');
    } finally {
      setIsLinking(false);
    }
  };

  useEffect(() => {
    // 1. Fetch all students and find the children of the logged-in parent
    tripService
      .getStudents()
      .then((allStudents) => {
        const parentName = user?.name ?? 'Amina Shah';
        const myStudents = allStudents.filter((s) => s.parentName === parentName);
        setStudents(myStudents);
        if (myStudents.length > 0) {
          setSelectedStudent(myStudents[0]);
          if (myStudents[0].pickupStop) {
            setPickupName(myStudents[0].pickupStop);
          }
        }
      })
      .catch((err) => console.error('Error fetching students for parent:', err));

    // 2. Load stored custom pickup stop if any
    AsyncStorage.getItem(PICKUP_KEY).then((saved) => {
      if (saved) setPickupName(saved);
    });
  }, [user]);

  const selectStudent = (student: Student): void => {
    setSelectedStudent(student);
    if (student.pickupStop) {
      setPickupName(student.pickupStop);
    }
  };

  const selectPickup = async (name: string): Promise<void> => {
    setPickupName(name);
    await AsyncStorage.setItem(PICKUP_KEY, name).catch(() => undefined);
    
    // Alert Driver dashboard across tabs using the demo event bus
    if (selectedStudent) {
      try {
        const demoEventsRaw = await AsyncStorage.getItem('@raasta_demo_events');
        const demoEvents = demoEventsRaw ? JSON.parse(demoEventsRaw) : [];
        demoEvents.push({
          id: Date.now().toString(),
          type: 'location_changed',
          studentName: selectedStudent.name,
          stopName: name,
          timestamp: Date.now()
        });
        await AsyncStorage.setItem('@raasta_demo_events', JSON.stringify(demoEvents));
        
        // Update local student array temporarily for this session
        setStudents(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, pickupStop: name } : s));
      } catch (e) {}
    }
  };

  const { label: statusLabel, tone: statusTone } = busStatusBadge(bus?.status, 'parent');
  const showProximityBanner =
    proximity.phase === 'approaching' || proximity.phase === 'imminent' || proximity.phase === 'arrived';

  return (
    <ScreenContainer>
      <ScreenHeader title="Track Bus" subtitle={`${busNo} · ${user?.schoolName ?? 'School'}`} showLogout showBrand />

      {students.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(400)}>
          <AppCard style={{ marginVertical: spacing.md, padding: 16 }}>
            <Text style={[typography.titleMedium, { color: colors.textPrimary, textAlign: 'center', fontFamily: 'Poppins-SemiBold' }]}>
              No Linked Children
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: 16 }]}>
              To start tracking, enter your child's student invite code provided by the school.
            </Text>

            <TextInput
              placeholder="Enter Code (e.g. STU-1, STU-arman)"
              placeholderTextColor={colors.textSecondary}
              value={linkCode}
              onChangeText={setLinkCode}
              style={{
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 12,
                height: 42,
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                fontFamily: 'Poppins-Regular',
                fontSize: 14,
                marginBottom: 12,
              }}
            />
            {linkError ? (
              <Text style={[typography.bodySmall, { color: colors.danger, marginBottom: 12, paddingHorizontal: 4 }]}>
                {linkError}
              </Text>
            ) : null}
            <PrimaryButton
              label="Link Child Account"
              onPress={handleLinkChild}
              loading={isLinking}
              variant="gradient"
            />
          </AppCard>
        </Animated.View>
      ) : (
        <>
          {/* Select Student Selector */}
          <Animated.View entering={FadeInDown.duration(400)}>
            <SectionTitle
              title="Students Tracker"
              action={
                <TouchableOpacity onPress={() => setShowLinkCard(!showLinkCard)}>
                  <Text style={[typography.buttonMedium, { color: colors.primary, fontFamily: 'Poppins-SemiBold' }]}>
                    {showLinkCard ? 'Cancel' : '+ Link Child'}
                  </Text>
                </TouchableOpacity>
              }
            />

            {showLinkCard ? (
              <AppCard style={{ marginBottom: spacing.md, padding: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput
                    placeholder="Enter Invite Code (e.g. STU-2)"
                    placeholderTextColor={colors.textSecondary}
                    value={linkCode}
                    onChangeText={setLinkCode}
                    style={{
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      height: 36,
                      color: colors.textPrimary,
                      backgroundColor: colors.surface,
                      flex: 1,
                      fontFamily: 'Poppins-Regular',
                      fontSize: 12,
                    }}
                  />
                  <PrimaryButton
                    label="Link"
                    onPress={handleLinkChild}
                    loading={isLinking}
                    variant="gradient"
                    style={{ height: 36, paddingVertical: 0, minWidth: 60 }}
                  />
                </View>
                {linkError ? (
                  <Text style={[typography.caption, { color: colors.danger, marginTop: 4 }]}>
                    {linkError}
                  </Text>
                ) : null}
              </AppCard>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {students.map((student) => {
                const active = selectedStudent?.id === student.id;
                return (
                  <TouchableOpacity
                    key={student.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Track bus for ${student.name}`}
                    onPress={() => selectStudent(student)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.primary : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      },
                    ]}
                  >
                    <GraduationCap size={16} color={active ? '#FFFFFF' : colors.primary} />
                    <Text style={[typography.buttonMedium, { color: active ? '#FFFFFF' : colors.textPrimary }]}>
                      {student.name} ({student.className.split(' ')[1] ?? student.className})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>

          {bus?.status !== 'active' && !showProximityBanner ? (
            <ScheduleBanner audience="parent" style={{ marginTop: spacing.md }} />
          ) : null}

          {showProximityBanner ? (
            <AppCard accent={proximity.phase === 'imminent' ? 'danger' : 'default'} style={{ marginBottom: spacing.md, marginTop: spacing.xs }}>
              <View style={styles.bannerRow}>
                <BellRing size={18} color={proximity.phase === 'imminent' ? colors.danger : colors.primary} />
                <Text style={[typography.titleMedium, styles.bannerText, { color: colors.textPrimary }]} numberOfLines={2}>
                  {proximityMessage[proximity.phase ?? 'approaching']}
                </Text>
              </View>
              
              {/* Drop-off Notification — parent is only notified, never prompted to confirm */}
              {selectedStudent && (dropoffStatus[selectedStudent.id] === 'dropped' || proximity.phase === 'arrived') ? (
                <View style={{
                  marginTop: 14,
                  backgroundColor: `${colors.success}12`,
                  borderColor: `${colors.success}35`,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <View style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: `${colors.success}20`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <CheckCircle2 size={22} color={colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.titleMedium, { color: colors.success, fontFamily: 'Poppins-SemiBold' }]}>
                      Student Dropped Off
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textPrimary, marginTop: 2 }]}>
                      {selectedStudent.name} has been safely dropped off at {pickupName ?? selectedStudent.pickupStop ?? 'stop'}.
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 3 }]}>
                      Verified by driver & school transport
                    </Text>
                  </View>
                </View>
              ) : null}
            </AppCard>
          ) : null}

          <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: spacing.md }}>
            <View style={{ height: 260, borderRadius: 12, overflow: 'hidden' }}>
              <BusMap
                busLocation={currentParentBusLocation || null}
                routeCoordinates={routeConfig.path.map(p => ({ latitude: p.latitude, longitude: p.longitude }))}
              />
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8, textAlign: 'right' }]}>
              {simLocation?.lastUpdated ? `Updated ${Math.floor((Date.now() - simLocation.lastUpdated)/1000)} s ago` : 'Signal lost'}
            </Text>
          </Animated.View>

          <SectionTitle title="My Pickup Stop" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {PICKUP_STOPS.map((stop) => {
              const active = stop.name === pickupName;
              return (
                <TouchableOpacity
                  key={stop.name}
                  accessibilityRole="button"
                  accessibilityLabel={`Set pickup stop to ${stop.name}`}
                  onPress={() => selectPickup(stop.name)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[typography.buttonMedium, { color: active ? '#FFFFFF' : colors.textPrimary }]}>
                    {stop.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {bus ? (
            <>
              <Animated.View entering={FadeInDown.delay(80).duration(400)}>
                <AppCard style={{ marginTop: spacing.sm }} accent={bus.status === 'sos' ? 'danger' : 'default'}>
                  <View style={styles.etaRow}>
                    <View style={styles.etaText}>
                      {selectedStudent ? (
                        <Text style={[typography.caption, { color: colors.primary, fontFamily: 'Poppins-SemiBold', marginBottom: 2 }]}>
                          Child: {selectedStudent.name} ({selectedStudent.className})
                        </Text>
                      ) : null}
                      <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
                        {pickupStop
                          ? proximity.phase === 'passed'
                            ? `Passed ${pickupStop.name}`
                            : `Reaching ${pickupStop.name} in`
                          : bus.etaMinutes > 0
                            ? `Arriving at ${bus.nextStop}`
                            : 'Live tracking'}
                      </Text>
                      {pickupStop && proximity.etaMinutes !== null && proximity.phase !== 'passed' ? (
                        <Text style={[typography.h1, { color: colors.textPrimary }]}>
                          {proximity.etaMinutes}
                          <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}> min</Text>
                          {proximity.distanceM !== null ? (
                            <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
                              {'  ·  '}{proximity.distanceM >= 1000 ? `${(proximity.distanceM / 1000).toFixed(1)} km` : `${proximity.distanceM} m`}
                            </Text>
                          ) : null}
                        </Text>
                      ) : (
                        <Text style={[typography.h2, { color: colors.textPrimary }]} numberOfLines={1}>
                          {bus.etaMinutes > 0 ? `${bus.etaMinutes} min` : bus.nextStop}
                        </Text>
                      )}
                    </View>
                    <Badge label={statusLabel} tone={statusTone} />
                  </View>
                </AppCard>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(160).duration(400)} style={[styles.statsRow, { marginTop: spacing.md }]}>
                <StatCard label="Speed" value={`${Math.round(bus.speedKmh)} km/h`} icon={Gauge} tint={bus.speedKmh > 50 ? colors.danger : colors.primary} />
                <StatCard label="Next Stop" value={bus.nextStop} icon={MapPin} tint={colors.secondaryAccent} />
                <StatCard label="Driver" value={bus.driverName.split(' ')[0]} icon={User} />
              </Animated.View>
            </>
          ) : (
            <>
              <Skeleton height={92} style={{ marginTop: spacing.sm }} />
              <Skeleton height={104} style={{ marginTop: spacing.md }} />
            </>
          )}

          <PrimaryButton
            label="🤒 Child is Sick / Mark Absent"
            onPress={() => Alert.alert('Absent', 'Child marked absent for today. Bus will not wait.')}
            variant="danger"
            style={{ marginTop: spacing.lg }}
          />

          <PrimaryButton
            label="Report a Concern"
            onPress={() => navigation.navigate('ReportComplaint')}
            variant="outline"
            style={{ marginTop: spacing.sm }}
          />
        </>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  bannerRow: { flexDirection: 'row', alignItems: 'center' },
  bannerText: { flex: 1, marginLeft: 10 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.2,
  },
  etaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  etaText: { flex: 1, paddingRight: 10 },
  statsRow: { flexDirection: 'row', gap: 12 },
});

export default ParentHomeScreen;
