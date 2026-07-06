package com.example.prioritymailguardian.notifications

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.example.prioritymailguardian.alarm.AlarmActivity
import com.example.prioritymailguardian.data.AppPreferences
import com.example.prioritymailguardian.data.DeviceRegistrar
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class GuardianMessagingService : FirebaseMessagingService() {
  private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  override fun onNewToken(token: String) {
    val preferences = AppPreferences(this)
    preferences.fcmToken = token
    if (preferences.isConnected) {
      serviceScope.launch { DeviceRegistrar.register(preferences) }
    }
  }

  override fun onMessageReceived(message: RemoteMessage) {
    val data = message.data
    showAlarmNotification(
      sender = data["sender"].orEmpty().ifBlank { "Priority sender" },
      subject = data["subject"].orEmpty().ifBlank { data["body"] ?: "Priority email received" },
      snippet = data["snippet"].orEmpty(),
      alertId = data["alertId"].orEmpty()
    )
  }

  private fun showAlarmNotification(sender: String, subject: String, snippet: String, alertId: String) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channelId = "priority_alerts_channel"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(channelId, "Priority email alarms", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Full-screen alarms for emails matching priority rules"
          setSound(null, null)
          enableVibration(false)
          lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
      )
    }

    val alarmIntent = Intent(this, AlarmActivity::class.java).apply {
      putExtra(AlarmActivity.EXTRA_SENDER, sender)
      putExtra(AlarmActivity.EXTRA_SUBJECT, subject)
      putExtra(AlarmActivity.EXTRA_SNIPPET, snippet)
      putExtra(AlarmActivity.EXTRA_ALERT_ID, alertId)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
      this,
      alertId.hashCode(),
      alarmIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, channelId)
    } else {
      @Suppress("DEPRECATION") Notification.Builder(this)
    }
      .setSmallIcon(android.R.drawable.ic_dialog_alert)
      .setContentTitle("Priority email: $sender")
      .setContentText(subject)
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setPriority(Notification.PRIORITY_MAX)
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)
      .setFullScreenIntent(pendingIntent, true)
      .build()

    manager.notify(alertId.hashCode(), notification)
  }
}
