package com.bouna.veillematinale.alarm

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings

/**
 * Fonctions appelées par le module Expo. Séparées du module pour rester testables
 * et compilables indépendamment d'expo-modules-core.
 */
object AlarmBridge {
  private const val VIGIL_CHANNEL = "veille_session"
  private const val VIGIL_NOTIF_ID = 4343
  private var preview: Ringtone? = null

  fun statusToMap(s: ScheduleStatus): Map<String, Any?> = mapOf(
    "id" to s.id,
    "nextTriggerAt" to s.nextTriggerAt?.toDouble(),
    "scheduled" to s.scheduled,
    "snoozed" to s.snoozed,
    "reason" to s.reason,
  )

  /** Enregistre la liste complète des alarmes (JSON) puis reprogramme tout. */
  fun syncAlarms(ctx: Context, json: String): List<Map<String, Any?>> {
    AlarmStore.saveAlarmsJson(ctx, json)
    return AlarmScheduler.rescheduleAll(ctx).map(::statusToMap)
  }

  fun getStatuses(ctx: Context): List<Map<String, Any?>> = AlarmScheduler.statuses(ctx).map(::statusToMap)

  fun getPermissions(ctx: Context): Map<String, Any?> {
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
    val fullScreen = if (Build.VERSION.SDK_INT >= 34) nm.canUseFullScreenIntent() else true
    return mapOf(
      "sdkInt" to Build.VERSION.SDK_INT,
      "notifications" to nm.areNotificationsEnabled(),
      "exactAlarms" to AlarmScheduler.canScheduleExact(ctx),
      "fullScreenIntent" to fullScreen,
      "ignoringBatteryOptimizations" to pm.isIgnoringBatteryOptimizations(ctx.packageName),
      "manufacturer" to Build.MANUFACTURER,
    )
  }

  private fun start(ctx: Context, intent: Intent): Boolean = try {
    ctx.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    true
  } catch (e: Exception) {
    false
  }

  private fun packageUri(ctx: Context) = Uri.parse("package:" + ctx.packageName)

  fun openAppSettings(ctx: Context): Boolean =
    start(ctx, Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri(ctx)))

  fun openExactAlarmSettings(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
      start(ctx, Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, packageUri(ctx)))
    ) return true
    return openAppSettings(ctx)
  }

  fun openNotificationSettings(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      start(ctx, Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName))
    ) return true
    return openAppSettings(ctx)
  }

  fun openFullScreenIntentSettings(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT >= 34 &&
      start(ctx, Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, packageUri(ctx)))
    ) return true
    return openNotificationSettings(ctx)
  }

  fun openBatterySettings(ctx: Context): Boolean {
    if (start(ctx, Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))) return true
    return openAppSettings(ctx)
  }

  /** Sonneries d'alarme installées sur le téléphone (aucun fichier embarqué, aucun réseau). */
  fun listAlarmSounds(ctx: Context): List<Map<String, Any?>> {
    val out = ArrayList<Map<String, Any?>>()
    for (type in intArrayOf(RingtoneManager.TYPE_ALARM, RingtoneManager.TYPE_RINGTONE)) {
      try {
        val rm = RingtoneManager(ctx)
        rm.setType(type)
        val c = rm.cursor
        while (c.moveToNext()) {
          val uri = rm.getRingtoneUri(c.position)?.toString() ?: continue
          if (out.any { it["uri"] == uri }) continue
          out.add(
            mapOf(
              "title" to c.getString(RingtoneManager.TITLE_COLUMN_INDEX),
              "uri" to uri,
              "kind" to if (type == RingtoneManager.TYPE_ALARM) "alarm" else "ringtone",
            ),
          )
        }
      } catch (_: Exception) {
      }
    }
    return out
  }

  fun previewSound(ctx: Context, uri: String?) {
    stopPreview()
    val u = if (uri.isNullOrEmpty()) {
      RingtoneManager.getActualDefaultRingtoneUri(ctx, RingtoneManager.TYPE_ALARM) ?: Settings.System.DEFAULT_ALARM_ALERT_URI
    } else Uri.parse(uri)
    preview = RingtoneManager.getRingtone(ctx, u)?.apply {
      audioAttributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
      play()
    }
  }

  fun stopPreview() {
    try {
      preview?.stop()
    } catch (_: Exception) {
    }
    preview = null
  }

  fun stopRinging(ctx: Context) {
    if (AlarmService.currentAlarmId >= 0 || AlarmStore.ringingId(ctx) >= 0) {
      try {
        ctx.startService(AlarmService.stopIntent(ctx))
      } catch (_: Exception) {
      }
    }
  }

  fun ringingAlarmId(ctx: Context): Int = if (AlarmService.currentAlarmId >= 0) AlarmService.currentAlarmId else -1

  /** Prochaine alarme système (toutes applis) — utile pour vérifier la programmation. */
  fun nextSystemAlarm(ctx: Context): Double? {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    return am.nextAlarmClock?.triggerTime?.toDouble()
  }

  /** Notification persistante facultative pendant la veille, avec compte à rebours. */
  fun showVigilNotification(ctx: Context, title: String, text: String, endAt: Long) {
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(VIGIL_CHANNEL) == null) {
      nm.createNotificationChannel(
        NotificationChannel(VIGIL_CHANNEL, "Veille en cours", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Rappel discret de l'étape en cours pendant la veille"
          setShowBadge(false)
        },
      )
    }
    val open = Intent(Intent.ACTION_VIEW, Uri.parse("veillematinale://veille")).setPackage(ctx.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val pi = PendingIntent.getActivity(ctx, 400_000, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val b = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(ctx, VIGIL_CHANNEL)
    else @Suppress("DEPRECATION") Notification.Builder(ctx)
    b.setSmallIcon(android.R.drawable.ic_menu_recent_history)
      .setContentTitle(title)
      .setContentText(text)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(pi)
      .setShowWhen(true)
      .setWhen(endAt)
      .setUsesChronometer(true)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) b.setChronometerCountDown(true)
    try {
      nm.notify(VIGIL_NOTIF_ID, b.build())
    } catch (_: SecurityException) {
    }
  }

  fun hideVigilNotification(ctx: Context) {
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    nm.cancel(VIGIL_NOTIF_ID)
  }
}
