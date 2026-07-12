package com.example.prioritymailguardian.data

import com.example.prioritymailguardian.BuildConfig
import java.net.HttpURLConnection
import java.net.URL

/** Sends the current FCM token to the single-user backend. */
object TokenUploader {
  fun upload(token: String) {
    if (BuildConfig.BACKEND_URL.contains("your-backend.example")) return

    runCatching {
      val connection = URL("${BuildConfig.BACKEND_URL.trimEnd('/')}/api/fcm-token")
        .openConnection() as HttpURLConnection
      try {
        connection.requestMethod = "POST"
        connection.connectTimeout = 10_000
        connection.readTimeout = 10_000
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.outputStream.bufferedWriter().use {
          it.write("{\"token\":\"${token.replace("\\", "\\\\").replace("\"", "\\\"")}\"}")
        }
        if (connection.responseCode !in 200..299) error("Token upload failed: ${connection.responseCode}")
      } finally {
        connection.disconnect()
      }
    }
  }
}
