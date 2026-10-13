import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

interface BrandMarkProps {
  size?: number;
}

/**
 * The RAAH (Route & Attendance Assurance Hub) brand mark:
 * A purple-gradient rounded shield enclosing a stylised road leading
 * to a school bus silhouette. Replaces the earlier Raasta Kashmir logo.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 72 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="raahGrad" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#6C5CE7" />
        <Stop offset="1" stopColor="#8B7CF7" />
      </LinearGradient>
      <LinearGradient id="raahRoad" x1="0.5" y1="0" x2="0.5" y2="1">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
        <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.5" />
      </LinearGradient>
    </Defs>
    {/* Background */}
    <Rect x="0" y="0" width="100" height="100" rx="24" fill="url(#raahGrad)" />
    {/* Shield outline */}
    <Path
      d="M 50 14 C 60 14, 78 16, 82 22 L 82 56 C 82 72, 66 84, 50 90 C 34 84, 18 72, 18 56 L 18 22 C 22 16, 40 14, 50 14 Z"
      fill="rgba(255,255,255,0.12)"
      stroke="rgba(255,255,255,0.25)"
      strokeWidth="1"
    />
    {/* Winding road */}
    <Path
      d="M 40 86 C 38 72, 56 64, 50 52 L 56 52 C 68 64, 62 72, 64 86 Z"
      fill="url(#raahRoad)"
    />
    <Path
      d="M 53 86 C 50 73, 63 65, 53 53"
      stroke="#FFFFFF"
      strokeWidth="1.2"
      strokeDasharray="2.5 2"
      fill="none"
      opacity="0.9"
    />
    {/* Bus body */}
    <Rect x="41" y="34" width="18" height="14" rx="3" fill="#FFFFFF" />
    <Rect x="44" y="36.5" width="12" height="5.5" rx="1.5" fill="#5A4BD1" />
    <Rect x="47" y="43" width="6" height="1" rx="0.5" fill="#5A4BD1" />
    {/* Bus roof */}
    <Rect x="46" y="31.5" width="8" height="2.5" rx="1.2" fill="#FFFFFF" />
    {/* Wheels */}
    <Circle cx="44.5" cy="49.5" r="2" fill="#1A1A2E" />
    <Circle cx="55.5" cy="49.5" r="2" fill="#1A1A2E" />
    <Circle cx="44.5" cy="49.5" r="0.8" fill="#FFFFFF" />
    <Circle cx="55.5" cy="49.5" r="0.8" fill="#FFFFFF" />
    {/* Headlights */}
    <Circle cx="43" cy="44.5" r="1.2" fill="#FBBF24" />
    <Circle cx="57" cy="44.5" r="1.2" fill="#FBBF24" />
    {/* Bumper */}
    <Rect x="39.5" y="48" width="21" height="2" rx="1" fill="#FFFFFF" />
  </Svg>
);
