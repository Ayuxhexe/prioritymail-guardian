package com.example.prioritymailguardian.alarm

import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

class AlarmController(private val context: Context) {
  private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
  private val handler = Handler(Looper.getMainLooper())
  private var player: MediaPlayer? = null
  private var originalAlarmVolume: Int? = null
  private var torchCameraId: String? = null
  private var torchOn = false

  private val flashRunnable = object : Runnable {
    override fun run() {
      torchCameraId?.let { cameraId ->
        runCatching {
          torchOn = !torchOn
          cameraManager.setTorchMode(cameraId, torchOn)
        }
      }
      handler.postDelayed(this, 450)
    }
  }

  fun start() {
    originalAlarmVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM)
    audioManager.setStreamVolume(
      AudioManager.STREAM_ALARM,
      audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM),
      0
    )

    val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
    player = MediaPlayer().apply {
      setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
      setDataSource(context, alarmUri)
      isLooping = true
      prepare()
      start()
    }

    val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
    } else {
      @Suppress("DEPRECATION") context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    val pattern = longArrayOf(0, 700, 250, 700, 250, 1200)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0))
    } else {
      @Suppress("DEPRECATION") vibrator.vibrate(pattern, 0)
    }

    torchCameraId = runCatching {
      cameraManager.cameraIdList.firstOrNull { id ->
        cameraManager.getCameraCharacteristics(id)
          .get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
      }
    }.getOrNull()
    if (torchCameraId != null) handler.post(flashRunnable)
  }

  fun stop() {
    player?.runCatching { stop() }
    player?.release()
    player = null
    val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
    } else {
      @Suppress("DEPRECATION") context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    vibrator.cancel()
    handler.removeCallbacks(flashRunnable)
    torchCameraId?.let { runCatching { cameraManager.setTorchMode(it, false) } }
    originalAlarmVolume?.let { audioManager.setStreamVolume(AudioManager.STREAM_ALARM, it, 0) }
    originalAlarmVolume = null
  }
}
