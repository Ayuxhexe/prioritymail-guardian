package com.example.prioritymailguardian

import android.Manifest
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.prioritymailguardian.alarm.AlarmActivity
import com.example.prioritymailguardian.data.AppPreferences
import com.example.prioritymailguardian.data.TokenUploader
import com.example.prioritymailguardian.theme.PriorityMailGuardianTheme
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import kotlin.concurrent.thread

class MainActivity : ComponentActivity() {
  private lateinit var preferences: AppPreferences

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    preferences = AppPreferences(this)
    requestNotificationPermission()
    fetchAndUploadToken()

    setContent {
      var enabled by remember { mutableStateOf(preferences.monitoringEnabled) }
      val ringtonePicker = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        result.data?.getParcelableExtra<android.net.Uri>(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)?.let {
          preferences.ringtoneUri = it.toString()
        }
      }

      PriorityMailGuardianTheme(darkTheme = true, dynamicColor = false) {
        Column(
          modifier = Modifier.fillMaxSize().padding(24.dp),
          verticalArrangement = Arrangement.Center,
          horizontalAlignment = Alignment.CenterHorizontally
        ) {
          Text("PriorityMail Guardian", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
          Spacer(Modifier.height(12.dp))
          Text("Alarms for priority email are ${if (enabled) "ON" else "OFF"} on this phone.")
          Spacer(Modifier.height(24.dp))
          Switch(
            checked = enabled,
            onCheckedChange = { enabled = it; preferences.monitoringEnabled = it }
          )
          Text(if (enabled) "Monitoring ON" else "Monitoring OFF")
          Spacer(Modifier.height(32.dp))
          Button(
            onClick = {
              ringtonePicker.launch(Intent(RingtoneManager.ACTION_RINGTONE_PICKER).apply {
                putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALARM)
                putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Choose alarm ringtone")
                putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, preferences.ringtoneUri?.let(android.net.Uri::parse))
              })
            },
            modifier = Modifier.fillMaxWidth()
          ) { Text("Change ringtone") }
          Spacer(Modifier.height(12.dp))
          Button(
            onClick = { startActivity(AlarmActivity.intent(this@MainActivity, "Test alarm", "This is a local test alarm.")) },
            modifier = Modifier.fillMaxWidth()
          ) { Text("Test Alarm") }
        }
      }
    }
  }

  private fun requestNotificationPermission() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerForActivityResult(ActivityResultContracts.RequestPermission()) {}.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
  }

  private fun fetchAndUploadToken() {
    if (FirebaseApp.initializeApp(this) == null) return
    FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
      preferences.fcmToken = token
      thread { TokenUploader.upload(token) }
    }
  }
}
