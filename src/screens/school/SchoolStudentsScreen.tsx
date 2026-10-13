import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { TextInput } from 'react-native-paper';
import { GraduationCap, Trash2 } from 'lucide-react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppCard } from '../../components/ui/AppCard';
import { Badge } from '../../components/ui/Badge';
import { SectionTitle } from '../../components/ui/SectionTitle';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';
import { tripService } from '../../services/tripService';
import { FleetBus, Student } from '../../types/fleet';
import { DEMO_STOPS } from '../../constants/demoRoute';

// The final stop is the school itself — not a pickup point.
const PICKUP_STOPS = DEMO_STOPS.slice(0, -1).map((stop) => stop.name);

/** School assigns students (by class) to buses; grouped view per bus. */
const SchoolStudentsScreen: React.FC = () => {
  const { colors, spacing } = useAppTheme();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [fleet, setFleet] = useState<FleetBus[]>([]);
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [busNo, setBusNo] = useState<string | null>(null);
  const [pickupStop, setPickupStop] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    await Promise.allSettled([
      tripService.getStudents().then(setStudents).catch(() => setStudents([])),
      tripService.getFleet().then(setFleet).catch(() => setFleet([])),
    ]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleAdd = async (): Promise<void> => {
    if (!name.trim() || !className.trim() || !busNo || !pickupStop) return;
    setSaving(true);
    try {
      const student = await tripService.addStudent(
        name.trim(),
        className.trim(),
        busNo,
        pickupStop
      );
      setStudents((current) => [...(current ?? []), student]);
      setName('');
      setClassName('');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (student: Student): Promise<void> => {
    setStudents((current) => current?.filter((item) => item.id !== student.id) ?? null);
    try {
      await tripService.removeStudent(student.id);
    } catch {
      // Optimistic removal stands; the list re-syncs on next focus.
    }
  };

  const buses = [...new Set([...fleet.map((bus) => bus.busNo), ...(students ?? []).map((s) => s.busNo)])];

  return (
    <ScreenContainer onRefresh={load}>
      <ScreenHeader
        title="Students"
        subtitle={students ? `${students.length} students across ${buses.length} buses` : 'Assign students to buses'}
        showBrand
      />

      <AppCard>
        <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>Add a student</Text>
        <TextInput
          mode="outlined"
          dense
          label="Student name"
          value={name}
          onChangeText={setName}
          style={[styles.input, { backgroundColor: colors.card }]}
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
          textColor={colors.textPrimary}
        />
        <TextInput
          mode="outlined"
          dense
          label="Class (e.g. Class 5-A)"
          value={className}
          onChangeText={setClassName}
          style={[styles.input, { backgroundColor: colors.card }]}
          outlineColor={colors.border}
          activeOutlineColor={colors.primary}
          textColor={colors.textPrimary}
        />
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 10, marginBottom: 6 }]}>
          Assign to bus
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {fleet.map((bus) => {
            const active = bus.busNo === busNo;
            return (
              <TouchableOpacity
                key={bus.busNo}
                accessibilityRole="button"
                accessibilityLabel={`Assign to bus ${bus.busNo}`}
                onPress={() => setBusNo(bus.busNo)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[typography.buttonMedium, { color: active ? '#FFFFFF' : colors.textPrimary }]}>
                  {bus.busNo}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 10, marginBottom: 6 }]}>
          Pickup stop
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {PICKUP_STOPS.map((stop) => {
            const active = stop === pickupStop;
            return (
              <TouchableOpacity
                key={stop}
                accessibilityRole="button"
                accessibilityLabel={`Pickup at ${stop}`}
                onPress={() => setPickupStop(stop)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[typography.buttonMedium, { color: active ? '#FFFFFF' : colors.textPrimary }]}>
                  {stop}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <PrimaryButton
          label="Add student"
          onPress={handleAdd}
          loading={saving}
          disabled={!name.trim() || !className.trim() || !busNo || !pickupStop}
          style={{ marginTop: spacing.md }}
        />
      </AppCard>

      {students === null ? (
        [0, 1, 2].map((i) => <Skeleton key={i} height={70} style={{ marginTop: 12 }} />)
      ) : students.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No students yet" message="Add students above and assign each one to a bus." />
      ) : (
        buses
          .filter((bus) => students.some((student) => student.busNo === bus))
          .map((bus) => {
            const busStudents = students.filter((student) => student.busNo === bus);
            return (
              <View key={bus}>
                <SectionTitle
                  title={bus}
                  action={<Badge label={`${busStudents.length} student${busStudents.length > 1 ? 's' : ''}`} tone="info" />}
                />
                {busStudents.map((student) => (
                  <AppCard key={student.id} style={styles.studentRow}>
                    <View style={styles.studentInfo}>
                      <Text style={[typography.titleMedium, { color: colors.textPrimary }]} numberOfLines={1}>
                        {student.name}
                      </Text>
                      <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
                        {student.className}
                        {student.pickupStop ? ` · Pickup: ${student.pickupStop}` : ''}
                        {student.parentName ? ` · ${student.parentName}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${student.name}`}
                      onPress={() => handleRemove(student)}
                      style={styles.remove}
                    >
                      <Trash2 size={17} color={colors.danger} />
                    </TouchableOpacity>
                  </AppCard>
                ))}
              </View>
            );
          })
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  input: { marginTop: 10, fontSize: 14 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.2,
  },
  studentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  studentInfo: { flex: 1, paddingRight: 10 },
  remove: { padding: 8 },
});

export default SchoolStudentsScreen;
