import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Modal, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Bus, Trash2, ShieldCheck, UserCircle, Plus } from 'lucide-react-native';
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
  
  // Add Bus Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBusNo, setNewBusNo] = useState('');
  const [newDriver, setNewDriver] = useState('');
  const [newRoute, setNewRoute] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const buses = await tripService.getFleet();
      setFleet(buses);
      
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

  const handleAddBus = async () => {
    if (!newBusNo.trim() || !newDriver.trim() || !newRoute.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all bus details.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await tripService.addFleetBus(newBusNo, newDriver, newRoute);
      setNewBusNo('');
      setNewDriver('');
      setNewRoute('');
      setShowAddModal(false);
      await loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to add bus');
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
              label="Add New Bus" 
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

      {/* ADD BUS MODAL */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.background, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <Text style={[typography.h2, { color: colors.textPrimary, marginBottom: 20 }]}>Add New Bus</Text>
            
            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>Vehicle Registration No.</Text>
            <TextInput
              placeholder="e.g. JK-01-AB-1234"
              value={newBusNo}
              onChangeText={setNewBusNo}
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>Assigned Driver Name</Text>
            <TextInput
              placeholder="e.g. Tariq Ahmad"
              value={newDriver}
              onChangeText={setNewDriver}
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 4 }]}>Route Name</Text>
            <TextInput
              placeholder="e.g. Srinagar North Route"
              value={newRoute}
              onChangeText={setNewRoute}
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholderTextColor={colors.textSecondary}
            />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <PrimaryButton 
                label="Cancel" 
                onPress={() => setShowAddModal(false)} 
                variant="outline" 
                style={{ flex: 1 }} 
              />
              <PrimaryButton 
                label="Add Fleet" 
                onPress={handleAddBus} 
                disabled={isSubmitting}
                style={{ flex: 1 }} 
              />
            </View>
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
  }
});

export default SchoolFleetManagementScreen;
