package com.bouna.veillematinale.alarm

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Description d'une alarme côté natif. Elle est transmise par l'application (JS) et
 * conservée dans les SharedPreferences pour pouvoir reprogrammer sans l'application
 * (redémarrage, changement d'heure ou de fuseau).
 *
 * - Alarme fixe : heure/minute locales + jours (0 = dimanche … 6 = samedi), recalculée ici
 *   dans le fuseau courant du téléphone.
 * - Alarme solaire : instants absolus précalculés par le moteur astronomique (indépendants
 *   du fuseau). Si la liste est épuisée, l'heure de secours (hour/minute) est utilisée.
 */
data class NativeAlarm(
  val id: Int,
  val label: String,
  val enabled: Boolean,
  val vibrate: Boolean,
  val soundUri: String?,
  val snoozeMinutes: Int,
  val ringMinutes: Int,
  val hour: Int,
  val minute: Int,
  val days: Set<Int>,
  val solar: Boolean,
  val triggers: List<Long>,
  /** Alarme unique (ex. test) : aucune heure de secours une fois les déclenchements passés. */
  val oneShot: Boolean = false,
) {
  companion object {
    fun fromJson(o: JSONObject): NativeAlarm {
      val daysArr = o.optJSONArray("days") ?: JSONArray()
      val days = HashSet<Int>()
      for (i in 0 until daysArr.length()) days.add(daysArr.optInt(i))
      val trArr = o.optJSONArray("triggers") ?: JSONArray()
      val triggers = ArrayList<Long>()
      for (i in 0 until trArr.length()) triggers.add(trArr.optLong(i))
      triggers.sort()
      return NativeAlarm(
        id = o.getInt("id"),
        label = o.optString("label", "Veille matinale"),
        enabled = o.optBoolean("enabled", false),
        vibrate = o.optBoolean("vibrate", true),
        soundUri = if (o.isNull("soundUri")) null else o.optString("soundUri", "").ifEmpty { null },
        snoozeMinutes = o.optInt("snoozeMinutes", 5),
        ringMinutes = o.optInt("ringMinutes", 10).coerceIn(1, 60),
        hour = o.optInt("hour", 3),
        minute = o.optInt("minute", 0),
        days = if (days.isEmpty()) (0..6).toSet() else days,
        solar = o.optBoolean("solar", false),
        triggers = triggers,
        oneShot = o.optBoolean("oneShot", false),
      )
    }
  }
}

object AlarmStore {
  private const val PREFS = "veille_alarm_store"
  private const val KEY_ALARMS = "alarms_json"
  private const val KEY_SCHEDULED = "scheduled_ids"
  private const val KEY_SNOOZE = "snooze_"
  private const val KEY_RINGING = "ringing_id"

  private fun prefs(ctx: Context): SharedPreferences =
    ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun saveAlarmsJson(ctx: Context, json: String) {
    // Validation : lève une exception si le JSON est invalide, avant d'écraser l'existant.
    JSONArray(json)
    prefs(ctx).edit().putString(KEY_ALARMS, json).apply()
  }

  fun loadAlarms(ctx: Context): List<NativeAlarm> {
    val raw = prefs(ctx).getString(KEY_ALARMS, null) ?: return emptyList()
    return try {
      val arr = JSONArray(raw)
      (0 until arr.length()).map { NativeAlarm.fromJson(arr.getJSONObject(it)) }
    } catch (e: Exception) {
      emptyList()
    }
  }

  fun find(ctx: Context, id: Int): NativeAlarm? = loadAlarms(ctx).firstOrNull { it.id == id }

  fun scheduledIds(ctx: Context): Set<Int> =
    prefs(ctx).getStringSet(KEY_SCHEDULED, emptySet())!!.mapNotNull { it.toIntOrNull() }.toSet()

  fun setScheduledIds(ctx: Context, ids: Set<Int>) {
    prefs(ctx).edit().putStringSet(KEY_SCHEDULED, ids.map { it.toString() }.toSet()).apply()
  }

  fun snoozeUntil(ctx: Context, id: Int): Long = prefs(ctx).getLong(KEY_SNOOZE + id, 0L)

  fun setSnoozeUntil(ctx: Context, id: Int, at: Long) {
    prefs(ctx).edit().putLong(KEY_SNOOZE + id, at).apply()
  }

  fun clearSnooze(ctx: Context, id: Int) {
    prefs(ctx).edit().remove(KEY_SNOOZE + id).apply()
  }

  fun ringingId(ctx: Context): Int = prefs(ctx).getInt(KEY_RINGING, -1)

  fun setRingingId(ctx: Context, id: Int) {
    prefs(ctx).edit().putInt(KEY_RINGING, id).apply()
  }
}
