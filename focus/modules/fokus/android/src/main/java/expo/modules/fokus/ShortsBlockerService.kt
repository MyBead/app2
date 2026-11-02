package expo.modules.fokus

import android.accessibilityservice.AccessibilityService
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Toast

/**
 * Accessibility service that closes YouTube Shorts: as soon as the Shorts player appears
 * (from the Shorts tab, the home feed or a link), it presses "Back".
 *
 * The Shorts player is recognised by view ids that only exist there. The same ids are used by
 * the open-source blockers Scrolless ("reel_player_page_container") and Shorts-Blocker
 * ("reel_progress_bar"); if a YouTube update renames them, this list needs updating.
 *
 * The service receives events from YouTube's packages only (see res/xml/fokus_shorts_service.xml).
 */
class ShortsBlockerService : AccessibilityService() {
  private var lastCheck = 0L
  private var lastBack = 0L
  private var lastToast = 0L

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val pkg = event?.packageName?.toString() ?: return
    if (!FocusStore.shortsBlockingNow(this)) return
    val now = SystemClock.uptimeMillis()
    // Content events arrive in bursts; one look at the screen per 250 ms is plenty.
    if (event.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED && now - lastCheck < 250) return
    lastCheck = now
    // After "Back" the player needs a moment to go away; don't press twice.
    if (now - lastBack < 1200) return
    val root = rootInActiveWindow ?: return
    if (!isShorts(root, pkg)) return
    lastBack = now
    performGlobalAction(GLOBAL_ACTION_BACK)
    FocusStore.countShortsBlocked(this)
    if (now - lastToast > 15_000) {
      lastToast = now
      Toast.makeText(this, "Shorts заблокированы «Фокусом»", Toast.LENGTH_SHORT).show()
    }
  }

  override fun onInterrupt() = Unit

  private fun isShorts(root: AccessibilityNodeInfo, pkg: String): Boolean =
    SHORTS_VIEW_IDS.any { id ->
      runCatching { root.findAccessibilityNodeInfosByViewId("$pkg:id/$id") }
        .getOrNull()
        .orEmpty()
        .any { it.isVisibleToUser }
    }

  companion object {
    val SHORTS_VIEW_IDS = listOf("reel_player_page_container", "reel_progress_bar")
  }
}
