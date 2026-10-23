import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Modal, TextInput, Alert, Platform } from 'react-native';
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
import { useAuth } from '../../context/AuthContext';

const SchoolFleetManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors, spacing } = useAppTheme();
  const { login, logout } = useAuth();
  
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
  const [modalError, setModalError] = useState<string | null>(null);
  const [enrolledSuccess, setEnrolledSuccess] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [buses, routes] = await Promise.all([
        tripService.getFleet(),
        tripService.getRoutes(),
      ]);
      setFleet(buses);
      setAvailableRoutes(routes);
      if (routes.length > 0) {
        setSelectedRouteId((prev) => prev || routes[0].id);
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
  }, []);

  useEffect(() => {
    loadData();
    // Poll for new verifications if we are on that tab
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleEnrollDriver = async () => {
    setModalError(null);

    const name = driverName.trim();
    const phone = driverPhone.trim().replace(/[^0-9]/g, '');
    const bus = busPlateNo.trim().toUpperCase();
    const pwd = tempPassword.trim();
    const route = selectedRouteId || (availableRoutes.length > 0 ? availableRoutes[0].id : 'demo_route');

    if (!name) {
      setModalError('Please enter Driver Full Name.');
      return;
    }
    if (!phone || phone.length < 10) {
      setModalError('Please enter a valid 10-digit mobile number for driver login.');
      return;
    }
    if (!bus || bus.length < 3) {
      setModalError('Please enter Bus Plate Number (e.g. JK-01-AB-1234 or BUS-04).');
      return;
    }
    if (!pwd) {
      setModalError('Please provide a temporary password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await tripService.enrollDriver({
        driverName: name,
        phone: phone,
        busNo: bus,
        routeId: route,
        password: pwd,
      });

      const matchedRoute = availableRoutes.find((r) => r.id === route);
      const routeDisplayName = matchedRoute?.name || 'Assigned Planned Route';

      setEnrolledSuccess({
        driverName: name,
        phone: phone,
        email: res.driverEmail,
        password: pwd,
        busNo: res.busNo || bus,
        routeName: routeDisplayName,
      });

      await loadData();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to enroll driver and bus';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchToDriver = async () => {
    if (!enrolledSuccess) return;
    try {
      setIsSubmitting(true);
      const targetPhone = enrolledSuccess.phone;
      const targetPassword = enrolledSuccess.password;
      setShowAddModal(false);
      setEnrolledSuccess(null);
      await logout();
      await login(targetPhone, targetPassword);
    } catch (err: any) {
      const msg = err?.message || 'Failed to auto-switch to driver portal';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Login Switch Error', msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveBus = async (busNo: string) => {
    const doDelete = async () => {
      try {
        await tripService.removeFleetBus(busNo);
        await loadData();
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message || 'Failed to delete driver and bus';
        if (Platform.OS === 'web') {
          window.alert('Delete Error: ' + msg);
        } else {
          Alert.alert('Delete Error', msg);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm) {
        if (window.confirm(`Are you sure you want to delete Bus ${busNo} and its driver from the database?`)) {
          await doDelete();
        }
      } else {
        await doDelete();
      }
      return;
    }

    Alert.alert('Delete Driver & Bus', `Are you sure you want to delete ${busNo} and its driver from the database?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
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
              {enrolledSuccess ? (
                <View style={{ paddingVertical: 12 }}>
                  <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ backgroundColor: `${colors.success}20`, padding: 14, borderRadius: 30, marginBottom: 8 }}>
                      <ShieldCheck size={36} color={colors.success} />
                    </View>
                    <Text style={[typography.h2, { color: colors.textPrimary, textAlign: 'center' }]}>
                      🎉 Driver Enrolled Successfully!
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
                      Driver profile created and vehicle bound in PostgreSQL database.
                    </Text>
                  </View>

                  <View style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 20 }}>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 2 }]}>DRIVER FULL NAME</Text>
                    <Text style={[typography.titleMedium, { color: colors.textPrimary, marginBottom: 12 }]}>{enrolledSuccess.driverName}</Text>

                    <Text style={[typography.caption, { color: colors.primary, fontWeight: '700', marginBottom: 2 }]}>📱 LOGIN PHONE NUMBER (DRIVER USER ID)</Text>
                    <Text style={[typography.titleLarge, { color: colors.primary, fontWeight: '800', marginBottom: 12 }]}>{enrolledSuccess.phone}</Text>

                    <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 2 }]}>TEMPORARY PASSWORD</Text>
                    <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '700', marginBottom: 12 }]}>{enrolledSuccess.password}</Text>

                    <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 2 }]}>BUS PLATE ASSIGNED</Text>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginBottom: 12 }]}>{enrolledSuccess.busNo}</Text>

                    <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 2 }]}>BOUND PLANNED ROUTE</Text>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{enrolledSuccess.routeName}</Text>
                  </View>

                  <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginBottom: 16 }]}>
                    The driver can now log in using their 10-digit Phone Number ({enrolledSuccess.phone}) and Password on the driver portal.
                  </Text>

                  <View style={{ gap: 10 }}>
                    <PrimaryButton
                      label="🚀 Switch to Driver Portal Now"
                      onPress={handleSwitchToDriver}
                      disabled={isSubmitting}
                    />

                    <PrimaryButton
                      label="Stay in School Admin Portal"
                      variant="outline"
                      onPress={() => {
                        setEnrolledSuccess(null);
                        setShowAddModal(false);
                        setDriverName('');
                        setDriverPhone('');
                        setBusPlateNo('');
                        setTempPassword('Pass@2026');
                        setModalError(null);
                      }}
                    />
                  </View>
                </View>
              ) : (
                <>
                  <Text style={[typography.h2, { color: colors.textPrimary, marginBottom: 4 }]}>Enroll Driver & Bus</Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 16 }]}>
                    Assign a vehicle, bind a planned route, and generate driver phone-based credentials.
                  </Text>

                  {/* Inline Error Banner */}
                  {modalError ? (
                    <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: colors.danger, borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 16 }}>
                      <Text style={[typography.bodySmall, { color: colors.danger, fontWeight: '700' }]}>⚠️ {modalError}</Text>
                    </View>
                  ) : null}
                  
                  {/* Driver Name */}
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>Driver Full Name *</Text>
                  <TextInput
                    placeholder="e.g. Tariq Ahmad Dar"
                    value={driverName}
                    onChangeText={(t) => { setDriverName(t); if (modalError) setModalError(null); }}
                    style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.card }]}
                    placeholderTextColor={colors.textSecondary}
                  />

                  {/* Phone Number */}
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>Phone Number (10 digits for Driver Login) *</Text>
                  <TextInput
                    placeholder="e.g. 9419012345"
                    value={driverPhone}
                    onChangeText={(t) => { setDriverPhone(t); if (modalError) setModalError(null); }}
                    keyboardType="phone-pad"
                    style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.card }]}
                    placeholderTextColor={colors.textSecondary}
                  />

                  {/* Bus Plate Number */}
                  <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>Bus Plate No. *</Text>
                  <TextInput
                    placeholder="e.g. JK-01-AB-1234 or BUS-04"
                    value={busPlateNo}
                    onChangeText={(t) => { setBusPlateNo(t.toUpperCase()); if (modalError) setModalError(null); }}
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
                        {availableRoutes.find((r) => r.id === selectedRouteId)?.name || availableRoutes[0]?.name || 'Select a planned route...'}
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
                      onPress={() => {
                        setShowAddModal(false);
                        setModalError(null);
                      }} 
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
                </>
              )}
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

