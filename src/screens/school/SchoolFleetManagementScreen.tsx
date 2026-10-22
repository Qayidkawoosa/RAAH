import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Modal, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Bus, Trash2, ShieldCheck, UserCircle, Plus, ChevronDown, Check, KeyRound, MapPin, Phone } from 'lucide-react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppCard } from '../../components/ui/AppCard';
import { Badge } from '../../components/ui/Badge';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';
import { tripService } from '../../services/tripService';
import { FleetBus } from '../../types/fleet';

const SchoolFleetManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors, spacing } = useAppTheme();
  
  const [tab, setTab] = useState<'fleet' | 'verifications'>('fleet');
  const [fleet, setFleet] = useState<FleetBus[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [availableRoutes, setAvailableRoutes] = useState<any[]>([]);
  
  // Enroll Driver & Bus Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [busPlateNo, setBusPlateNo] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [tempPassword, setTempPassword] = useState('Pass@2026');
  const [showRouteDropdown, setShowRouteDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [buses, routes] = await Promise.all([
        tripService.getFleet(),
        tripService.getRoutes(),
      ]);
      setFleet(buses);
      setAvailableRoutes(routes);
      if (routes.length > 0 && !selectedRouteId) {
        setSelectedRouteId(routes[0].id);
      }
      
      const eventsRaw = await AsyncStorage.getItem('@raasta_demo_events');
      if (eventsRaw) {
        const events = JSON.parse(eventsRaw);
        // Filter only identity verifications
        setVerifications(events.filter((e: any) => e.type === 'identity_verified').reverse());
      }
    } catch (e) {
      console.error(e);
    }
  }, [selectedRouteId]);

  useEffect(() => {
    loadData();
    // Poll for new verifications if we are on that tab
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleEnrollDriver = async () => {
    if (!driverName.trim()) {
      Alert.alert('Missing Field', 'Please enter Driver Name.');
      return;
    }
    if (!driverPhone.trim()) {
      Alert.alert('Missing Field', 'Please enter Phone Number.');
      return;
    }
    if (!busPlateNo.trim()) {
      Alert.alert('Missing Field', 'Please enter Bus Plate Number.');
      return;
    }
    const JK_PLATE_REGEX = /^JK[- ]?[0-9]{2}[- ]?[A-Z]{1,2}[- ]?[0-9]{4}$/i;
    if (!JK_PLATE_REGEX.test(busPlateNo.trim())) {
      Alert.alert('Invalid Plate Format', 'Bus plate number must match J&K format (e.g. JK-01-AB-1234).');
      return;
    }
    if (!selectedRouteId) {
      Alert.alert('Missing Field', 'Please select a planned route.');
      return;
    }
    if (!tempPassword.trim()) {
      Alert.alert('Missing Field', 'Please provide a temporary password for the driver account.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await tripService.enrollDriver({
        driverName: driverName.trim(),
        phone: driverPhone.trim(),
        busNo: busPlateNo.trim().toUpperCase(),
        routeId: selectedRouteId,
        password: tempPassword.trim(),
      });

      setShowAddModal(false);
      setDriverName('');
      setDriverPhone('');
      setBusPlateNo('');
      setTempPassword('Pass@2026');
      setShowRouteDropdown(false);

      Alert.alert(
        '🎉 Driver & Bus Enrolled Successfully',
        `Admin Credentials Generated:\n\n` +
        `👤 Driver Name: ${driverName.trim()}\n` +
        `📧 Login Email: ${res.driverEmail}\n` +
        `🔑 Temporary Password: ${tempPassword.trim()}\n` +
        `🚌 Bus Assigned: ${res.busNo}\n\n` +
        `Share these login credentials with the driver to access their planned route on RAAH.`,
        [{ text: 'Copy & Close', onPress: () => {} }]
      );

      await loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to enroll driver and bus';
      Alert.alert('Enrollment Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveBus = (busNo: string) => {
    Alert.alert('Remove Bus', `Are you sure you want to remove ${busNo} from the fleet?`, [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Remove', 
        style: 'destructive', 
        onPress: async () => {
          await tripService.removeFleetBus(busNo);
          await loadData();
        }
      }
    ]);
  };

  return (
    <ScreenContainer onRefresh={loadData}>
      <ScreenHeader title="Fleet Management" onBack={() => navigation.goBack()} showBrand />

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, tab === 'fleet' ? { borderBottomColor: colors.primary } : { borderBottomColor: 'transparent' }]} 
          onPress={() => setTab('fleet')}
        >
          <Text style={[typography.titleMedium, { color: tab === 'fleet' ? colors.primary : colors.textSecondary }]}>
            Active Fleet
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, tab === 'verifications' ? { borderBottomColor: colors.primary } : { borderBottomColor: 'transparent' }]} 
          onPress={() => setTab('verifications')}
        >
          <Text style={[typography.titleMedium, { color: tab === 'verifications' ? colors.primary : colors.textSecondary }]}>
            Identity Logs
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingBottom: 40 }}>
        {tab === 'fleet' && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <PrimaryButton 
              label="Enroll Driver & Bus" 
              icon={<Plus size={18} color="#FFF" style={{ marginRight: 8 }} />}
              onPress={() => setShowAddModal(true)}
              style={{ marginBottom: spacing.md }}
            />

            {fleet.map((busItem, index) => (
              <AppCard key={busItem.busNo} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ backgroundColor: `${colors.primary}1A`, padding: 10, borderRadius: 12, marginRight: 12 }}>
                    <Bus size={24} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>{busItem.busNo}</Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      Driver: {busItem.driverName}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      Route: {busItem.routeName}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveBus(busItem.busNo)} style={{ padding: 8 }}>
                    <Trash2 size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </AppCard>
            ))}
          </Animated.View>
        )}

        {tab === 'verifications' && (
          <Animated.View entering={FadeInDown.duration(300)}>
            {verifications.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <ShieldCheck size={48} color={colors.border} />
                <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 12 }]}>
                  No recent driver verifications found.
                </Text>
              </View>
            ) : (
              verifications.map((v, i) => (
                <AppCard key={i} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ShieldCheck size={24} color={colors.success} style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                        {v.driverName} Verified
                      </Text>
                      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                        Bus: {v.busNo}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                        {new Date(v.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>
                    <Badge label="Verified" tone="success" />
                  </View>
                </AppCard>
              ))
            )}
          </Animated.View>
        )}
      </View>

      {/* ENROLL DRIVER & BUS MODAL */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.background, maxHeight: '90%', padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[typography.h2, { color: colors.textPrimary, marginBottom: 4 }]}>Enroll Driver & Bus</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 20 }]}>
                Assign a vehicle, bind a planned route, and generate driver login credentials.
              </Text>
              
              {/* Driver Name */}
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>Driver Full Name *</Text>
              <TextInput
                placeholder="e.g. Tariq Ahmad Dar"
                value={driverName}
                onChangeText={setDriverName}
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.card }]}
                placeholderTextColor={colors.textSecondary}
              />

              {/* Phone Number */}
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>Phone Number (10 digits) *</Text>
              <TextInput
                placeholder="e.g. 9419012345"
                value={driverPhone}
                onChangeText={setDriverPhone}
                keyboardType="phone-pad"
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.card }]}
                placeholderTextColor={colors.textSecondary}
              />

              {/* Bus Plate Number */}
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>Bus Plate No. (J&K Format) *</Text>
              <TextInput
                placeholder="e.g. JK-01-AB-1234"
                value={busPlateNo}
                onChangeText={(t) => setBusPlateNo(t.toUpperCase())}
                autoCapitalize="characters"
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.card }]}
                placeholderTextColor={colors.textSecondary}
              />

              {/* Route Selector Dropdown */}
              <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>Planned Route Binding *</Text>
              <TouchableOpacity
                onPress={() => setShowRouteDropdown(!showRouteDropdown)}
                style={[
                  styles.dropdownButton,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
              >
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <MapPin size={18} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={[typography.bodyMedium, { color: selectedRouteId ? colors.textPrimary : colors.textSecondary }]}>
                    {availableRoutes.find((r) => r.id === selectedRouteId)?.name || 'Select a planned route...'}
                  </Text>
                </View>
                <ChevronDown size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {showRouteDropdown && (
                <View style={[styles.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {availableRoutes.map((r) => {
                    const isSelected = r.id === selectedRouteId;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        onPress={() => {
                          setSelectedRouteId(r.id);
                          setShowRouteDropdown(false);
                        }}
                        style={[
                          styles.dropdownItem,
                          {
                            backgroundColor: isSelected ? `${colors.primary}15` : 'transparent',
                            borderBottomColor: colors.border,
                          },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[typography.bodyMedium, { color: isSelected ? colors.primary : colors.textPrimary, fontFamily: isSelected ? 'Poppins-SemiBold' : 'Poppins-Regular' }]}>
                            {r.name}
                          </Text>
                          {r.description ? (
                            <Text style={[typography.caption, { color: colors.textSecondary }]}>
                              {r.description}
                            </Text>
                          ) : null}
                        </View>
                        {isSelected && <Check size={18} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Temporary Password */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, marginTop: 12 }}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Temporary Driver Password *</Text>
                <TouchableOpacity
                  onPress={() => setTempPassword(`Pass@${Math.floor(1000 + Math.random() * 9000)}`)}
                >
                  <Text style={[typography.caption, { color: colors.primary, fontFamily: 'Poppins-Medium' }]}>
                    🎲 Generate Random
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                placeholder="e.g. Pass@2026"
                value={tempPassword}
                onChangeText={setTempPassword}
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.card }]}
                placeholderTextColor={colors.textSecondary}
              />

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 12 }}>
                <PrimaryButton 
                  label="Cancel" 
                  onPress={() => setShowAddModal(false)} 
                  variant="outline" 
                  style={{ flex: 1 }} 
                />
                <PrimaryButton 
                  label={isSubmitting ? "Enrolling..." : "Enroll Driver & Bus"} 
                  onPress={handleEnrollDriver} 
                  disabled={isSubmitting}
                  style={{ flex: 1 }} 
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontFamily: 'Poppins-Regular',
    marginBottom: 16,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  dropdownList: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

export default SchoolFleetManagementScreen;

