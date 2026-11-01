package com.bouna.veillematinale.alarm

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.lang.ref.WeakReference
import java.text.DateFormat
import java.util.Date

/** Écran d'alarme affiché par-dessus l'écran verrouillé. */
class AlarmActivity : Activity() {
  private val gold = Color.parseColor("#D9B46A")
  private val night = Color.parseColor("#070D1F")
  private val deep = Color.parseColor("#16295A")
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var clock: TextView
  private val tick = object : Runnable {
    override fun run() {
      clock.text = DateFormat.getTimeInstance(DateFormat.SHORT).format(Date())
      handler.postDelayed(this, 1_000)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    showOverLockScreen()
    AlarmService.activityRef = WeakReference(this)

    val id = intent.getIntExtra(AlarmScheduler.EXTRA_ALARM_ID, AlarmStore.ringingId(this))
    val alarm = AlarmStore.find(this, id)
    if (AlarmService.currentAlarmId < 0 && AlarmStore.ringingId(this) < 0) {
      // L'alarme a déjà été arrêtée (ex. depuis la notification).
      finish()
      return
    }

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(night)
      setPadding(dp(28), dp(48), dp(28), dp(48))
    }
    root.addView(text("VEILLE MATINALE", 15f, gold, bold = true, spacing = 0.2f))
    clock = text("", 72f, Color.WHITE, bold = false)
    root.addView(clock, margins(top = 24))
    root.addView(text(alarm?.label ?: "Réveil", 20f, Color.WHITE, bold = true), margins(top = 8))
    root.addView(text("Le moment de la veille est venu.", 15f, Color.parseColor("#A3AECB")), margins(top = 6))

    root.addView(button("Commencer ma veille", filled = true) {
      startService(AlarmService.stopIntent(this))
      startActivity(AlarmService.veilleDeepLink(this, id))
      finish()
    }, margins(top = 48))
    if ((alarm?.snoozeMinutes ?: 0) > 0) {
      root.addView(button("Répéter dans ${alarm!!.snoozeMinutes} min", filled = false) {
        startService(Intent(this, AlarmService::class.java).setAction(AlarmService.ACTION_SNOOZE))
        finish()
      }, margins(top = 14))
    }
    root.addView(button("Arrêter", filled = false) {
      startService(AlarmService.stopIntent(this))
      finish()
    }, margins(top = 14))

    setContentView(root)
  }

  override fun onResume() {
    super.onResume()
    handler.post(tick)
  }

  override fun onPause() {
    handler.removeCallbacks(tick)
    super.onPause()
  }

  override fun onDestroy() {
    if (AlarmService.activityRef?.get() === this) AlarmService.activityRef = null
    super.onDestroy()
  }

  private fun showOverLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
      km.requestDismissKeyguard(this, null)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD,
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  private fun dp(v: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

  private fun margins(top: Int) = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
    topMargin = dp(top)
  }

  private fun text(s: String, sizeSp: Float, color: Int, bold: Boolean = false, spacing: Float = 0f) = TextView(this).apply {
    text = s
    setTextColor(color)
    textSize = sizeSp
    gravity = Gravity.CENTER
    letterSpacing = spacing
    if (bold) typeface = Typeface.DEFAULT_BOLD
  }

  private fun button(label: String, filled: Boolean, onClick: () -> Unit) = Button(this).apply {
    text = label
    isAllCaps = false
    textSize = 18f
    minHeight = dp(58)
    setTextColor(if (filled) night else Color.WHITE)
    background = GradientDrawable().apply {
      cornerRadius = dp(29).toFloat()
      if (filled) setColor(gold) else {
        setColor(deep)
        setStroke(dp(1), gold)
      }
    }
    setOnClickListener { onClick() }
  }
}
