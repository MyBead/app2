package expo.modules.fokus

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.service.quicksettings.TileService
import org.json.JSONArray
import org.json.JSONObject

/**
 * The single source of truth for a focus session, shared by the app screen, the notification
 * listener, the quick-settings tile and the timer. Everything lives in SharedPreferences so each
 * of them sees the same state even when the app itself is closed.
 */
object FocusStore {
  private const val PREFS = "fokus"
  private const val LOG_LIMIT = 300
  private const val SUMMARY_CHANNEL = "fokus_summary"
  private const val SUMMARY_ID = 4201
  private const val ALARM_REQUEST = 4202

  const val CALLERS_ANY = "any"
  const val CALLERS_CONTACTS = "contacts"
  const val CALLERS_STARRED = "starred"

  const val SHORTS_OFF = "off"
  const val SHORTS_FOCUS = "focus"
  const val SHORTS_ALWAYS = "always"

  /** Called whenever the state changes (the app screen subscribes while it is open). */
  private val listeners = mutableSetOf<() -> Unit>()

  fun addListener(l: () -> Unit) = synchronized(listeners) { listeners.add(l) }
  fun removeListener(l: () -> Unit) = synchronized(listeners) { listeners.remove(l) }

  private fun changed(ctx: Context) {
    synchronized(listeners) { listeners.toList() }.forEach { runCatching { it() } }
    runCatching { TileService.requestListeningState(ctx, ComponentName(ctx, FocusTileService::class.java)) }
  }

  private fun prefs(ctx: Context): SharedPreferences =
    ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  // ---------- settings ----------

  data class Config(
    val blockedGroups: Set<String>,
    val apps: Map<String, Boolean>,
    val silence: Boolean,
    val callers: String,
    val repeatCallers: Boolean,
    val minutes: Int,
    /** YouTube Shorts: "off", "focus" (only during focus) or "always". */
    val shorts: String,
  )

  fun config(ctx: Context): Config {
    val p = prefs(ctx)
    val groups = p.getString("groups", null)?.let { s ->
      val a = JSONArray(s)
      (0 until a.length()).map { a.getString(it) }.toSet()
    } ?: FocusRules.DEFAULT_BLOCKED
    val apps = p.getString("apps", null)?.let { s ->
      val o = JSONObject(s)
      o.keys().asSequence().associateWith { o.getBoolean(it) }
    } ?: emptyMap()
    return Config(
      blockedGroups = groups,
      apps = apps,
      silence = p.getBoolean("silence", true),
      callers = p.getString("callers", CALLERS_ANY) ?: CALLERS_ANY,
      repeatCallers = p.getBoolean("repeatCallers", true),
      minutes = p.getInt("minutes", 0),
      shorts = p.getString("shorts", SHORTS_ALWAYS) ?: SHORTS_ALWAYS,
    )
  }

  fun configJson(c: Config): JSONObject = JSONObject()
    .put("blockedGroups", JSONArray(c.blockedGroups.toList()))
    .put("apps", JSONObject(c.apps))
    .put("silence", c.silence)
    .put("callers", c.callers)
    .put("repeatCallers", c.repeatCallers)
    .put("minutes", c.minutes)
    .put("shorts", c.shorts)

  fun saveConfig(ctx: Context, json: JSONObject) {
    val e = prefs(ctx).edit()
    json.optJSONArray("blockedGroups")?.let { e.putString("groups", it.toString()) }
    json.optJSONObject("apps")?.let { e.putString("apps", it.toString()) }
    if (json.has("silence")) e.putBoolean("silence", json.getBoolean("silence"))
    if (json.has("callers")) e.putString("callers", json.getString("callers"))
    if (json.has("repeatCallers")) e.putBoolean("repeatCallers", json.getBoolean("repeatCallers"))
    if (json.has("minutes")) e.putInt("minutes", json.getInt("minutes"))
    if (json.has("shorts")) e.putString("shorts", json.getString("shorts"))
    e.apply()
    // Settings changed mid-session: apply them right away.
    if (isActive(ctx)) {
      applySilence(ctx)
      FocusListenerService.sweep()
    }
    changed(ctx)
  }

  // ---------- session ----------

  /** Active and not yet past its end time (an overdue session is closed here). */
  fun isActive(ctx: Context): Boolean {
    val p = prefs(ctx)
    if (!p.getBoolean("active", false)) return false
    val until = p.getLong("until", 0)
    if (until > 0 && System.currentTimeMillis() >= until) {
      stop(ctx, notify = true)
      return false
    }
    return true
  }

  fun until(ctx: Context): Long = prefs(ctx).getLong("until", 0)
  fun startedAt(ctx: Context): Long = prefs(ctx).getLong("startedAt", 0)
  fun sessionHidden(ctx: Context): Int = prefs(ctx).getInt("sessionHidden", 0)

  /** Starts focus for [minutes] (0 = until turned off). */
  fun start(ctx: Context, minutes: Int) {
    val now = System.currentTimeMillis()
    val until = if (minutes > 0) now + minutes * 60_000L else 0L
    prefs(ctx).edit()
      .putBoolean("active", true)
      .putLong("startedAt", now)
      .putLong("until", until)
      .putInt("minutes", minutes)
      .putInt("sessionHidden", 0)
      .apply()
    ctx.getSystemService(NotificationManager::class.java)?.cancel(SUMMARY_ID)
    scheduleEnd(ctx, until)
    applySilence(ctx)
    FocusListenerService.sweep()
    FocusListenerService.scheduleEnd(until)
    changed(ctx)
  }

  /** Ends focus; with [notify], posts a summary of what was hidden. */
  fun stop(ctx: Context, notify: Boolean) {
    val p = prefs(ctx)
    if (!p.getBoolean("active", false)) return
    val hidden = p.getInt("sessionHidden", 0)
    val startedAt = p.getLong("startedAt", 0)
    p.edit().putBoolean("active", false).putLong("until", 0).apply()
    scheduleEnd(ctx, 0)
    FocusListenerService.scheduleEnd(0)
    restoreSilence(ctx)
    if (notify && hidden > 0) postSummary(ctx, hidden, startedAt)
    changed(ctx)
  }

  fun toggle(ctx: Context, notifyOnStop: Boolean) {
    if (isActive(ctx)) stop(ctx, notifyOnStop) else start(ctx, config(ctx).minutes)
  }

  private fun scheduleEnd(ctx: Context, until: Long) {
    val am = ctx.getSystemService(AlarmManager::class.java) ?: return
    val pi = PendingIntent.getBroadcast(
      ctx,
      ALARM_REQUEST,
      Intent(ctx, FocusAlarmReceiver::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    am.cancel(pi)
    if (until <= 0) return
    val exactAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
    runCatching {
      if (exactAllowed) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, until, pi)
      else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, until, pi)
    }
  }

  // ---------- "silence": Do Not Disturb that lets calls ring ----------

  fun hasDndAccess(ctx: Context): Boolean =
    ctx.getSystemService(NotificationManager::class.java)?.isNotificationPolicyAccessGranted == true

  private fun applySilence(ctx: Context) {
    val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
    val c = config(ctx)
    if (!c.silence) {
      restoreSilence(ctx)
      return
    }
    if (!nm.isNotificationPolicyAccessGranted) return
    val p = prefs(ctx)
    runCatching {
      if (!p.getBoolean("dndByUs", false)) {
        // Remember the user's own Do Not Disturb setup to put it back afterwards.
        val prev = nm.notificationPolicy
        p.edit()
          .putBoolean("dndByUs", true)
          .putInt("prevFilter", nm.currentInterruptionFilter)
          .putInt("prevCategories", prev.priorityCategories)
          .putInt("prevCallSenders", prev.priorityCallSenders)
          .putInt("prevMessageSenders", prev.priorityMessageSenders)
          .putInt("prevVisual", prev.suppressedVisualEffects)
          .apply()
      }
      var categories = NotificationManager.Policy.PRIORITY_CATEGORY_CALLS
      if (c.repeatCallers) categories = categories or NotificationManager.Policy.PRIORITY_CATEGORY_REPEAT_CALLERS
      val senders = when (c.callers) {
        CALLERS_CONTACTS -> NotificationManager.Policy.PRIORITY_SENDERS_CONTACTS
        CALLERS_STARRED -> NotificationManager.Policy.PRIORITY_SENDERS_STARRED
        else -> NotificationManager.Policy.PRIORITY_SENDERS_ANY
      }
      val policy = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        categories = categories or
          NotificationManager.Policy.PRIORITY_CATEGORY_ALARMS or
          NotificationManager.Policy.PRIORITY_CATEGORY_MEDIA or
          NotificationManager.Policy.PRIORITY_CATEGORY_SYSTEM
        // Silenced notifications don't pop up over the screen either.
        val visual = NotificationManager.Policy.SUPPRESSED_EFFECT_PEEK or
          NotificationManager.Policy.SUPPRESSED_EFFECT_FULL_SCREEN_INTENT or
          NotificationManager.Policy.SUPPRESSED_EFFECT_LIGHTS
        NotificationManager.Policy(categories, senders, senders, visual)
      } else {
        NotificationManager.Policy(categories, senders, senders)
      }
      nm.notificationPolicy = policy
      nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY)
    }
  }

  private fun restoreSilence(ctx: Context) {
    val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
    val p = prefs(ctx)
    if (!p.getBoolean("dndByUs", false)) return
    p.edit().putBoolean("dndByUs", false).apply()
    if (!nm.isNotificationPolicyAccessGranted) return
    runCatching {
      // Android 15+ keeps an app's Do Not Disturb in its own "mode", so the user's settings were
      // never touched; older versions share one policy, which is put back as it was.
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
        val policy = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          NotificationManager.Policy(
            p.getInt("prevCategories", 0),
            p.getInt("prevCallSenders", 0),
            p.getInt("prevMessageSenders", 0),
            p.getInt("prevVisual", 0),
          )
        } else {
          NotificationManager.Policy(
            p.getInt("prevCategories", 0),
            p.getInt("prevCallSenders", 0),
            p.getInt("prevMessageSenders", 0),
          )
        }
        nm.notificationPolicy = policy
      }
      val prev = p.getInt("prevFilter", NotificationManager.INTERRUPTION_FILTER_ALL)
      nm.setInterruptionFilter(
        if (prev == NotificationManager.INTERRUPTION_FILTER_UNKNOWN) NotificationManager.INTERRUPTION_FILTER_ALL else prev,
      )
    }
  }

  // ---------- hidden notifications ----------

  data class Hidden(val key: String, val pkg: String, val app: String, val title: String, val text: String, val time: Long)

  /** Records a hidden notification; a re-post of the very same one replaces its entry. */
  @Synchronized
  fun logHidden(ctx: Context, h: Hidden) {
    val p = prefs(ctx)
    val old = JSONArray(p.getString("log", "[]"))
    val out = JSONArray()
    out.put(
      JSONObject()
        .put("key", h.key)
        .put("pkg", h.pkg)
        .put("app", h.app)
        .put("title", h.title)
        .put("text", h.text)
        .put("time", h.time),
    )
    var replaced = false
    for (i in 0 until old.length()) {
      val o = old.getJSONObject(i)
      if (o.optString("key") == h.key && o.optString("title") == h.title && o.optString("text") == h.text) {
        replaced = true
        continue
      }
      if (out.length() < LOG_LIMIT) out.put(o)
    }
    val e = p.edit().putString("log", out.toString())
    if (!replaced) {
      e.putInt("sessionHidden", p.getInt("sessionHidden", 0) + 1)
      e.putInt("totalHidden", p.getInt("totalHidden", 0) + 1)
    }
    e.apply()
    changed(ctx)
  }

  fun log(ctx: Context): JSONArray = JSONArray(prefs(ctx).getString("log", "[]"))

  @Synchronized
  fun clearLog(ctx: Context) {
    prefs(ctx).edit().putString("log", "[]").apply()
    changed(ctx)
  }

  private fun postSummary(ctx: Context, hidden: Int, startedAt: Long) {
    val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ctx.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      nm.createNotificationChannel(
        NotificationChannel(SUMMARY_CHANNEL, "Итоги фокуса", NotificationManager.IMPORTANCE_DEFAULT),
      )
    }
    // Top apps of this session, e.g. "Telegram 7 · Instagram 3".
    val counts = linkedMapOf<String, Int>()
    val log = log(ctx)
    for (i in 0 until log.length()) {
      val o = log.getJSONObject(i)
      if (o.optLong("time") < startedAt) break
      val app = o.optString("app")
      counts[app] = (counts[app] ?: 0) + 1
    }
    val top = counts.entries.sortedByDescending { it.value }.take(3).joinToString(" · ") { "${it.key} ${it.value}" }
    val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
    val content = launch?.let {
      PendingIntent.getActivity(ctx, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    @Suppress("DEPRECATION")
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      android.app.Notification.Builder(ctx, SUMMARY_CHANNEL)
    } else {
      android.app.Notification.Builder(ctx)
    }
    val n = builder
      .setSmallIcon(R.drawable.fokus_tile)
      .setContentTitle("Фокус закончился · скрыто $hidden")
      .setContentText(top.ifEmpty { "Откройте, чтобы посмотреть пропущенное" })
      .setAutoCancel(true)
      .apply { content?.let { setContentIntent(it) } }
      .build()
    runCatching { nm.notify(SUMMARY_ID, n) }
  }

  // ---------- permissions ----------

  fun accessibilityEnabled(ctx: Context): Boolean {
    val flat = Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
    val me = ComponentName(ctx, ShortsBlockerService::class.java)
    return flat.split(":").any { ComponentName.unflattenFromString(it) == me }
  }

  // ---------- YouTube Shorts ----------

  /** Whether Shorts should be closed right now. */
  fun shortsBlockingNow(ctx: Context): Boolean = when (prefs(ctx).getString("shorts", SHORTS_ALWAYS)) {
    SHORTS_ALWAYS -> true
    SHORTS_FOCUS -> isActive(ctx)
    else -> false
  }

  fun shortsBlocked(ctx: Context): Int = prefs(ctx).getInt("shortsBlocked", 0)

  fun countShortsBlocked(ctx: Context) {
    val p = prefs(ctx)
    p.edit().putInt("shortsBlocked", p.getInt("shortsBlocked", 0) + 1).apply()
    changed(ctx)
  }

  fun listenerEnabled(ctx: Context): Boolean {
    val flat = Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners") ?: return false
    val me = ComponentName(ctx, FocusListenerService::class.java)
    return flat.split(":").any { ComponentName.unflattenFromString(it) == me }
  }
}
