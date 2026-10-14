import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { renderHotDeals } from './update';

/** Runs headless when the launcher adds, resizes or periodically refreshes the widget. */
export async function widgetTaskHandler({ widgetAction, renderWidget }: WidgetTaskHandlerProps): Promise<void> {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  renderWidget(await renderHotDeals());
}
