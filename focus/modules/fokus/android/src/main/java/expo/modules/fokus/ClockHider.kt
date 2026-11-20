package expo.modules.fokus

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Settings
import android.service.quicksettings.TileService

/**
 * Hides the clock in the status bar (top left) through SystemUI's "icon_blacklist" setting.
 *
 * Writing it needs WRITE_SECURE_SETTINGS, which Android grants only from an ADB shell
 * (`pm grant pl.fokus.app android.permission.WRITE_SECURE_SETTINGS`). It is not one of the
 * "restricted settings", so the same wireless-debugging shell works on any phone.
 */
object ClockHider {
  private const val KEY = "icon_blacklist"
  private const val CLOCK = "clock"
  private const val PREFS = "fokus_clock"

  /** SystemUI's own default when the setting is empty: hide only these. */
  private const val SYSTEM_DEFAULT = "rotate,headset"

  fun canHide(ctx: Context): Boolean =
    ctx.checkSelfPermission("android.permission.WRITE_SECURE_SETTINGS") == PackageManager.PERMISSION_GRANTED

  fun isHidden(ctx: Context): Boolean = items(read(ctx)).contains(CLOCK)

  /** Returns false when the permission is missing or the system refused the change. */
  fun setHidden(ctx: Context, hide: Boolean): Boolean {
    if (!canHide(ctx)) return false
    val ok = runCatching {
      val current = read(ctx)
      val prefs = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      if (hide) {
        if (items(current).contains(CLOCK)) return@runCatching true
        // Remember the value to put back, so other hidden icons stay as the user had them.
        prefs.edit().putBoolean("saved", true).putString("prev", current).apply()
        val list = items(current ?: SYSTEM_DEFAULT) + CLOCK
        Settings.Secure.putString(ctx.contentResolver, KEY, list.joinToString(","))
      } else {
        val restored = if (prefs.getBoolean("saved", false)) {
          prefs.getString("prev", null)
        } else {
          (items(current) - CLOCK).joinToString(",").ifEmpty { null }
        }
        prefs.edit().clear().apply()
        Settings.Secure.putString(ctx.contentResolver, KEY, restored)
      }
    }.getOrDefault(false)
    runCatching { TileService.requestListeningState(ctx, ComponentName(ctx, ClockTileService::class.java)) }
    return ok && isHidden(ctx) == hide
  }

  private fun read(ctx: Context): String? = Settings.Secure.getString(ctx.contentResolver, KEY)

  private fun items(value: String?): List<String> =
    value.orEmpty().split(",").map { it.trim() }.filter { it.isNotEmpty() }
}
