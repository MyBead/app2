package expo.modules.fokus

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/** Separate "Время" tile: one tap hides or shows the status-bar clock. */
class ClockTileService : TileService() {
  override fun onStartListening() = render()

  override fun onClick() {
    if (ClockHider.canHide(this)) {
      ClockHider.setHidden(this, !ClockHider.isHidden(this))
      render()
      return
    }
    // Not unlocked yet: open the app, which shows the one-time command.
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startActivityAndCollapse(
        PendingIntent.getActivity(this, 1, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
      )
    } else {
      @Suppress("DEPRECATION")
      startActivityAndCollapse(launch)
    }
  }

  private fun render() {
    val tile = qsTile ?: return
    val hidden = ClockHider.isHidden(this)
    tile.state = when {
      !ClockHider.canHide(this) -> Tile.STATE_INACTIVE
      hidden -> Tile.STATE_ACTIVE
      else -> Tile.STATE_INACTIVE
    }
    tile.label = "Время"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      tile.subtitle = when {
        !ClockHider.canHide(this) -> "Настроить"
        hidden -> "Скрыто"
        else -> "Видно"
      }
    }
    tile.updateTile()
  }
}
