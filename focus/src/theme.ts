import { Appearance } from 'react-native';

const light = {
  bg: '#F4F5F7',
  card: '#FFFFFF',
  text: '#15181D',
  muted: '#646B76',
  border: '#E1E4E8',
  accent: '#4F46E5',
  accentSoft: '#E8E7FD',
  on: '#4F46E5',
  onText: '#FFFFFF',
  off: '#FFFFFF',
  good: '#0F9D58',
  goodSoft: '#E3F5EA',
  warn: '#B45309',
  warnSoft: '#FEF3C7',
};

const dark: typeof light = {
  bg: '#0F1115',
  card: '#1A1D23',
  text: '#F1F3F5',
  muted: '#9AA1AC',
  border: '#2A2F37',
  accent: '#8B85FF',
  accentSoft: '#2A2850',
  on: '#6D66F5',
  onText: '#FFFFFF',
  off: '#1A1D23',
  good: '#4ADE80',
  goodSoft: '#173524',
  warn: '#FBBF24',
  warnSoft: '#3A2E10',
};

export const isDark = Appearance.getColorScheme() === 'dark';
export const colors = isDark ? dark : light;
