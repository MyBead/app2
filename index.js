// Expo Router's entry plus the Android home-screen widget, which must be registered at startup
// so the launcher can render it without opening the app.
import 'expo-router/entry';
import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from './src/widget/taskHandler';

if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler);
