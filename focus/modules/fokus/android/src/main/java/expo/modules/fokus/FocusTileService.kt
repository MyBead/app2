package expo.modules.fokus

import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import java.text.DateFormat
import java.util.Date

/** "Фокус" tile in the quick settings: one tap turns focus on or off without opening the app. */
class FocusTileService : TileService() {
  override fun onStartListening() = render()

  override fun onClick() {
    if (FocusStore.listenerEnabled(this)) {
      FocusStore.toggle(this, notifyOnStop = true)
      render()
      return
    }
    // Not set up yet: open the app, which explains how to grant notification access.
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return
    launch.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val pi = android.app.PendingIntent.getActivity(
        this,
        0,
        launch,
        android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT,
      )
      startActivityAndCollapse(pi)
    } else {
      @Suppress("DEPRECATION")
      startActivityAndCollapse(launch)
    }
  }

  private fun render() {
    val tile = qsTile ?: return
    val active = FocusStore.isActive(this)
    tile.state = if (active) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
    tile.label = "Фокус"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val until = FocusStore.until(this)
      tile.subtitle = when {
        !active -> "Выкл."
        until > 0 -> "до " + DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(until))
        else -> "Вкл."
      }
    }
    tile.updateTile()
  }
}
