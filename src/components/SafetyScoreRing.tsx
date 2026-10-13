import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAppTheme } from '../hooks/useAppTheme';
import { typography } from '../theme/typography';

interface SafetyScoreRingProps {
  score: number;
  size?: number;
  label?: string;
}

/** Circular AI safety-score gauge (SVG progress ring). */
export const SafetyScoreRing: React.FC<SafetyScoreRingProps> = ({
  score,
  size = 110,
  label = 'Safety Score',
}) => {
  const { colors } = useAppTheme();
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const ringColor =
    clamped >= 85 ? colors.success : clamped >= 65 ? colors.warning : colors.danger;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surface}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[styles.center, { maxWidth: size * 0.68 }]}>
        <Text style={[typography.h2, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
          {Math.round(clamped)}
        </Text>
        <Text
          style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {label}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', paddingHorizontal: 8 },
});
