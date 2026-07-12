package com.example.prioritymailguardian.notifications

import android.content.Intent
import com.example.prioritymailguardian.alarm.AlarmActivity
import com.example.prioritymailguardian.data.AppPreferences
import com.example.prioritymailguardian.data.TokenUploader
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlin.concurrent.thread

class GuardianMessagingService : FirebaseMessagingService() {
  override fun onNewToken(token: String) {
    AppPreferences(this).fcmToken = token
    thread { TokenUploader.upload(token) }
  }

  override fun onMessageReceived(message: RemoteMessage) {
    val data = message.data
    if (data["type"] != "priority_alarm" || !AppPreferences(this).monitoringEnabled) return

    startActivity(
      AlarmActivity.intent(
        this,
        data["sender"].orEmpty().ifBlank { "Priority sender" },
        data["subject"].orEmpty().ifBlank { "Priority email received" }
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    )
  }
}
