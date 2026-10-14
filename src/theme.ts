import { Appearance } from 'react-native';

/**
 * App colours. Follows the phone's light/dark setting at start-up (styles are created once,
 * so switching the system theme applies after the app restarts).
 */
const light = {
  bg: '#F4F5F7',
  card: '#FFFFFF',
  text: '#1B1D21',
  muted: '#6B7280',
  border: '#E3E5E8',
  /** Green for text and outlines. */
  accent: '#0B7A3E',
  /** Green behind white text (buttons, selected chips). */
  accentStrong: '#0B7A3E',
  accentSoft: '#E3F4EA',
  onAccent: '#FFFFFF',
  hot: '#D93025',
  hotSoft: '#FDECEA',
  warn: '#B45309',
  warnSoft: '#FEF3C7',
  /** Behind product photos, which are shot on white. */
  photoBg: '#FFFFFF',
};

const dark: typeof light = {
  bg: '#111315',
  card: '#1C1F23',
  text: '#ECEEF0',
  muted: '#9AA1AA',
  border: '#2E3238',
  accent: '#4CC985',
  accentStrong: '#1E7F49',
  accentSoft: '#163A26',
  onAccent: '#FFFFFF',
  hot: '#FF7A6E',
  hotSoft: '#3A1E1C',
  warn: '#F0B45A',
  warnSoft: '#3A2E14',
  photoBg: '#F2F2F2',
};

export const isDark = Appearance.getColorScheme() === 'dark';
export const colors = isDark ? dark : light;
