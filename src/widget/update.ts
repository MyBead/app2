import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { widgetRows } from '../core/widget';
import { loadPreferences, loadResults } from '../services/storage';
import { hotDealsWidget, WIDGET_NAME } from './HotDealsWidget';

/** The widget for the deals saved by the last refresh. */
export async function renderHotDeals() {
  const [prefs, results] = await Promise.all([loadPreferences(), loadResults()]);
  const rows = widgetRows(
    results.flatMap((r) => r.deals),
    prefs,
  );
  const fetched = results
    .map((r) => r.fetchedAt)
    .filter(Boolean)
    .sort()
    .pop();
  const updated = fetched
    ? new Date(fetched).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : undefined;
  return hotDealsWidget(rows, updated);
}

/** Redraws widgets already on the home screen; does nothing when there are none. */
export async function updateHotDealsWidget(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const widget = await renderHotDeals();
  await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: () => widget }).catch(() => {});
}
