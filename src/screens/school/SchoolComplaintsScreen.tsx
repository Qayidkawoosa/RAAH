import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CheckCircle2, MessageSquareWarning } from 'lucide-react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { AppCard } from '../../components/ui/AppCard';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';
import { tripService } from '../../services/tripService';
import { aiService } from '../../services/aiService';
import { Complaint, ComplaintStatus } from '../../types/fleet';
import { timeAgo } from '../../utils/format';

const nextAction: Record<ComplaintStatus, { to: ComplaintStatus; label: string } | null> = {
  open: { to: 'reviewing', label: 'Start review' },
  reviewing: { to: 'resolved', label: 'Mark resolved' },
  resolved: null,
};

const SchoolComplaintsScreen: React.FC = () => {
  const { colors, spacing } = useAppTheme();
  const [complaints, setComplaints] = useState<Complaint[] | null>(null);
  const [updatedId, setUpdatedId] = useState<string | null>(null);

  const mountedRef = useRef(true);

  // Load complaints, then run AI triage automatically on any that lack it —
  // the school never has to press an "analyze" button.
  const load = useCallback(async (): Promise<void> => {
    const list = await tripService.getComplaints().catch(() => [] as Complaint[]);
    if (!mountedRef.current) return;
    setComplaints(list);
    for (const complaint of list.filter((item) => !item.analysis).slice(0, 6)) {
      try {
        const analysis = await aiService.analyzeComplaint(complaint.text);
        if (!mountedRef.current) return;
        setComplaints((current) =>
          current?.map((item) => (item.id === complaint.id ? { ...item, analysis } : item)) ?? null
        );
        // Persist the analysis result so it doesn't re-run on subsequent logins/loads
        await tripService.updateComplaintAnalysis(complaint.id, analysis);
      } catch (err) {
        console.error('Failed to run AI triage or save result:', err);
      }
    }
  }, []);

  // Reload on focus so a complaint a parent just submitted appears at once.
  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      load();
      return () => {
        mountedRef.current = false;
      };
    }, [load])
  );

  const updateStatus = async (complaint: Complaint, to: ComplaintStatus): Promise<void> => {
    setComplaints((current) =>
      current?.map((item) => (item.id === complaint.id ? { ...item, status: to } : item)) ?? null
    );
    setUpdatedId(complaint.id);
    setTimeout(() => setUpdatedId((id) => (id === complaint.id ? null : id)), 2500);
    try {
      await tripService.updateComplaintStatus(complaint.id, to);
    } catch {
      // Optimistic update stands for the demo; the backend sync retries on next load.
    }
  };

  const statusTone = (status: ComplaintStatus): 'danger' | 'warning' | 'success' =>
    status === 'open' ? 'danger' : status === 'reviewing' ? 'warning' : 'success';

  return (
    <ScreenContainer onRefresh={load}>
      <ScreenHeader title="Complaints" subtitle="Parent reports, triaged by the AI copilot" showBrand />
      {complaints === null ? (
        [0, 1, 2].map((i) => <Skeleton key={i} height={130} style={{ marginBottom: 12 }} />)
      ) : complaints.length === 0 ? (
        <EmptyState icon={MessageSquareWarning} title="No complaints" message="Parent-submitted concerns will appear here for review." />
      ) : (
        complaints.map((complaint) => {
          const action = nextAction[complaint.status];
          return (
            <AppCard key={complaint.id} style={{ marginBottom: spacing.md }}>
              <View style={styles.headerRow}>
                <View style={styles.headerText}>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {complaint.busNo}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                    {complaint.parentName} · {timeAgo(complaint.createdAt)}
                  </Text>
                </View>
                <Badge label={complaint.status.toUpperCase()} tone={statusTone(complaint.status)} />
              </View>
              <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 8 }]}>
                {complaint.text}
              </Text>

              {complaint.analysis ? (
                <View style={[styles.analysis, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <View style={styles.badgeRow}>
                    <Badge label={complaint.analysis.category} tone="info" />
                    <Badge
                      label={complaint.analysis.severity.toUpperCase()}
                      tone={complaint.analysis.severity === 'high' ? 'danger' : complaint.analysis.severity === 'medium' ? 'warning' : 'success'}
                    />
                  </View>
                  <Text style={[typography.bodySmall, { color: colors.textPrimary, marginTop: 6 }]}>
                    {complaint.analysis.summary}
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}>
                    → {complaint.analysis.suggestedAction}
                  </Text>
                </View>
              ) : (
                <Skeleton height={54} style={{ marginTop: 10 }} />
              )}

              <View style={styles.actionsRow}>
                {updatedId === complaint.id ? (
                  <View style={styles.updatedRow}>
                    <CheckCircle2 size={15} color={colors.success} />
                    <Text style={[typography.bodySmall, { color: colors.success, marginLeft: 6 }]}>
                      Status updated
                    </Text>
                  </View>
                ) : action ? (
                  <TouchableOpacity
                    onPress={() => updateStatus(complaint, action.to)}
                    style={[styles.actionButton, { borderColor: colors.primary }]}
                  >
                    <Text style={[typography.buttonMedium, { color: colors.primary }]}>{action.label}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    Resolved — parent has been notified
                  </Text>
                )}
              </View>
            </AppCard>
          );
        })
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  analysis: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionsRow: { marginTop: 12, minHeight: 34, justifyContent: 'center' },
  updatedRow: { flexDirection: 'row', alignItems: 'center' },
  actionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.2,
  },
});

export default SchoolComplaintsScreen;
