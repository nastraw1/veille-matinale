package com.bouna.veillematinale.alarm

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import java.util.Calendar

/** Résultat de programmation renvoyé à l'interface : jamais « active » sans programmation réelle. */
data class ScheduleStatus(
  val id: Int,
  val nextTriggerAt: Long?,
  val scheduled: Boolean,
  val snoozed: Boolean,
  val reason: String?,
)

object AlarmScheduler {
  private const val TAG = "VeilleAlarm"
  const val EXTRA_ALARM_ID = "alarmId"
  const val ACTION_FIRE = "com.bouna.veillematinale.alarm.FIRE"

  fun canScheduleExact(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    return am.canScheduleExactAlarms()
  }

  fun notificationsEnabled(ctx: Context): Boolean {
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    return nm.areNotificationsEnabled()
  }

  /** Prochaine occurrence « normale » strictement après [after] (sans tenir compte du snooze). */
  fun nextRegular(alarm: NativeAlarm, after: Long): Long? {
    if (alarm.solar) {
      val t = alarm.triggers.firstOrNull { it > after }
      if (t != null) return t
      if (alarm.oneShot) return null
      // Liste épuisée (application non ouverte depuis longtemps) : heure de secours.
    }
    val cal = Calendar.getInstance()
    for (i in 0..8) {
      cal.timeInMillis = after
      cal.add(Calendar.DAY_OF_YEAR, i)
      cal.set(Calendar.HOUR_OF_DAY, alarm.hour)
      cal.set(Calendar.MINUTE, alarm.minute)
      cal.set(Calendar.SECOND, 0)
      cal.set(Calendar.MILLISECOND, 0)
      val dow = cal.get(Calendar.DAY_OF_WEEK) - 1 // 0 = dimanche
      if (alarm.days.contains(dow) && cal.timeInMillis > after) return cal.timeInMillis
    }
    return null
  }

  private fun requestCode(id: Int) = 100_000 + id

  private fun firePendingIntent(ctx: Context, id: Int, create: Boolean): PendingIntent? {
    val intent = Intent(ctx, AlarmReceiver::class.java).apply {
      action = ACTION_FIRE
      putExtra(EXTRA_ALARM_ID, id)
    }
    val flags = PendingIntent.FLAG_IMMUTABLE or
      (if (create) PendingIntent.FLAG_UPDATE_CURRENT else PendingIntent.FLAG_NO_CREATE)
    return PendingIntent.getBroadcast(ctx, requestCode(id), intent, flags)
  }

  private fun showPendingIntent(ctx: Context, id: Int): PendingIntent {
    val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
      ?: Intent().setPackage(ctx.packageName)
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(ctx, 200_000 + id, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  fun cancel(ctx: Context, id: Int) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    firePendingIntent(ctx, id, false)?.let {
      am.cancel(it)
      it.cancel()
    }
  }

  /** Programme (ou annule) une alarme ; renvoie l'état réel. */
  fun scheduleOne(ctx: Context, alarm: NativeAlarm, now: Long = System.currentTimeMillis()): ScheduleStatus {
    cancel(ctx, alarm.id)
    if (!alarm.enabled) {
      AlarmStore.clearSnooze(ctx, alarm.id)
      return ScheduleStatus(alarm.id, null, false, false, "disabled")
    }
    val regular = nextRegular(alarm, now)
    val snooze = AlarmStore.snoozeUntil(ctx, alarm.id).takeIf { it > now }
    if (snooze == null) AlarmStore.clearSnooze(ctx, alarm.id)
    val next = listOfNotNull(regular, snooze).minOrNull()
      ?: return ScheduleStatus(alarm.id, null, false, false, "no_occurrence")

    if (!canScheduleExact(ctx)) {
      return ScheduleStatus(alarm.id, next, false, snooze != null, "exact_alarm_permission")
    }
    return try {
      val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      // setAlarmClock : alarme de type réveil, exemptée du mode Doze et affichée par le système.
      am.setAlarmClock(AlarmManager.AlarmClockInfo(next, showPendingIntent(ctx, alarm.id)), firePendingIntent(ctx, alarm.id, true)!!)
      val reason = if (!notificationsEnabled(ctx)) "notifications_disabled" else null
      ScheduleStatus(alarm.id, next, true, snooze != null && snooze == next, reason)
    } catch (e: SecurityException) {
      Log.w(TAG, "Programmation refusée", e)
      ScheduleStatus(alarm.id, next, false, false, "exact_alarm_permission")
    }
  }

  /** Reprogramme toutes les alarmes connues et annule celles qui ont été supprimées. */
  fun rescheduleAll(ctx: Context): List<ScheduleStatus> {
    val alarms = AlarmStore.loadAlarms(ctx)
    val ids = alarms.map { it.id }.toSet()
    for (old in AlarmStore.scheduledIds(ctx)) {
      if (!ids.contains(old)) {
        cancel(ctx, old)
        AlarmStore.clearSnooze(ctx, old)
      }
    }
    val now = System.currentTimeMillis()
    val result = alarms.map { scheduleOne(ctx, it, now) }
    AlarmStore.setScheduledIds(ctx, result.filter { it.scheduled }.map { it.id }.toSet())
    return result
  }

  fun statuses(ctx: Context): List<ScheduleStatus> {
    val now = System.currentTimeMillis()
    val exact = canScheduleExact(ctx)
    val notif = notificationsEnabled(ctx)
    return AlarmStore.loadAlarms(ctx).map { a ->
      if (!a.enabled) return@map ScheduleStatus(a.id, null, false, false, "disabled")
      val regular = nextRegular(a, now)
      val snooze = AlarmStore.snoozeUntil(ctx, a.id).takeIf { it > now }
      val next = listOfNotNull(regular, snooze).minOrNull()
      val pending = firePendingIntent(ctx, a.id, false) != null
      val reason = when {
        !exact -> "exact_alarm_permission"
        !pending -> "not_scheduled"
        !notif -> "notifications_disabled"
        else -> null
      }
      ScheduleStatus(a.id, next, exact && pending, snooze != null && snooze == next, reason)
    }
  }

  fun snooze(ctx: Context, id: Int): Long? {
    val alarm = AlarmStore.find(ctx, id) ?: return null
    if (alarm.snoozeMinutes <= 0) return null
    val at = System.currentTimeMillis() + alarm.snoozeMinutes * 60_000L
    AlarmStore.setSnoozeUntil(ctx, id, at)
    scheduleOne(ctx, alarm)
    return at
  }
}
