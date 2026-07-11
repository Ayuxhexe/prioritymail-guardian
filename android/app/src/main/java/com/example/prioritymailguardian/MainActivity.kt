package com.example.prioritymailguardian

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabsIntent
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
import androidx.compose.runtime.LaunchedEffect
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
    Log.d("AuthFlow", "onCreate: intent=$intent")
    Log.d("AuthFlow", "onCreate data: ${intent?.data}")
    preferences = AppPreferences(this)
    connected = preferences.isConnected
    handleAuthIntent(intent)
    initializePush()

    enableEdgeToEdge()
    setContent {
      // Sync state if preferences change out-of-band
      LaunchedEffect(Unit) {
        connected = preferences.isConnected
      }

      PriorityMailGuardianTheme(darkTheme = true, dynamicColor = false) {
        Surface(Modifier.fillMaxSize(), color = Color(0xFF071018)) {
          GuardianHome(
            initialServerUrl = preferences.serverUrl,
            connected = connected,
            statusMessage = statusMessage,
            onSaveServer = { preferences.serverUrl = it },
            onSignIn = { inputUrl ->
              // Clean and validate URL
              var cleanedUrl = inputUrl.trim().trimEnd('/')
              if (cleanedUrl.isNotEmpty() && !cleanedUrl.startsWith("http")) {
                if (cleanedUrl.contains("localhost") || cleanedUrl.contains("10.0.2.2") || cleanedUrl.matches(Regex("^(192\\.168|10\\.|172\\.(1[6-9]|2[0-9]|3[0-1]))\\..*"))) {
                  cleanedUrl = "http://$cleanedUrl"
                } else {
                  cleanedUrl = "https://$cleanedUrl"
                }
              }
              preferences.serverUrl = cleanedUrl
              
              val loginUrl = "$cleanedUrl/api/auth/google?client=android"
              Log.d("AuthFlow", "Launching Browser: $loginUrl")
              try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(loginUrl)).apply {
                  putExtra(android.provider.Browser.EXTRA_APPLICATION_ID, packageName)
                  addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(intent)
              } catch (e: Exception) {
                Log.e("AuthFlow", "Browser launch failed", e)
              }
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
    Log.d("AuthFlow", "onNewIntent: $intent")
    Log.d("AuthFlow", "onNewIntent data: ${intent.data}")
    setIntent(intent)
    handleAuthIntent(intent)
  }

  override fun onResume() {
    super.onResume()
    Log.d("AuthFlow", "onResume: Checking for data in intent...")
    handleAuthIntent(intent)
  }

  private fun handleAuthIntent(intent: Intent?) {
    val uri = intent?.data
    Log.d("AuthFlow", "handleAuthIntent check: uri=$uri")
    if (uri == null) return

    val token = uri.getQueryParameter("token") ?: 
                uri.fragment?.let { if (it.contains("token=")) it.substringAfter("token=").substringBefore("&") else null }

    Log.d("AuthFlow", "handleAuthIntent token: ${token?.take(10)}...")

    if (!token.isNullOrBlank()) {
      Log.d("AuthFlow", "SUCCESS: Token found. Saving.")
      preferences.sessionToken = token
      connected = true
      statusMessage = "Authenticated! Registering device..."
      registerDevice()
      // DO NOT clear intent data yet, let's see if that helps
      // intent.data = null
    } else {
      Log.w("AuthFlow", "handleAuthIntent: No token in URI $uri")
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
    val sToken = preferences.sessionToken
    val fToken = preferences.fcmToken
    Log.d("AuthFlow", "registerDevice: sessionToken=${sToken?.take(10)}..., fcmToken=${fToken?.take(10)}...")
    
    if (sToken.isNullOrBlank() || fToken.isNullOrBlank()) {
      Log.w("AuthFlow", "registerDevice: Missing tokens! session=${sToken != null}, fcm=${fToken != null}")
      if (fToken == null) {
        statusMessage = "Waiting for Firebase token..."
      }
      return
    }

    lifecycleScope.launch {
      statusMessage = "Registering device..."
      DeviceRegistrar.register(preferences)
        .onSuccess { 
          Log.d("AuthFlow", "registerDevice: SUCCESS")
          statusMessage = "Connected — priority alarms are armed" 
        }
        .onFailure { 
          Log.e("AuthFlow", "registerDevice: FAILURE: ${it.message}")
          statusMessage = it.message ?: "Device registration failed" 
        }
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
            // Add a manual refresh check before deciding action
            onRegister() // This will refresh UI state from preferences
            if (!connected) onSignIn(serverUrl.trimEnd('/'))
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
