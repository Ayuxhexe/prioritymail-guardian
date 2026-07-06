package com.example.prioritymailguardian

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import com.example.prioritymailguardian.alarm.AlarmActivity
import com.example.prioritymailguardian.data.AppPreferences
import com.example.prioritymailguardian.data.DeviceRegistrar
import com.example.prioritymailguardian.theme.PriorityMailGuardianTheme
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
  private lateinit var preferences: AppPreferences
  private var connected by mutableStateOf(false)
  private var statusMessage by mutableStateOf("Waiting for setup")

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    preferences = AppPreferences(this)
    connected = preferences.isConnected
    handleAuthIntent(intent)
    initializePush()

    enableEdgeToEdge()
    setContent {
      PriorityMailGuardianTheme(darkTheme = true, dynamicColor = false) {
        Surface(Modifier.fillMaxSize(), color = Color(0xFF071018)) {
          GuardianHome(
            initialServerUrl = preferences.serverUrl,
            connected = connected,
            statusMessage = statusMessage,
            onSaveServer = { preferences.serverUrl = it },
            onSignIn = { serverUrl ->
              preferences.serverUrl = serverUrl
              startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("${preferences.serverUrl}/api/auth/google?client=android")))
            },
            onRegister = ::registerDevice,
            onDisconnect = {
              preferences.sessionToken = null
              connected = false
              statusMessage = "Disconnected"
            },
            onTestAlarm = ::launchTestAlarm
          )
        }
      }
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleAuthIntent(intent)
  }

  private fun handleAuthIntent(intent: Intent?) {
    val token = intent?.data?.takeIf { it.scheme == "prioritymailguardian" }?.getQueryParameter("token")
    if (!token.isNullOrBlank()) {
      preferences.sessionToken = token
      connected = true
      statusMessage = "Signed in. Registering push notifications..."
      registerDevice()
    }
  }

  private fun initializePush() {
    try {
      if (FirebaseApp.initializeApp(this) == null) {
        statusMessage = "Add google-services.json to enable Firebase push"
        return
      }
      FirebaseMessaging.getInstance().token
        .addOnSuccessListener { token ->
          preferences.fcmToken = token
          if (preferences.isConnected) registerDevice()
          else statusMessage = "Push ready. Sign in to connect this device."
        }
        .addOnFailureListener { statusMessage = "Firebase token error: ${it.message}" }
    } catch (_: IllegalStateException) {
      statusMessage = "Add google-services.json to enable Firebase push"
    }
  }

  private fun registerDevice() {
    lifecycleScope.launch {
      statusMessage = "Registering device..."
      DeviceRegistrar.register(preferences)
        .onSuccess { statusMessage = "Connected — priority alarms are armed" }
        .onFailure { statusMessage = it.message ?: "Device registration failed" }
    }
  }

  private fun launchTestAlarm() {
    startActivity(Intent(this, AlarmActivity::class.java).apply {
      putExtra(AlarmActivity.EXTRA_SENDER, "hr@example.com")
      putExtra(AlarmActivity.EXTRA_SUBJECT, "Interview Schedule — Next Steps")
      putExtra(AlarmActivity.EXTRA_SNIPPET, "This is a local alarm test. Sound, vibration, screen wake, and flashlight should now be active.")
    })
  }
}

@Composable
private fun GuardianHome(
  initialServerUrl: String,
  connected: Boolean,
  statusMessage: String,
  onSaveServer: (String) -> Unit,
  onSignIn: (String) -> Unit,
  onRegister: () -> Unit,
  onDisconnect: () -> Unit,
  onTestAlarm: () -> Unit
) {
  var serverUrl by remember { mutableStateOf(initialServerUrl) }
  val permissionLauncher = rememberLauncherForActivityResult(
    ActivityResultContracts.RequestMultiplePermissions()
  ) { }

  Column(
    modifier = Modifier.fillMaxSize().background(Color(0xFF071018)).padding(horizontal = 22.dp, vertical = 42.dp),
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Text("PRIORITYMAIL", color = Color(0xFF72E4FF), fontSize = 13.sp, fontWeight = FontWeight.Bold, letterSpacing = 3.sp)
    Text("Guardian", color = Color.White, fontSize = 38.sp, fontWeight = FontWeight.Black)
    Text("Never miss the email that matters.", color = Color(0xFF91A4B3), fontSize = 14.sp)
    Spacer(Modifier.height(28.dp))

    Card(
      colors = CardDefaults.cardColors(containerColor = Color(0xFF0E1B25)),
      shape = RoundedCornerShape(24.dp),
      modifier = Modifier.fillMaxWidth()
    ) {
      Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
          Text(if (connected) "●" else "○", color = if (connected) Color(0xFF48E0A4) else Color(0xFFFFC857), fontSize = 20.sp)
          Column {
            Text(if (connected) "GUARDIAN CONNECTED" else "SETUP REQUIRED", color = Color.White, fontWeight = FontWeight.Bold)
            Text(statusMessage, color = Color(0xFF91A4B3), fontSize = 12.sp)
          }
        }

        OutlinedTextField(
          value = serverUrl,
          onValueChange = { serverUrl = it },
          label = { Text("Server URL") },
          supportingText = { Text("Emulator default: http://10.0.2.2:5000") },
          singleLine = true,
          modifier = Modifier.fillMaxWidth()
        )

        Button(
          onClick = {
            onSaveServer(serverUrl)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
              permissionLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS, Manifest.permission.CAMERA))
            } else {
              permissionLauncher.launch(arrayOf(Manifest.permission.CAMERA))
            }
            if (connected) onRegister() else onSignIn(serverUrl.trimEnd('/'))
          },
          modifier = Modifier.fillMaxWidth().height(52.dp),
          colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF087EA4))
        ) {
          Text(if (connected) "Re-register Device" else "Sign in with Google", fontWeight = FontWeight.Bold)
        }
        if (connected) {
          OutlinedButton(onClick = onDisconnect, modifier = Modifier.fillMaxWidth()) { Text("Disconnect") }
        }
      }
    }

    Spacer(Modifier.height(22.dp))
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF101820)), modifier = Modifier.fillMaxWidth()) {
      Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("ALARM HARDWARE TEST", color = Color(0xFFFF6778), fontWeight = FontWeight.ExtraBold)
        Text(
          "Temporarily raises alarm volume, vibrates, wakes the screen, and flashes the torch.",
          color = Color(0xFF9EACB7),
          fontSize = 13.sp,
          textAlign = TextAlign.Center,
          modifier = Modifier.padding(vertical = 10.dp)
        )
        Button(
          onClick = onTestAlarm,
          colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD92D3D)),
          modifier = Modifier.fillMaxWidth().height(52.dp)
        ) { Text("TEST FULL ALARM", fontWeight = FontWeight.Black) }
      }
    }
  }
}
