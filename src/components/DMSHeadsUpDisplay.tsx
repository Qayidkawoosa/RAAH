import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ViewStyle, ActivityIndicator } from 'react-native';
import {
  AlertTriangle,
  Eye,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Sliders,
  Play,
  Square,
  Usb,
  Smartphone,
  Compass,
  CheckCircle2,
  Camera,
  RefreshCw,
} from 'lucide-react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { typography } from '../theme/typography';
import { Badge } from './ui/Badge';
import { AppCard } from './ui/AppCard';
import { useDMSMonitoring } from '../hooks/useDMSMonitoring';
import { LiveDriverCockpit } from './dms/LiveDriverCockpit';

interface DMSHeadsUpDisplayProps {
  busId?: string;
  driverId?: string;
  isTripActive?: boolean;
}

export const DMSHeadsUpDisplay: React.FC<DMSHeadsUpDisplayProps> = ({ busId, driverId, isTripActive = true }) => {
  const { colors } = useAppTheme();
  const {
    dmsStatus,
    activeAlert,
    isDmsActive,
    isDmsConnecting,
    cameraError,
    cameraSource,
    isUsbConnected,
    startBackgroundDms,
    stopBackgroundDms,
    toggleBackgroundDms,
    switchCameraSource,
    toggleSeatbelt,
    dismissAlert,
  } = useDMSMonitoring({
    busId,
    driverId,
  });

  const [showCockpit, setShowCockpit] = useState(false);

  // Auto-start background DMS monitoring ONLY when trip is active
  useEffect(() => {
    if (isTripActive) {
      if (!isDmsActive && !isDmsConnecting) {
        startBackgroundDms();
      }
    } else {
      if (isDmsActive || isDmsConnecting) {
        stopBackgroundDms();
      }
    }
    return () => {
      stopBackgroundDms();
    };
  }, [isTripActive]);

  // Close live cockpit modal if trip is completed or inactive
  useEffect(() => {
    if (!isTripActive && showCockpit) {
      setShowCockpit(false);
    }
  }, [isTripActive, showCockpit]);

  const alertCardStyle: ViewStyle = {
    ...styles.alertCard,
    backgroundColor: activeAlert?.severity === 'critical' ? '#7F1D1D' : '#78350F',
    borderColor: activeAlert?.severity === 'critical' ? '#EF4444' : '#F59E0B',
  };

  const perclosPercent = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (typeof dmsStatus.drowsiness?.perclos === 'number' ? dmsStatus.drowsiness.perclos : 0) * 100
      )
    )
  );
  const perclosTone = perclosPercent > 35 ? '#EF4444' : perclosPercent > 18 ? '#F59E0B' : '#10B981';

  const isDistracted = dmsStatus.distraction?.isDistracted;
  const isMicrosleeping = dmsStatus.drowsiness?.isMicrosleeping;
  const isUsingPhone = dmsStatus.phone?.isUsingPhone;

  // Real-time Driver Tracking State
  const isDriverPresent = Boolean(dmsStatus.isDriverPresent);
  const rawDirection = dmsStatus.headPose?.direction;
  const isNoFace = !isDriverPresent || rawDirection === 'NO_FACE' || rawDirection === 'SEARCHING...';
  const gazeDirection = isNoFace
    ? 'NO DRIVER'
    : (rawDirection && rawDirection !== 'UNKNOWN')
    ? rawDirection
    : (isDistracted ? 'LOOKING AWAY' : 'FORWARD');

  const isGazeDistracted = Boolean(isDistracted && gazeDirection !== 'FORWARD');
  const gazeColor = isNoFace ? '#EF4444' : isGazeDistracted ? '#EF4444' : '#10B981';

  const yawAngle = typeof dmsStatus.headPose?.yaw === 'number' ? dmsStatus.headPose.yaw.toFixed(1) : '0.0';
  const pitchAngle = typeof dmsStatus.headPose?.pitch === 'number' ? dmsStatus.headPose.pitch.toFixed(1) : '0.0';

  // Cabin Safety Telemetry
  const isPhoneInHand = Boolean(dmsStatus.phoneInHand);
  const phoneDesc = dmsStatus.phoneDescription || (isUsingPhone ? 'In Use' : 'Clear');
  const isPhoneRisk = isPhoneInHand || isUsingPhone || phoneDesc.includes('Calling') || phoneDesc.includes('Texting') || phoneDesc.includes('Hand');

  const handsCount = typeof dmsStatus.handsCount === 'number' ? dmsStatus.handsCount : (dmsStatus.handsOnWheel ? 2 : 0);
  const handsText = handsCount === 2 ? 'Both on Wheel' : handsCount === 1 ? '1 on Wheel' : 'Hands Off!';
  const handsColor = handsCount === 2 ? '#10B981' : handsCount === 1 ? '#F59E0B' : '#EF4444';

  const isSeatbeltFastened = Boolean(dmsStatus.seatbeltFastened);

  return (
    <View style={styles.container}>
      {/* 1. CRITICAL ACTIVE ALERT BANNER */}
      {activeAlert && (
        <AppCard style={alertCardStyle}>
          <View style={styles.alertHeader}>
            <View style={styles.alertTitleRow}>
              <AlertTriangle
                size={22}
                color={activeAlert.severity === 'critical' ? '#FCA5A5' : '#FCD34D'}
              />
              <Text style={[typography.titleMedium, styles.alertTitleText]}>
                {activeAlert.title}
              </Text>
            </View>
            <Badge
              label={activeAlert.severity.toUpperCase()}
              tone={activeAlert.severity === 'critical' ? 'danger' : 'warning'}
            />
          </View>
          <Text style={[typography.bodySmall, styles.alertMessageText]}>
            {activeAlert.message}
          </Text>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={dismissAlert}
            activeOpacity={0.7}
          >
            <Text style={styles.dismissBtnText}>Dismiss Alert</Text>
          </TouchableOpacity>
        </AppCard>
      )}

      {/* 2. CAMERA PERMISSION REQUIRED / ERROR BANNER */}
      {cameraError && (
        <View style={styles.errorBanner}>
          <View style={styles.errorTextRow}>
            <AlertTriangle size={18} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>Live Camera Permission Required</Text>
              <Text style={styles.errorSub}>{cameraError}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.enableCamBtn}
            onPress={() => startBackgroundDms(cameraSource)}
            activeOpacity={0.8}
          >
            <Camera size={14} color="#FFFFFF" />
            <Text style={styles.enableCamBtnText}>Grant Camera & Start Real-Time DMS</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 3. INITIALIZING / CONNECTING BANNER */}
      {isDmsConnecting && !cameraError && (
        <View style={styles.connectingBanner}>
          <ActivityIndicator size="small" color="#10B981" />
          <Text style={styles.connectingText}>
            Initializing Real-Time Headless Vision & On-Device AI Models...
          </Text>
        </View>
      )}

      {/* 4. MAIN DRIVER AI ATTENTION DASHBOARD CARD */}
      <AppCard style={{ ...styles.dashboardCard, backgroundColor: colors.surface, borderColor: colors.border }}>
        {/* Header: Service State & Background Controls */}
        <View style={styles.cardHeader}>
          <View style={styles.serviceStatusRow}>
            <View
              style={[
                styles.pulseIndicator,
                { backgroundColor: isDmsActive ? '#10B981' : isDmsConnecting ? '#F59E0B' : '#6B7280' },
              ]}
            />
            <View>
              <View style={styles.titleWithBadge}>
                <Text style={[typography.titleMedium, { color: colors.textPrimary, fontWeight: '700' }]}>
                  AI Driver Attention Guard
                </Text>
                {/* Driver Presence Pill Badge */}
                <View
                  style={[
                    styles.driverPresenceBadge,
                    {
                      backgroundColor: isDriverPresent ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      borderColor: isDriverPresent ? '#10B981' : '#EF4444',
                    },
                  ]}
                >
                  {isDriverPresent ? (
                    <UserCheck size={11} color="#10B981" />
                  ) : (
                    <UserX size={11} color="#EF4444" />
                  )}
                  <Text
                    style={[
                      styles.driverPresenceText,
                      { color: isDriverPresent ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {isDriverPresent ? 'DRIVER IN SEAT' : 'DRIVER ABSENT'}
                  </Text>
                </View>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {isDmsActive
                  ? !isDriverPresent
                    ? 'Headless vision active · Driver not detected in cabin'
                    : 'Real-time background vision active (0 video streamed)'
                  : isDmsConnecting
                  ? 'Connecting hardware & models...'
                  : 'DMS Paused'}
              </Text>
            </View>
          </View>

          <View style={styles.headerBtnGroup}>
            {/* Source Chip */}
            <TouchableOpacity
              style={[styles.sourceChip, { borderColor: colors.border }]}
              onPress={() => switchCameraSource(cameraSource === 'usb' ? 'front' : 'usb')}
            >
              {cameraSource === 'usb' ? (
                <Usb size={13} color={isUsbConnected ? '#10B981' : '#F59E0B'} />
              ) : (
                <Smartphone size={13} color="#6C5CE7" />
              )}
              <Text style={[styles.sourceChipText, { color: colors.textSecondary }]}>
                {cameraSource === 'usb' ? (isUsbConnected ? 'USB Cam' : 'USB (Plugged?)') : 'Front Cam'}
              </Text>
            </TouchableOpacity>

            {/* Toggle Background Monitoring */}
            <TouchableOpacity
              style={[
                styles.serviceToggleBtn,
                { backgroundColor: isDmsActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)' },
              ]}
              onPress={toggleBackgroundDms}
            >
              {isDmsActive ? (
                <Square size={13} color="#EF4444" />
              ) : (
                <Play size={13} color="#10B981" />
              )}
              <Text
                style={[
                  styles.serviceToggleText,
                  { color: isDmsActive ? '#EF4444' : '#10B981' },
                ]}
              >
                {isDmsActive ? 'Pause' : 'Start'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3-Column Real-Time Telemetry Grid */}
        <View style={styles.telemetryGrid}>
          {/* Card 1: Gaze & Direction */}
          <View style={[styles.telemetryCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.telemetryCardHeader}>
              <Compass size={14} color={gazeColor} />
              <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '600' }]}>
                DRIVER GAZE
              </Text>
            </View>
            <Text
              style={[
                styles.primaryMetricText,
                { color: gazeColor },
              ]}
              numberOfLines={1}
            >
              {gazeDirection}
            </Text>
            <Text style={[styles.secondaryMetricText, { color: colors.textTertiary }]}>
              {isNoFace
                ? 'Align face with cam'
                : `Yaw: ${yawAngle}° · Pitch: ${pitchAngle}°`}
            </Text>
          </View>

          {/* Card 2: PERCLOS & Drowsiness */}
          <View style={[styles.telemetryCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.telemetryCardHeader}>
              <Eye size={14} color={perclosTone} />
              <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '600' }]}>
                PERCLOS FATIGUE
              </Text>
            </View>
            <View style={styles.perclosValueRow}>
              <Text style={[styles.primaryMetricText, { color: perclosTone }]}>
                {perclosPercent}%
              </Text>
              <Text
                style={[
                  styles.statusTagText,
                  { color: isMicrosleeping ? '#EF4444' : perclosTone },
                ]}
              >
                {isMicrosleeping ? 'MICROSLEEP!' : perclosPercent < 15 ? 'Vigilant' : 'Drowsy'}
              </Text>
            </View>
            {/* Visual Progress Track */}
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${perclosPercent}%`, backgroundColor: perclosTone },
                ]}
              />
            </View>
          </View>

          {/* Card 3: Cabin Safety (Driver, Phone in Hand, Hands, Seatbelt) */}
          <View style={[styles.telemetryCard, { backgroundColor: colors.background, borderColor: colors.border, minHeight: 96 }]}>
            <View style={styles.telemetryCardHeader}>
              <ShieldAlert
                size={14}
                color={(!isDriverPresent || isPhoneRisk || !dmsStatus.handsOnWheel || !isSeatbeltFastened) ? '#EF4444' : '#10B981'}
              />
              <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '600' }]}>
                CABIN SAFETY
              </Text>
            </View>

            {/* Row 1: Driver Presence */}
            <View style={styles.cabinRow}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Driver:</Text>
              <Text
                style={[
                  styles.cabinValText,
                  { color: isDriverPresent ? '#10B981' : '#EF4444' },
                ]}
              >
                {isDriverPresent ? 'Present' : 'ABSENT'}
              </Text>
            </View>

            {/* Row 2: Phone in Hand */}
            <View style={styles.cabinRow}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Phone:</Text>
              <Text
                style={[
                  styles.cabinValText,
                  { color: isPhoneRisk ? '#EF4444' : '#10B981' },
                ]}
                numberOfLines={1}
              >
                {phoneDesc}
              </Text>
            </View>

            {/* Row 3: Hands on Wheel */}
            <View style={styles.cabinRow}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Hands:</Text>
              <Text
                style={[
                  styles.cabinValText,
                  { color: handsColor },
                ]}
              >
                {handsText}
              </Text>
            </View>

            {/* Row 4: Seatbelt Compliance */}
            <TouchableOpacity
              style={styles.cabinRow}
              onPress={toggleSeatbelt}
              activeOpacity={0.7}
            >
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Seatbelt:</Text>
              <View style={styles.seatbeltBadge}>
                {isSeatbeltFastened ? (
                  <ShieldCheck size={11} color="#10B981" />
                ) : (
                  <AlertTriangle size={11} color="#EF4444" />
                )}
                <Text
                  style={[
                    styles.cabinValText,
                    { color: isSeatbeltFastened ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {isSeatbeltFastened ? 'Fastened' : 'UNBUCKLED'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Bar: Diagnostics & Live Telemetry Details */}
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => setShowCockpit(true)}
          >
            <Sliders size={13} color={colors.primary} />
            <Text style={[styles.detailsBtnText, { color: colors.primary }]}>
              Telemetry Radar HUD
            </Text>
          </TouchableOpacity>

          <View style={styles.liveBadgeRow}>
            <View style={[styles.liveDot, { backgroundColor: isDriverPresent ? '#10B981' : '#EF4444' }]} />
            <Text style={[styles.liveStatusText, { color: colors.textSecondary }]}>
              {dmsStatus.attentionSummary || 'REAL-TIME 15 FPS PIPELINE'}
            </Text>
          </View>
        </View>
      </AppCard>

      {/* 5. TELEMETRY RADAR HUD MODAL */}
      <LiveDriverCockpit
        visible={showCockpit}
        onClose={() => setShowCockpit(false)}
        vehicleId={busId}
        driverId={driverId}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  alertCard: {
    padding: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    marginBottom: 8,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  alertTitleText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  alertMessageText: {
    color: '#E5E7EB',
    marginTop: 4,
    lineHeight: 18,
  },
  dismissBtn: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 6,
  },
  dismissBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  errorTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorTitle: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 13,
  },
  errorSub: {
    color: '#F87171',
    fontSize: 11,
    marginTop: 2,
  },
  enableCamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  enableCamBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  connectingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  connectingText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  dashboardCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  driverPresenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  driverPresenceText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pulseIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  headerBtnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  sourceChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  serviceToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  serviceToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  telemetryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  telemetryCard: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'space-between',
    minHeight: 88,
  },
  telemetryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  primaryMetricText: {
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryMetricText: {
    fontSize: 10,
    marginTop: 2,
  },
  perclosValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  cabinRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  seatbeltBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cabinValText: {
    fontSize: 10,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  detailsBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  liveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveStatusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
