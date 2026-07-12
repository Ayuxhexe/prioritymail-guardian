package com.example.prioritymailguardian.alarm

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.prioritymailguardian.theme.PriorityMailGuardianTheme

class AlarmActivity : ComponentActivity() {
  private lateinit var alarm: AlarmController

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true); setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION") window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    alarm = AlarmController(this)
    runCatching { alarm.start() }
    val sender = intent.getStringExtra(EXTRA_SENDER).orEmpty().ifBlank { "Priority sender" }
    val subject = intent.getStringExtra(EXTRA_SUBJECT).orEmpty().ifBlank { "Priority email received" }
    setContent { PriorityMailGuardianTheme(darkTheme = true, dynamicColor = false) { AlarmScreen(sender, subject, ::dismiss) } }
  }

  private fun dismiss() { alarm.stop(); finishAndRemoveTask() }
  override fun onDestroy() { if (::alarm.isInitialized) alarm.stop(); super.onDestroy() }

  companion object {
    const val EXTRA_SENDER = "sender"
    const val EXTRA_SUBJECT = "subject"
    fun intent(context: Context, sender: String, subject: String) = Intent(context, AlarmActivity::class.java).apply {
      putExtra(EXTRA_SENDER, sender); putExtra(EXTRA_SUBJECT, subject)
    }
  }
}

@androidx.compose.runtime.Composable
private fun AlarmScreen(sender: String, subject: String, dismiss: () -> Unit) {
  Column(
    Modifier.fillMaxSize().background(Color(0xFF18070A)).padding(28.dp),
    verticalArrangement = Arrangement.Center,
    horizontalAlignment = Alignment.CenterHorizontally
  ) {
    Text("PRIORITY EMAIL", color = Color(0xFFFF5B6E), fontSize = 30.sp, fontWeight = FontWeight.Black)
    Spacer(Modifier.height(36.dp))
    Text(sender, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
    Spacer(Modifier.height(16.dp))
    Text(subject, color = Color.White, fontSize = 25.sp, textAlign = TextAlign.Center)
    Spacer(Modifier.height(44.dp))
    Button(onClick = dismiss, modifier = Modifier.fillMaxWidth().height(56.dp)) { Text("Dismiss") }
  }
}
