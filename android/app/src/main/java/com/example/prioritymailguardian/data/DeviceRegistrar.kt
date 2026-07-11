package com.example.prioritymailguardian.data

import android.os.Build
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object DeviceRegistrar {
  suspend fun register(preferences: AppPreferences): Result<Unit> = withContext(Dispatchers.IO) {
    runCatching {
      Log.d("DeviceRegistrar", "Starting registration at ${preferences.serverUrl}/api/devices/register")
      val sessionToken = requireNotNull(preferences.sessionToken) { "Sign in before registering this device." }
      val fcmToken = requireNotNull(preferences.fcmToken) { "Firebase has not issued a device token yet." }
      val connection = URL("${preferences.serverUrl}/api/devices/register").openConnection() as HttpURLConnection

      try {
        connection.requestMethod = "POST"
        connection.connectTimeout = 10_000
        connection.readTimeout = 10_000
        connection.doOutput = true
        connection.setRequestProperty("Authorization", "Bearer $sessionToken")
        connection.setRequestProperty("Content-Type", "application/json")

        val payload = JSONObject()
          .put("token", fcmToken)
          .put("deviceName", "${Build.MANUFACTURER} ${Build.MODEL}")
          .toString()
        connection.outputStream.bufferedWriter().use { it.write(payload) }

        if (connection.responseCode !in 200..299) {
          val message = connection.errorStream?.bufferedReader()?.use { it.readText() }
          error(message ?: "Device registration failed (${connection.responseCode}).")
        }
      } finally {
        connection.disconnect()
      }
    }
  }
}
