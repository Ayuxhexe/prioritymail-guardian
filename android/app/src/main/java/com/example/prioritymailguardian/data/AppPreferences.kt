package com.example.prioritymailguardian.data

import android.content.Context

class AppPreferences(context: Context) {
  private val preferences = context.getSharedPreferences("guardian", Context.MODE_PRIVATE)

  var serverUrl: String
    get() = preferences.getString("server_url", "http://10.0.2.2:5000") ?: "http://10.0.2.2:5000"
    set(value) = preferences.edit().putString("server_url", value.trimEnd('/')).apply()

  var sessionToken: String?
    get() = preferences.getString("session_token", null)
    set(value) { preferences.edit().putString("session_token", value).commit() }

  var fcmToken: String?
    get() = preferences.getString("fcm_token", null)
    set(value) = preferences.edit().putString("fcm_token", value).apply()

  val isConnected: Boolean get() = !sessionToken.isNullOrBlank()
}
