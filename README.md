# Live Behavior Data Tracker

A static React + Vite app for in-the-moment behavior data collection, hosted on GitHub Pages with Firebase Firestore as the shared database.

> **Status: scaffold / testing only.** Sign-in is a demo (name + role picker) and the Firestore rules are open. Use dummy data only. See "Before real data" below.

## What it does

- **Admin**: creates subject IDs (e.g. `CSH05`), adds target behaviors from the validated list, and picks the metrics for each behavior:
  - Frequency, duration, intensity (scale 1-N, default 1-3)
  - Partial interval, whole interval, momentary time sampling (interval length set per behavior)
  - Frequency of attempts and frequency of successes
- **User**: picks a subject and sees one card per target behavior with the matching controls:
  - Duration: Start / Stop button with a running timer (one episode = one count + one duration)
  - Frequency only: one-tap episode counter
  - Intensity: rating buttons (asked at Stop when combined with frequency/duration)
  - Interval metrics: a countdown and a Yes/No prompt at the end of every interval
  - Attempts / successes: tap counters with a live success rate
- **Everyone** can review data: filter by subject, behavior, date, observer; summary stats; per-session charts; CSV export. Admins can also delete entries/sessions and edit session notes.
- Works offline: Firestore offline persistence queues entries and syncs on reconnect.

## Run locally

```powershell
npm install
Copy-Item .env.example .env.local   # then fill in your Firebase values
npm run dev
```

## Firebase setup

1. In the [Firebase console](https://console.firebase.google.com/) create a **new project**.
2. Add a **web app** and copy its config values into `.env.local` (keys are in `.env.example`).
3. Create a **Cloud Firestore** database (Native mode).
4. Publish the rules in `firestore.rules` (Firestore > Rules, or `firebase deploy --only firestore:rules`).

No documents need to be created manually; the Admin screen creates subjects.

## Deploy to GitHub Pages

1. Create the GitHub repo `live-behavior-data-tracker` and push this project to `main`. (If you use a different repo name, change `base` in `vite.config.js`.)
2. Repo **Settings > Pages**: set Source to **GitHub Actions**.
3. Repo **Settings > Secrets and variables > Actions > Variables**: add the six `VITE_FIREBASE_*` values.
4. Every push to `main` runs `.github/workflows/deploy.yml` and publishes the site at `https://<user>.github.io/live-behavior-data-tracker/`.

## Data model

| Path | Contents |
| --- | --- |
| `subjects/{code}` | `isActive`, `targets: [{ behavior, metrics: [{ type, intervalSeconds?, scaleMax? }] }]` |
| `sessions/{id}` | `subjectCode`, `observerName`, `startedAt`, `endedAt`, `notes`, `targets` (snapshot of the setup) |
| `sessions/{id}/events/{id}` | `behavior`, `kind` (`episode`, `count`, `intensity`, `interval`, `attempt`, `success`), timestamps, and kind-specific fields |

Subjects are identified by code only; do not store names or other identifiers.

## Before real data

1. Replace `src/auth/AuthContext.jsx` with Firebase Auth using Microsoft SSO restricted to `*@tcfd.org`, and take the role (`admin` / `user`) from an Admin-managed roster instead of the picker.
2. Replace the open rules in `firestore.rules` with role-based rules (see the TODO in that file).
3. Complete a privacy/compliance review before storing any real client data.
