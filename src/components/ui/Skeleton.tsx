import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../../hooks/useAppTheme';

interface SkeletonProps {
  height: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: ViewStyle;
}

/** Pulsing placeholder used by every loading state. */
export const Skeleton: React.FC<SkeletonProps> = ({ height, width = '100%', radius = 12, style }) => {
  const { colors } = useAppTheme();
  const pulse = useSharedValue(0.45);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[
        { height, width, borderRadius: radius, backgroundColor: colors.surface },
        animatedStyle,
        style,
      ]}
    />
  );
};
