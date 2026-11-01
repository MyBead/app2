package expo.modules.fokus

import android.app.AlarmManager
import android.app.StatusBarManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.provider.Telephony
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

/** Bridge for the app screen. State and settings travel as JSON strings. */
class FokusModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val onChange: () -> Unit = { sendEvent("onChange", mapOf<String, Any?>()) }

  override fun definition() = ModuleDefinition {
    Name("Fokus")

    Events("onChange")

    OnStartObserving { FocusStore.addListener(onChange) }
    OnStopObserving { FocusStore.removeListener(onChange) }
    OnDestroy { FocusStore.removeListener(onChange) }

    Function("getState") { state().toString() }

    Function("setConfig") { json: String ->
      FocusStore.saveConfig(context, JSONObject(json))
    }

    Function("start") { minutes: Int ->
      FocusStore.start(context, minutes)
    }

    Function("stop") {
      FocusStore.stop(context, notify = false)
    }

    Function("getLog") { FocusStore.log(context).toString() }

    Function("clearLog") { FocusStore.clearLog(context) }

    AsyncFunction("getApps") { apps().toString() }

    Function("openApp") { pkg: String ->
      val intent = context.packageManager.getLaunchIntentForPackage(pkg) ?: return@Function false
      launch(intent)
      true
    }

    Function("openListenerSettings") {
      val component = ComponentName(context, FocusListenerService::class.java)
      val detail = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
          .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, component.flattenToString())
      } else {
        null
      }
      if (detail == null || !tryLaunch(detail)) launch(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }

    Function("openDndSettings") {
      launch(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
    }

    Function("openAppSettings") {
      launch(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName)))
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        launch(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + context.packageName)))
      }
    }

    // Android 13+: the system asks "Add the Фокус tile to quick settings?".
    AsyncFunction("requestAddTile") { promise: Promise ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        promise.resolve("unsupported")
        return@AsyncFunction
      }
      val sbm = context.getSystemService(StatusBarManager::class.java)
      if (sbm == null) {
        promise.resolve("unsupported")
        return@AsyncFunction
      }
      sbm.requestAddTileService(
        ComponentName(context, FocusTileService::class.java),
        "Фокус",
        Icon.createWithResource(context, R.drawable.fokus_tile),
        context.mainExecutor,
      ) { result ->
        promise.resolve(
          when (result) {
            StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ADDED -> "added"
            StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ALREADY_ADDED -> "already"
            StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_NOT_ADDED -> "declined"
            else -> "error"
          },
        )
      }
    }
  }

  private fun state(): JSONObject {
    val ctx = context
    val active = FocusStore.isActive(ctx)
    val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
      ctx.getSystemService(AlarmManager::class.java)?.canScheduleExactAlarms() == true
    return JSONObject()
      .put("active", active)
      .put("until", FocusStore.until(ctx))
      .put("startedAt", FocusStore.startedAt(ctx))
      .put("sessionHidden", FocusStore.sessionHidden(ctx))
      .put("listenerEnabled", FocusStore.listenerEnabled(ctx))
      .put("dndAccess", FocusStore.hasDndAccess(ctx))
      .put("exactAlarms", exact)
      .put("canAddTile", Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
      .put("sdk", Build.VERSION.SDK_INT)
      .put("config", FocusStore.configJson(FocusStore.config(ctx)))
  }

  /** Apps with a launcher icon, each with the group it falls into by default. */
  private fun apps(): JSONArray {
    val pm = context.packageManager
    val sms = runCatching { Telephony.Sms.getDefaultSmsPackage(context) }.getOrNull()
    val main = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    @Suppress("DEPRECATION")
    val found = pm.queryIntentActivities(main, 0)
    val seen = mutableSetOf<String>()
    val rows = mutableListOf<JSONObject>()
    for (ri in found) {
      val ai = ri.activityInfo?.applicationInfo ?: continue
      val pkg = ai.packageName
      if (pkg == context.packageName || !seen.add(pkg)) continue
      val label = runCatching { ai.loadLabel(pm).toString() }.getOrDefault(pkg)
      val appCategory = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ai.category else null
      rows.add(
        JSONObject()
          .put("pkg", pkg)
          .put("label", label)
          .put("group", FocusRules.groupOf(pkg, null, appCategory, sms)),
      )
    }
    rows.sortBy { it.getString("label").lowercase() }
    return JSONArray(rows)
  }

  private fun tryLaunch(intent: Intent): Boolean = runCatching { launch(intent) }.isSuccess

  private fun launch(intent: Intent) {
    val activity = appContext.currentActivity
    if (activity != null) {
      activity.startActivity(intent)
    } else {
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }
}
