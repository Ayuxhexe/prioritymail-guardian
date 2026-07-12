# PriorityMail Guardian Android client

This is a small, single-phone FCM alarm receiver. It has no Gmail integration,
accounts, login, or polling.

An FCM data message with `type: "priority_alarm"` opens the full-screen alarm
when Monitoring is ON. The alert loops the selected ringtone and vibration until
Dismiss is pressed.

The app is configured to POST `{ "token": "..." }` to
`https://prioritymail-guardian.onrender.com/api/fcm-token` at launch and whenever
Firebase rotates the token. Add the Firebase `google-services.json` file to the
`app/` directory to enable FCM.
