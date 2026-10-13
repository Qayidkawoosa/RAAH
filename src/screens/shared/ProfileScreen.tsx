import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bus, IdCard, Mail, Phone, School, ShieldCheck } from 'lucide-react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppCard } from '../../components/ui/AppCard';
import { Badge } from '../../components/ui/Badge';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';
import { isLiveBackend } from '../../config/env';

const roleLabels: Record<string, string> = {
  driver: 'Bus Driver',
  parent: 'Parent',
  school: 'School Admin',
  rto: 'Transport Authority',
};

const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { colors, spacing } = useAppTheme();
  if (!user) return null;

  const rows = [
    { icon: Mail, label: 'Email', value: user.email },
    { icon: Phone, label: 'Phone', value: user.phone ?? '—' },
    { icon: Bus, label: 'Bus', value: user.vehicleNo ?? user.assignedBusNo ?? '—' },
    { icon: IdCard, label: 'Licence / Code', value: user.licenseNo ?? user.rtoCode ?? '—' },
    { icon: School, label: 'School', value: user.schoolName ?? '—' },
  ];

  return (
    <ScreenContainer>
      <ScreenHeader title="Profile" showBrand />
      <View style={styles.hero}>
        <View style={[styles.avatar, { backgroundColor: `${colors.primary}1A` }]}>
          <Text style={[typography.h1, { color: colors.primary }]}>{user.name.charAt(0)}</Text>
        </View>
        <Text style={[typography.h3, { color: colors.textPrimary, marginTop: 10 }]}>{user.name}</Text>
        <Badge label={roleLabels[user.role] ?? user.role} tone="info" />
      </View>

      <AppCard style={{ marginTop: spacing.lg }}>
        {rows.map(({ icon: Icon, label, value }, index) => (
          <View
            key={label}
            style={[
              styles.row,
              index < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
            ]}
          >
            <Icon size={16} color={colors.textSecondary} />
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginLeft: 12 }]}>
              {label}
            </Text>
            <Text
              style={[typography.titleMedium, styles.rowValue, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {value}
            </Text>
          </View>
        ))}
      </AppCard>

      <AppCard style={{ marginTop: spacing.md }}>
        <View style={styles.modeRow}>
          <ShieldCheck size={16} color={colors.primary} />
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: 8, flex: 1 }]}>
            {isLiveBackend
              ? 'Connected to live RAAH backend'
              : 'Demo mode — set EXPO_PUBLIC_API_URL in .env to go live'}
          </Text>
        </View>
      </AppCard>

      <PrimaryButton label="Log Out" onPress={logout} variant="outline" style={{ marginTop: spacing.lg }} />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 8 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowValue: { flex: 1, textAlign: 'right', marginLeft: 12 },
  modeRow: { flexDirection: 'row', alignItems: 'center' },
});

export default ProfileScreen;
