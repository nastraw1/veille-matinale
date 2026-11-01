package com.bouna.veillematinale.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.util.Log
import java.lang.ref.WeakReference
import java.text.DateFormat
import java.util.Date

/** Écoute légère des évènements natifs, reliée au module JS quand l'application est ouverte. */
object VeilleAlarmEvents {
  @Volatile var listener: ((type: String, alarmId: Int) -> Unit)? = null
  fun emit(type: String, alarmId: Int) {
    try {
      listener?.invoke(type, alarmId)
    } catch (_: Exception) {
    }
  }
}

/**
 * Service de premier plan qui fait sonner l'alarme (flux audio ALARME), vibre,
 * affiche la notification plein écran et s'arrête automatiquement après la durée choisie.
 */
class AlarmService : Service() {
  companion object {
    const val ACTION_START = "com.bouna.veillematinale.alarm.START"
    const val ACTION_STOP = "com.bouna.veillematinale.alarm.STOP"
    const val ACTION_SNOOZE = "com.bouna.veillematinale.alarm.SNOOZE"
    const val CHANNEL_ID = "veille_alarm_ringing"
    const val NOTIF_ID = 4242
    private const val TAG = "VeilleAlarm"

    @Volatile var currentAlarmId: Int = -1
      private set
    var activityRef: WeakReference<AlarmActivity>? = null

    fun ensureChannel(ctx: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (nm.getNotificationChannel(CHANNEL_ID) != null) return
      val ch = NotificationChannel(CHANNEL_ID, "Réveil de veille", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Sonnerie des alarmes de veille matinale"
        setSound(null, null) // le son est joué par le service (flux alarme)
        enableVibration(false) // la vibration est gérée par le service selon le réglage
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        setBypassDnd(true)
      }
      nm.createNotificationChannel(ch)
    }

    fun veilleDeepLink(ctx: Context, alarmId: Int): Intent =
      Intent(Intent.ACTION_VIEW, Uri.parse("veillematinale://veille?alarmId=$alarmId")).apply {
        setPackage(ctx.packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      }

    fun stopIntent(ctx: Context) = Intent(ctx, AlarmService::class.java).setAction(ACTION_STOP)

    fun buildNotification(ctx: Context, alarm: NativeAlarm): Notification {
      ensureChannel(ctx)
      val immutable = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      val full = Intent(ctx, AlarmActivity::class.java).apply {
        putExtra(AlarmScheduler.EXTRA_ALARM_ID, alarm.id)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)
      }
      val fullPi = PendingIntent.getActivity(ctx, 300_000 + alarm.id, full, immutable)
      val stopPi = PendingIntent.getService(ctx, 310_000 + alarm.id, stopIntent(ctx), immutable)
      val vigilPi = PendingIntent.getActivity(ctx, 330_000 + alarm.id, veilleDeepLink(ctx, alarm.id), immutable)

      val b = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(ctx, CHANNEL_ID)
      else @Suppress("DEPRECATION") Notification.Builder(ctx).setPriority(Notification.PRIORITY_MAX)

      b.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
        .setContentTitle(alarm.label)
        .setContentText("Il est " + DateFormat.getTimeInstance(DateFormat.SHORT).format(Date()) + " — l'heure de la veille.")
        .setCategory(Notification.CATEGORY_ALARM)
        .setVisibility(Notification.VISIBILITY_PUBLIC)
        .setOngoing(true)
        .setAutoCancel(false)
        .setContentIntent(fullPi)
        .setFullScreenIntent(fullPi, true)
        .addAction(Notification.Action.Builder(null, "Arrêter", stopPi).build())
      if (alarm.snoozeMinutes > 0) {
        val snoozeIntent = Intent(ctx, AlarmService::class.java).setAction(ACTION_SNOOZE)
        val snoozePi = PendingIntent.getService(ctx, 320_000 + alarm.id, snoozeIntent, immutable)
        b.addAction(Notification.Action.Builder(null, "Répéter (${alarm.snoozeMinutes} min)", snoozePi).build())
      }
      b.addAction(Notification.Action.Builder(null, "Commencer ma veille", vigilPi).build())
      return b.build()
    }

    /** Utilisé si le service ne peut pas démarrer : notification plein écran seule. */
    fun postFallbackNotification(ctx: Context, alarm: NativeAlarm) {
      try {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID, buildNotification(ctx, alarm))
      } catch (e: Exception) {
        Log.e(TAG, "Notification de secours impossible", e)
      }
    }
  }

  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private val handler = Handler(Looper.getMainLooper())
  private val timeout = Runnable { finishRinging("timeout") }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        val id = intent.getIntExtra(AlarmScheduler.EXTRA_ALARM_ID, -1)
        val alarm = AlarmStore.find(this, id)
        if (alarm == null) {
          stopSelf()
          return START_NOT_STICKY
        }
        startRinging(alarm)
      }
      ACTION_SNOOZE -> {
        val id = currentAlarmId
        if (id >= 0) {
          AlarmScheduler.snooze(this, id)
          finishRinging("snoozed")
        } else stopSelf()
      }
      ACTION_STOP -> finishRinging("stopped")
      else -> if (currentAlarmId < 0) stopSelf()
    }
    return START_NOT_STICKY
  }

  private fun startRinging(alarm: NativeAlarm) {
    stopSound()
    currentAlarmId = alarm.id
    AlarmStore.setRingingId(this, alarm.id)
    val notification = buildNotification(this, alarm)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIF_ID, notification)
    }

    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "VeilleMatinale:ringing").apply {
      acquire(alarm.ringMinutes * 60_000L + 30_000L)
    }

    playSound(alarm.soundUri)
    if (alarm.vibrate) startVibration()
    handler.removeCallbacks(timeout)
    handler.postDelayed(timeout, alarm.ringMinutes * 60_000L)

    // Ouvre directement l'écran d'alarme si possible (écran verrouillé / éteint).
    try {
      startActivity(Intent(this, AlarmActivity::class.java).apply {
        putExtra(AlarmScheduler.EXTRA_ALARM_ID, alarm.id)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)
      })
    } catch (_: Exception) {
      // Refusé par le système (Android 10+ en arrière-plan) : la notification plein écran prend le relais.
    }
    VeilleAlarmEvents.emit("fired", alarm.id)
  }

  private fun candidateUris(custom: String?): List<Uri> {
    val list = ArrayList<Uri>()
    if (!custom.isNullOrEmpty()) list.add(Uri.parse(custom))
    RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM)?.let { list.add(it) }
    list.add(Settings.System.DEFAULT_ALARM_ALERT_URI)
    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)?.let { list.add(it) }
    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)?.let { list.add(it) }
    return list
  }

  private fun playSound(custom: String?) {
    val attrs = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    for (uri in candidateUris(custom)) {
      try {
        val mp = MediaPlayer()
        mp.setAudioAttributes(attrs)
        mp.setDataSource(this, uri)
        mp.isLooping = true
        mp.prepare()
        mp.start()
        player = mp
        return
      } catch (e: Exception) {
        Log.w(TAG, "Sonnerie indisponible : $uri", e)
      }
    }
  }

  private fun startVibration() {
    val v = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    vibrator = v
    val pattern = longArrayOf(0, 800, 600, 800, 1200)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      v.vibrate(VibrationEffect.createWaveform(pattern, 0))
    } else {
      @Suppress("DEPRECATION")
      v.vibrate(pattern, 0)
    }
  }

  private fun stopSound() {
    try {
      player?.stop()
    } catch (_: Exception) {
    }
    player?.release()
    player = null
    vibrator?.cancel()
    vibrator = null
  }

  private fun finishRinging(reason: String) {
    val id = currentAlarmId
    handler.removeCallbacks(timeout)
    stopSound()
    currentAlarmId = -1
    AlarmStore.setRingingId(this, -1)
    activityRef?.get()?.finish()
    activityRef = null
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE)
    else @Suppress("DEPRECATION") stopForeground(true)
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    if (id >= 0) VeilleAlarmEvents.emit(reason, id)
    stopSelf()
  }

  override fun onDestroy() {
    handler.removeCallbacks(timeout)
    stopSound()
    wakeLock?.let { if (it.isHeld) it.release() }
    if (currentAlarmId >= 0) {
      AlarmStore.setRingingId(this, -1)
      currentAlarmId = -1
    }
    super.onDestroy()
  }
}
