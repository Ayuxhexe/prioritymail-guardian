# PriorityMail Guardian

> "Never miss a priority email again."

PriorityMail Guardian is a reliable full-stack and mobile notification system designed to monitor your Gmail inbox and trigger a high-volume physical alarm on your Android device when critical/priority emails are received.

## Repository Structure

```
prioritymail-guardian/
├── dashboard/          # React + Vite frontend control panel
├── server/             # Node.js + Express backend & rule engine
├── android/            # Kotlin-based Android alarm application
├── docs/               # Documentation
└── README.md
```

## Tech Stack
- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express, MongoDB, Firebase Admin SDK (FCM)
- **Mobile**: Kotlin, Firebase Cloud Messaging (FCM)
- **External Integration**: Gmail API (OAuth 2.0)

## Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB (Running locally or via Atlas)
- Firebase Project (for Cloud Messaging credentials)
- Google Cloud Console Project (with Gmail API enabled)
- Android SDK (for building the Android alarm client)

## Local Development
npm install
npm run dev
