import React, { useState } from 'react';
import { Text, View, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { CheckCircle2 } from 'lucide-react-native';
import { ScreenContainer } from '../../components/ui/ScreenContainer';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { AiInsightCard } from '../../components/AiInsightCard';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../hooks/useAppTheme';
import { typography } from '../../theme/typography';
import { tripService } from '../../services/tripService';
import { aiService } from '../../services/aiService';
import { ComplaintAnalysis } from '../../types/ai';
import { DEMO_BUS_NO } from '../../constants/demoRoute';
import { AppStackParamList } from '../../navigation/types';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const ReportComplaintScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<Navigation>();
  const { colors, spacing, roundness } = useAppTheme();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [analysis, setAnalysis] = useState<ComplaintAnalysis | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (): Promise<void> => {
    if (!user || text.trim().length < 10) return;
    setSubmitting(true);
    try {
      const result = await aiService.analyzeComplaint(text.trim());
      setAnalysis(result);
      await tripService.submitComplaint(
        user.assignedBusNo ?? DEMO_BUS_NO,
        user.name,
        text.trim(),
        result
      );
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit complaint:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <ScreenHeader title="Report a Concern" subtitle="Reviewed by the school with AI triage" showBrand onBack={() => navigation.goBack()} />

      <View style={{
        backgroundColor: colors.inputBackground,
        borderRadius: roundness.lg,
        borderWidth: 1,
        borderColor: colors.border,
        minHeight: 140,
        padding: spacing.md,
      }}>
        <TextInput
          multiline
          numberOfLines={6}
          placeholder="Describe what happened — e.g. the bus was speeding near Dalgate this morning…"
          placeholderTextColor={colors.textSecondary}
          value={text}
          onChangeText={setText}
          editable={!submitted}
          style={[typography.bodyMedium, { 
            color: colors.textPrimary,
            textAlignVertical: 'top',
            flex: 1
          }]}
        />
      </View>

      {!submitted ? (
        <PrimaryButton
          label="Submit to School"
          onPress={handleSubmit}
          loading={submitting}
          disabled={text.trim().length < 10}
          style={{ marginTop: spacing.lg }}
        />
      ) : (
        <View style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <CheckCircle2 size={18} color={colors.success} />
            <Text style={[typography.titleMedium, { color: colors.success, marginLeft: 8 }]}>
              Complaint submitted to the school
            </Text>
          </View>
          {analysis ? (
            <AiInsightCard title="AI Triage">
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <Badge label={analysis.category} tone="info" />
                <Badge
                  label={`${analysis.severity.toUpperCase()} severity`}
                  tone={analysis.severity === 'high' ? 'danger' : analysis.severity === 'medium' ? 'warning' : 'success'}
                />
              </View>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{analysis.summary}</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 6 }]}>
                Next step: {analysis.suggestedAction}
              </Text>
            </AiInsightCard>
          ) : null}
          <PrimaryButton label="Done" onPress={() => navigation.goBack()} />
        </View>
      )}
    </ScreenContainer>
  );
};

export default ReportComplaintScreen;
