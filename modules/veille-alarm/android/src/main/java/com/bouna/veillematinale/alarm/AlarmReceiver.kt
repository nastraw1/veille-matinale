package com.bouna.veillematinale.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/** Reçoit le déclenchement d'AlarmManager : lance la sonnerie et programme l'occurrence suivante. */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != AlarmScheduler.ACTION_FIRE) return
    val id = intent.getIntExtra(AlarmScheduler.EXTRA_ALARM_ID, -1)
    val alarm = AlarmStore.find(context, id)
    if (alarm == null || !alarm.enabled) {
      AlarmScheduler.cancel(context, id)
      return
    }
    AlarmStore.clearSnooze(context, id)

    val service = Intent(context, AlarmService::class.java).apply {
      action = AlarmService.ACTION_START
      putExtra(AlarmScheduler.EXTRA_ALARM_ID, id)
    }
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(service)
      else context.startService(service)
    } catch (e: Exception) {
      // Dernier recours : notification plein écran sans service.
      Log.e("VeilleAlarm", "Impossible de démarrer le service de sonnerie", e)
      AlarmService.postFallbackNotification(context, alarm)
    }

    // Occurrence suivante (le lendemain ou au prochain jour sélectionné).
    AlarmScheduler.scheduleOne(context, alarm, System.currentTimeMillis() + 1_000)
  }
}

/** Redémarrage, mise à jour, changement d'heure/fuseau ou d'autorisation : tout reprogrammer. */
class SystemEventsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
      "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED" -> {
        val pending = goAsync()
        try {
          AlarmScheduler.rescheduleAll(context)
          VeilleAlarmEvents.emit("rescheduled", -1)
        } finally {
          pending.finish()
        }
      }
    }
  }
}
