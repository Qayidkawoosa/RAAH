import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LogOut, ChevronLeft } from 'lucide-react-native';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';
import { useAuth } from '../../context/AuthContext';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showLogout?: boolean;
  onBack?: () => void;
  /** Show the small "RAAH" brand watermark below the subtitle */
  showBrand?: boolean;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  showLogout = false,
  onBack,
  showBrand = false,
}) => {
  const { colors, spacing } = useAppTheme();
  const { logout } = useAuth();

  return (
    <View style={[styles.row, { paddingVertical: spacing.lg }]}>
      {onBack && (
        <TouchableOpacity
          accessibilityLabel="Go back"
          onPress={onBack}
          style={[styles.backBtn, { backgroundColor: colors.surface, marginRight: 12 }]}
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      )}
      <View style={styles.titles}>
        <Text style={[typography.h2, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 2 }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
        {showBrand ? (
          <Text style={[typography.caption, { color: colors.primary, marginTop: 3, fontFamily: 'Poppins-Medium' }]}>
            Route & Attendance Assurance Hub
          </Text>
        ) : null}
      </View>

      {/* Avatar placeholder */}
      <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
        <Text style={styles.avatarText}>R</Text>
      </View>

      {showLogout ? (
        <TouchableOpacity
          accessibilityLabel="Log out"
          onPress={logout}
          style={[styles.logout, { backgroundColor: colors.surface, marginLeft: 8 }]}
        >
          <LogOut size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titles: { flex: 1, paddingRight: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  logout: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
