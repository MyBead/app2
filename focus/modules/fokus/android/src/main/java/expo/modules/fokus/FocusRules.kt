package expo.modules.fokus

/**
 * Decides which notifications a focus session hides. Pure Kotlin (no Android types),
 * so the rules are easy to read in one place.
 *
 * Calls are never hidden: neither the phone app (incoming / missed calls) nor messenger calls
 * (any notification with category "call"). Alarms, timers, navigation, media players and other
 * ongoing notifications are left alone too.
 */
object FocusRules {
  const val MESSENGERS = "messengers"
  const val SOCIAL = "social"
  const val MAIL = "mail"
  const val SHOPPING = "shopping"
  const val GAMES = "games"
  const val SMS = "sms"
  const val OTHER = "other"

  val GROUPS = listOf(MESSENGERS, SOCIAL, MAIL, SHOPPING, GAMES, SMS, OTHER)

  /** Blocked out of the box: everything chatty, but SMS stays (bank and login codes). */
  val DEFAULT_BLOCKED = setOf(MESSENGERS, SOCIAL, MAIL, SHOPPING, GAMES)

  /** Phone, telecom and system packages: incoming-call screens and missed calls live here. */
  private val NEVER_BLOCK = setOf(
    "android",
    "com.android.systemui",
    "com.android.phone",
    "com.android.server.telecom",
    "com.android.dialer",
    "com.google.android.dialer",
    "com.samsung.android.dialer",
    "com.samsung.android.incallui",
    "com.android.incallui",
    "com.miui.voip",
    "com.android.contacts",
    "com.google.android.contacts",
    "com.samsung.android.app.contacts",
    "com.oneplus.dialer",
    "com.huawei.contacts",
    "com.android.deskclock",
    "com.google.android.deskclock",
    "com.sec.android.app.clockpackage",
  )

  /** Categories that must always get through (Notification.CATEGORY_* values). */
  private val NEVER_BLOCK_CATEGORIES = setOf(
    "call",
    "missed_call",
    "alarm",
    "reminder",
    "event",
    "navigation",
    "transport",
    "stopwatch",
    "sys",
    "location_sharing",
  )

  private val KNOWN = mapOf(
    // Messengers and work chats
    "org.telegram.messenger" to MESSENGERS,
    "org.telegram.messenger.web" to MESSENGERS,
    "org.telegram.plus" to MESSENGERS,
    "org.thunderdog.challegram" to MESSENGERS,
    "com.whatsapp" to MESSENGERS,
    "com.whatsapp.w4b" to MESSENGERS,
    "com.viber.voip" to MESSENGERS,
    "com.facebook.orca" to MESSENGERS,
    "com.facebook.mlite" to MESSENGERS,
    "org.thoughtcrime.securesms" to MESSENGERS,
    "com.discord" to MESSENGERS,
    "com.Slack" to MESSENGERS,
    "com.microsoft.teams" to MESSENGERS,
    "com.skype.raider" to MESSENGERS,
    "com.google.android.apps.dynamite" to MESSENGERS,
    "jp.naver.line.android" to MESSENGERS,
    "com.tencent.mm" to MESSENGERS,
    "kik.android" to MESSENGERS,
    "im.vector.app" to MESSENGERS,
    "ru.oneme.app" to MESSENGERS,
    // Social networks and video
    "com.instagram.barcelona" to SOCIAL,
    "com.instagram.android" to SOCIAL,
    "com.facebook.katana" to SOCIAL,
    "com.facebook.lite" to SOCIAL,
    "com.zhiliaoapp.musically" to SOCIAL,
    "com.ss.android.ugc.trill" to SOCIAL,
    "com.twitter.android" to SOCIAL,
    "com.snapchat.android" to SOCIAL,
    "com.vkontakte.android" to SOCIAL,
    "ru.ok.android" to SOCIAL,
    "com.reddit.frontpage" to SOCIAL,
    "com.pinterest" to SOCIAL,
    "com.linkedin.android" to SOCIAL,
    "com.google.android.youtube" to SOCIAL,
    "com.google.android.apps.youtube.music" to SOCIAL,
    "tv.twitch.android.app" to SOCIAL,
    "com.tumblr" to SOCIAL,
    "com.bereal.ft" to SOCIAL,
    "org.joinmastodon.android" to SOCIAL,
    "xyz.blueskyweb.app" to SOCIAL,
    "com.netflix.mediaclient" to SOCIAL,
    "com.spotify.music" to SOCIAL,
    // Mail
    "com.google.android.gm" to MAIL,
    "com.google.android.gm.lite" to MAIL,
    "com.microsoft.office.outlook" to MAIL,
    "com.samsung.android.email.provider" to MAIL,
    "ch.protonmail.android" to MAIL,
    "ru.yandex.mail" to MAIL,
    "ru.mail.mailapp" to MAIL,
    "com.yahoo.mobile.client.android.mail" to MAIL,
    "com.easilydo.mail" to MAIL,
    "com.readdle.spark" to MAIL,
    "com.fsck.k9" to MAIL,
    "net.thunderbird.android" to MAIL,
    "pl.wp.pocztao2" to MAIL,
    "pl.interia.poczta" to MAIL,
    "pl.onet.mail" to MAIL,
    // Shopping, deals, delivery, news
    "pl.allegro" to SHOPPING,
    "pl.tablica" to SHOPPING,
    "fr.vinted" to SHOPPING,
    "com.einnovation.temu" to SHOPPING,
    "com.alibaba.aliexpresshd" to SHOPPING,
    "com.amazon.mShop.android.shopping" to SHOPPING,
    "com.zzkko" to SHOPPING,
    "pl.okazje.app" to SHOPPING,
    "com.lidl.eci.lidlplus" to SHOPPING,
    "pl.biedronka" to SHOPPING,
    "pl.zabka.apb2c" to SHOPPING,
    "com.glovo" to SHOPPING,
    "com.ubercab.eats" to SHOPPING,
    "com.takeaway.android" to SHOPPING,
    "com.wolt.android" to SHOPPING,
    "ru.ozon.app.android" to SHOPPING,
    "com.wildberries.ru" to SHOPPING,
    "com.google.android.apps.magazines" to SHOPPING,
    "flipboard.app" to SHOPPING,
    "com.android.vending" to SHOPPING,
  )

  /** SMS apps (the default SMS app is detected at runtime as well). */
  private val SMS_APPS = setOf(
    "com.google.android.apps.messaging",
    "com.samsung.android.messaging",
    "com.android.mms",
    "com.android.messaging",
    "com.oneplus.mms",
    "com.miui.mms",
    "com.huawei.message",
  )

  /** Android's app categories (ApplicationInfo.CATEGORY_*). */
  private const val APP_CATEGORY_GAME = 0
  private const val APP_CATEGORY_AUDIO = 1
  private const val APP_CATEGORY_VIDEO = 2
  private const val APP_CATEGORY_SOCIAL = 4
  private const val APP_CATEGORY_NEWS = 5

  /** Facts about one notification, gathered by the listener service. */
  data class Posted(
    val pkg: String,
    val category: String?,
    val ongoing: Boolean,
    val foregroundService: Boolean,
    val appCategory: Int?,
    val defaultSmsPkg: String?,
    val ownPkg: String,
  )

  /** Which group an app belongs to, before any per-app choice. */
  fun groupOf(pkg: String, notificationCategory: String?, appCategory: Int?, defaultSmsPkg: String?): String {
    if (pkg == defaultSmsPkg || pkg in SMS_APPS) return SMS
    KNOWN[pkg]?.let { return it }
    when (notificationCategory) {
      "msg" -> return MESSENGERS
      "email" -> return MAIL
      "social" -> return SOCIAL
      "promo", "recommendation" -> return SHOPPING
    }
    return when (appCategory) {
      APP_CATEGORY_GAME -> GAMES
      APP_CATEGORY_SOCIAL, APP_CATEGORY_VIDEO, APP_CATEGORY_AUDIO -> SOCIAL
      APP_CATEGORY_NEWS -> SHOPPING
      else -> if (pkg.contains("mail", ignoreCase = true)) MAIL else OTHER
    }
  }

  /** Notifications that are never touched, whatever the user picked. */
  fun isProtected(n: Posted): Boolean =
    n.pkg == n.ownPkg ||
      n.pkg in NEVER_BLOCK ||
      n.category in NEVER_BLOCK_CATEGORIES ||
      n.ongoing ||
      n.foregroundService

  fun shouldHide(n: Posted, blockedGroups: Set<String>, appChoices: Map<String, Boolean>): Boolean {
    if (isProtected(n)) return false
    appChoices[n.pkg]?.let { return it }
    return groupOf(n.pkg, n.category, n.appCategory, n.defaultSmsPkg) in blockedGroups
  }
}
