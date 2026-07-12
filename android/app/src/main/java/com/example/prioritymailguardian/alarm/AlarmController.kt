package com.example.prioritymailguardian.alarm

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.example.prioritymailguardian.data.AppPreferences

class AlarmController(private val context: Context) {
  private var player: MediaPlayer? = null

  fun start() {
    val uri = AppPreferences(context).ringtoneUri?.let(Uri::parse)
      ?: android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_ALARM)
    player = MediaPlayer().apply {
      setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build())
      setDataSource(context, uri)
      isLooping = true
      prepare()
      start()
    }
    vibrator().vibrate(VibrationEffect.createWaveform(longArrayOf(0, 700, 200), 0))
  }

  fun stop() {
    player?.runCatching { stop() }
    player?.release()
    player = null
    vibrator().cancel()
  }

  private fun vibrator(): Vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
    (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
  } else {
    @Suppress("DEPRECATION") context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
  }
}
