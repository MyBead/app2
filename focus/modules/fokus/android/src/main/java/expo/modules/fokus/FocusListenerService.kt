package expo.modules.fokus

import android.app.Notification
import android.content.ComponentName
import android.content.pm.ApplicationInfo
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Telephony
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Sees every notification posted on the phone (after the user grants "notification access") and,
 * while focus is on, removes the ones from blocked apps. Removed notifications are kept in the
 * app's "missed" list, so nothing is lost.
 */
class FocusListenerService : NotificationListenerService() {
  private val handler = Handler(Looper.getMainLooper())
  private val endRunnable = Runnable { FocusStore.isActive(this) }

  override fun onListenerConnected() {
    instance = this
    if (FocusStore.isActive(this)) {
      hideBlocked()
      armEnd(FocusStore.until(this))
    }
  }

  override fun onListenerDisconnected() {
    if (instance === this) instance = null
    handler.removeCallbacks(endRunnable)
    // Ask Android to reconnect us (it sometimes drops listeners after an update).
    runCatching { requestRebind(ComponentName(this, FocusListenerService::class.java)) }
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (!FocusStore.isActive(this)) return
    val c = FocusStore.config(this)
    handle(sbn, c.blockedGroups, c.apps)
  }

  private fun handle(sbn: StatusBarNotification, blocked: Set<String>, apps: Map<String, Boolean>) {
    val n = sbn.notification ?: return
    val info = appInfo(sbn)
    val posted = FocusRules.Posted(
      pkg = sbn.packageName,
      category = n.category,
      ongoing = sbn.isOngoing,
      foregroundService = n.flags and Notification.FLAG_FOREGROUND_SERVICE != 0,
      appCategory = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) info?.category else null,
      defaultSmsPkg = defaultSms,
      ownPkg = packageName,
    )
    if (!FocusRules.shouldHide(posted, blocked, apps)) return
    runCatching { cancelNotification(sbn.key) }
    // Group summaries only repeat their children, so they are hidden without a log entry.
    if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
    val extras = n.extras
    val title = extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = (extras?.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras?.getCharSequence(Notification.EXTRA_TEXT))
      ?.toString().orEmpty()
    if (title.isEmpty() && text.isEmpty()) return
    FocusStore.logHidden(
      this,
      FocusStore.Hidden(
        key = sbn.key,
        pkg = sbn.packageName,
        app = label(sbn.packageName, info),
        title = title.take(120),
        text = text.take(300),
        time = sbn.postTime,
      ),
    )
  }

  /** Hides what is already in the notification shade (when focus starts or settings change). */
  private fun hideBlocked() {
    if (!FocusStore.isActive(this)) return
    val c = FocusStore.config(this)
    val active = runCatching { activeNotifications }.getOrNull() ?: return
    active.forEach { handle(it, c.blockedGroups, c.apps) }
  }

  private fun armEnd(until: Long) {
    handler.removeCallbacks(endRunnable)
    if (until > 0) handler.postDelayed(endRunnable, (until - System.currentTimeMillis()).coerceAtLeast(0) + 500)
  }

  private val defaultSms: String?
    get() = runCatching { Telephony.Sms.getDefaultSmsPackage(this) }.getOrNull()

  private fun appInfo(sbn: StatusBarNotification): ApplicationInfo? {
    val extras = sbn.notification?.extras
    val fromExtras = runCatching {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        extras?.getParcelable("android.appInfo", ApplicationInfo::class.java)
      } else {
        @Suppress("DEPRECATION")
        extras?.getParcelable("android.appInfo") as? ApplicationInfo
      }
    }.getOrNull()
    return fromExtras ?: runCatching { packageManager.getApplicationInfo(sbn.packageName, 0) }.getOrNull()
  }

  private fun label(pkg: String, info: ApplicationInfo?): String =
    info?.let { runCatching { it.loadLabel(packageManager).toString() }.getOrNull() } ?: pkg

  companion object {
    @Volatile
    private var instance: FocusListenerService? = null

    /** Applies the current settings to notifications already shown. */
    fun sweep() {
      val s = instance ?: return
      s.handler.post { s.hideBlocked() }
    }

    /** Ends the session on time while the phone is awake (the alarm covers deep sleep). */
    fun scheduleEnd(until: Long) {
      val s = instance ?: return
      s.handler.post { s.armEnd(until) }
    }
  }
}
