package com.bouna.veillematinale.alarm

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Pont Expo ↔ Android pour les alarmes exactes, les autorisations et la notification de veille. */
class VeilleAlarmModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("VeilleAlarm")

    Events("onAlarmEvent")

    OnCreate {
      VeilleAlarmEvents.listener = { type, id ->
        try {
          sendEvent("onAlarmEvent", mapOf("type" to type, "alarmId" to id))
        } catch (_: Exception) {
        }
      }
    }

    OnDestroy {
      VeilleAlarmEvents.listener = null
      AlarmBridge.stopPreview()
    }

    AsyncFunction("syncAlarms") { json: String -> AlarmBridge.syncAlarms(context, json) }
    AsyncFunction("getAlarmStatuses") { AlarmBridge.getStatuses(context) }
    AsyncFunction("rescheduleAll") { AlarmScheduler.rescheduleAll(context).map(AlarmBridge::statusToMap) }
    AsyncFunction("getPermissions") { AlarmBridge.getPermissions(context) }

    Function("openAppSettings") { AlarmBridge.openAppSettings(context) }
    Function("openExactAlarmSettings") { AlarmBridge.openExactAlarmSettings(context) }
    Function("openNotificationSettings") { AlarmBridge.openNotificationSettings(context) }
    Function("openFullScreenIntentSettings") { AlarmBridge.openFullScreenIntentSettings(context) }
    Function("openBatterySettings") { AlarmBridge.openBatterySettings(context) }

    AsyncFunction("listAlarmSounds") { AlarmBridge.listAlarmSounds(context) }
    Function("previewSound") { uri: String? -> AlarmBridge.previewSound(context, uri) }
    Function("stopPreview") { AlarmBridge.stopPreview() }

    Function("stopRinging") { AlarmBridge.stopRinging(context) }
    Function("getRingingAlarmId") { AlarmBridge.ringingAlarmId(context) }
    Function("getNextSystemAlarm") { AlarmBridge.nextSystemAlarm(context) }

    Function("showVigilNotification") { title: String, text: String, endAt: Double ->
      AlarmBridge.showVigilNotification(context, title, text, endAt.toLong())
    }
    Function("hideVigilNotification") { AlarmBridge.hideVigilNotification(context) }
  }
}
