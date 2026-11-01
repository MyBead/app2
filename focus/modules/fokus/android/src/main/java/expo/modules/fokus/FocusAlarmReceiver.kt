package expo.modules.fokus

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Fires at the end of a timed session; isActive() closes an overdue session. */
class FocusAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    FocusStore.isActive(context)
  }
}
