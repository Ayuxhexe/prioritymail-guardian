package com.example.prioritymailguardian.data

import android.content.Context

class AppPreferences(context: Context) {
  private val preferences = context.getSharedPreferences("guardian", Context.MODE_PRIVATE)

  var fcmToken: String?
    get() = preferences.getString("fcm_token", null)
    set(value) = preferences.edit().putString("fcm_token", value).apply()

  var monitoringEnabled: Boolean
    get() = preferences.getBoolean("monitoring_enabled", true)
    set(value) = preferences.edit().putBoolean("monitoring_enabled", value).apply()

  var ringtoneUri: String?
    get() = preferences.getString("ringtone_uri", null)
    set(value) = preferences.edit().putString("ringtone_uri", value).apply()
}
