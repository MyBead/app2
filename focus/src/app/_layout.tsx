import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors, isDark } from '../theme';

const base = isDark ? DarkTheme : DefaultTheme;
const theme = {
  ...base,
  colors: { ...base.colors, primary: colors.accent, background: colors.bg, card: colors.bg, text: colors.text },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </ThemeProvider>
  );
}
