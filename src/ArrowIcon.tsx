import React from 'react';
import Svg, { Path } from 'react-native-svg';

export function ArrowIcon({ direction, color = '#103D46', size = 22 }: { direction: 'left' | 'right'; color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
    {direction === 'left' ? <Path d="m12 19-7-7 7-7M5 12h14" /> : <Path d="m12 5 7 7-7 7M19 12H5" />}
  </Svg>;
}

export function CalendarIcon({ color = '#103D46', size = 22 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
    <Path d="M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
  </Svg>;
}
