package com.example.prioritymailguardian.alarm

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.prioritymailguardian.theme.PriorityMailGuardianTheme

class AlarmActivity : ComponentActivity() {
  private lateinit var alarmController: AlarmController

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION") window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    alarmController = AlarmController(this)
    runCatching { alarmController.start() }

    val sender = intent.getStringExtra(EXTRA_SENDER).orEmpty().ifBlank { "Priority sender" }
    val subject = intent.getStringExtra(EXTRA_SUBJECT).orEmpty().ifBlank { "Priority email received" }
    val snippet = intent.getStringExtra(EXTRA_SNIPPET).orEmpty()

    setContent {
      PriorityMailGuardianTheme(darkTheme = true, dynamicColor = false) {
        AlarmScreen(sender, subject, snippet, ::dismissAlarm, ::openGmail)
      }
    }
  }

  private fun dismissAlarm() {
    alarmController.stop()
    finishAndRemoveTask()
  }

  private fun openGmail() {
    alarmController.stop()
    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://mail.google.com/")))
    finishAndRemoveTask()
  }

  override fun onDestroy() {
    if (::alarmController.isInitialized) alarmController.stop()
    super.onDestroy()
  }

  companion object {
    const val EXTRA_SENDER = "sender"
    const val EXTRA_SUBJECT = "subject"
    const val EXTRA_SNIPPET = "snippet"
    const val EXTRA_ALERT_ID = "alertId"
  }
}

@Composable
private fun AlarmScreen(
  sender: String,
  subject: String,
  snippet: String,
  onDismiss: () -> Unit,
  onOpenGmail: () -> Unit
) {
  val transition = rememberInfiniteTransition(label = "alarmPulse")
  val pulse by transition.animateFloat(
    initialValue = 0.45f,
    targetValue = 1f,
    animationSpec = infiniteRepeatable(tween(550), RepeatMode.Reverse),
    label = "alarmAlpha"
  )

  Box(
    modifier = Modifier.fillMaxSize().background(Color(0xFF160609)).padding(24.dp),
    contentAlignment = Alignment.Center
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().background(Color(0xFF250A0F), RoundedCornerShape(28.dp)).padding(24.dp),
      horizontalAlignment = Alignment.CenterHorizontally
    ) {
      Text("ALERT", color = Color(0xFFFF4D5E), fontSize = 54.sp, fontWeight = FontWeight.Black, modifier = Modifier.alpha(pulse))
      Text("PRIORITY EMAIL", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
      Spacer(Modifier.height(28.dp))
      Text("FROM", color = Color(0xFFFF7A87), fontSize = 12.sp, fontWeight = FontWeight.Bold)
      Text(sender, color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
      Spacer(Modifier.height(18.dp))
      Text(subject, color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center)
      if (snippet.isNotBlank()) {
        Spacer(Modifier.height(12.dp))
        Text(snippet, color = Color(0xFFC9B8BC), fontSize = 14.sp, textAlign = TextAlign.Center, maxLines = 3)
      }
      Spacer(Modifier.height(32.dp))
      Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(onClick = onDismiss, modifier = Modifier.weight(1f).height(54.dp)) {
          Text("Dismiss")
        }
        Button(
          onClick = onOpenGmail,
          modifier = Modifier.weight(1f).height(54.dp),
          colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD92D3D))
        ) {
          Text("Open Gmail", fontWeight = FontWeight.Bold)
        }
      }
    }
  }
}
