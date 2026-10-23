# MiniLedger — App (React Native)

The mobile half of MiniLedger. Built with **Expo (React Native)**, which is why
your existing React knowledge transfers almost unchanged — see
[React → React Native](#react--react-native-what-actually-changes) below.

---

## Tech stack, and why

| Concern | Choice | Reasoning |
|---|---|---|
| Framework | **Expo SDK 58** (React Native 0.88) | Expo *is* React Native, with the native build step taken off your plate. `npx expo start` and a QR code is the whole dev loop — no Xcode or Android Studio |
| Routing | **Expo Router** | File-based, so it feels like Next.js. Routes are `src/app/*.tsx` |
| Data | plain `fetch` in a small `api.ts` | There are five endpoints. A caching library would add a concept to explain and buy nothing |
| Validation | **zod** | Same rules as the server, so the user gets errors instantly while the API stays the authority |
| Session | **expo-secure-store** | Android Keystore / iOS Keychain. `AsyncStorage` is unencrypted JSON a rooted device can read |
| Photos | **expo-image-picker** | Receipt upload (the optional bonus) |

Deliberately **no** UI kit and **no** state-management library — every style is
hand-written in a `StyleSheet`, which means there is nothing in this app you
cannot be asked to explain line by line.

### What was rejected, and why

- **`react-hook-form` + `@hookform/resolvers`** — the resolver's optional
  `effect@4` peer conflicts with the template's `effect@3`. Rather than force a
  broken peer tree, validation is driven straight from zod: fewer dependencies,
  same result.
- **`@react-native-community/datetimepicker`** — works, but ships **no web
  build**, so it would break `expo start --web`. Replaced with quick-pick chips
  ("1 week / 2 weeks / 1 month / 3 months") plus a manual field: one code path
  across iOS, Android and web, and faster than opening a calendar anyway.

---

## Running it

### 1. Start the API first

The app does nothing without it. See [`../backend/README.md`](../backend/README.md).

```bash
cd backend
npm run dev
```

Note the URL it prints for your phone.

### 2. Point the app at the API

```bash
cd app
cp .env.example .env
```

Edit `EXPO_PUBLIC_API_URL`:

| Where you're running | Value |
|---|---|
| Android emulator | `http://10.0.2.2:4000` |
| iOS simulator | `http://localhost:4000` |
| **Physical phone** | `http://<your-LAN-IP>:4000` — same Wi-Fi as your computer |

> ⚠️ **This is the number one thing that goes wrong.** `localhost` on a physical
> phone means *the phone*, not your laptop, so every request silently fails.
> Use the LAN IP the backend prints on startup, and re-check it if you change
> Wi-Fi networks. If a request fails, the app shows the URL it tried.

### 3. Start Expo

```bash
npx expo start
```

Then:

- **Physical phone** — install **Expo Go** from the App Store / Play Store and
  scan the QR code. Phone and computer must be on the same Wi-Fi.
- **Android emulator** — press `a`.
- **iOS simulator** — press `i` (macOS only).
- **Browser (easiest for screen recording)** — press `w`.

All three native modules used here (`expo-image-picker`, `expo-secure-store`)
are **included in Expo Go**, so no custom development build is needed.

### 4. Sign in

Enter any 10-digit phone number. The 6-digit code is **printed in the API
terminal**, not sent by SMS — this is the mock OTP the brief asks for. Paste it
in and you're in.

---

## Project layout

```
app/
├── .env                      # EXPO_PUBLIC_API_URL (gitignored)
├── app.json                  # app identity, plugins, permissions
└── src/
    ├── app/                  # each file is a screen (Expo Router)
    │   ├── _layout.tsx       # navigators + AuthProvider
    │   ├── index.tsx         # routing gate: signed in? home : login
    │   ├── login.tsx         # phone -> OTP
    │   ├── home.tsx          # summary card + list + mark repaid
    │   └── add.tsx           # new entry form (+ optional receipt photo)
    ├── components/
    │   ├── SummaryCard.tsx   # lent / repaid / overdue
    │   ├── LoanItem.tsx      # one row, highlighted when overdue
    │   ├── Field.tsx         # label + input + inline error
    │   └── PrimaryButton.tsx
    ├── lib/
    │   ├── api.ts            # fetch wrapper + the five endpoints
    │   ├── auth.tsx          # AuthProvider, SecureStore session
    │   ├── config.ts         # EXPO_PUBLIC_API_URL
    │   ├── format.ts         # currency, dates, Indian digit grouping
    │   └── types.ts          # Loan, LoanSummary
    └── constants/theme.ts    # the one colour palette
```

---

## Design decisions worth defending

**The routing gate is one screen.** `src/app/index.tsx` reads a single
`status` value and either holds a loading view or `<Redirect>`s. Every screen
the user can reach depends on that one decision, so there is no window where an
unauthenticated user can see the home screen.

**`router.replace`, not `push`, after login.** Otherwise Back from home returns
to the login screen for a session that already exists.

**The session lives in SecureStore, not memory.** With a memory-only store the
app would log you out on every reload — and `isAvailableAsync()` resolves
`false` on web, so there is a fallback there rather than a crash.

**Dates never go through `new Date('2026-11-15')`.** That constructor reads the
value as UTC midnight, so it renders as the 14th for anyone west of Greenwich.
`format.ts` splits the `'YYYY-MM-DD'` string instead, and `todayIso()` builds
from local parts rather than `toISOString()` (which is UTC). The API makes the
matching choice in SQL with `to_char(due_date, 'YYYY-MM-DD')`.

**Currency is hand-rolled, not `Intl.NumberFormat`.** Hermes ships partial
`Intl` support; a formatter that behaves identically on every device is worth
eight lines. It also does Indian grouping — ₹1,00,000, not ₹100,000.

**The list refetches on focus, not on mount.** `useFocusEffect` fires when
returning from the "new entry" modal, so a freshly saved entry appears with no
extra wiring between screens.

**Validation runs on both sides.** The client schema gives instant feedback;
the server schema is what actually enforces the rules, because a request can
always be sent with curl.

**Client-side receipt size check.** The API rejects > 5 MB, but telling the
user *before* a slow upload is the better experience.

### Known limitation

The app is **light-mode only** (`userInterfaceStyle: "light"` in `app.json`).
Supporting dark mode would double every colour decision in `constants/theme.ts`
for a demo that doesn't need it. It is a scope decision, not an oversight.

---

## React → React Native: what actually changes

If you know React, this is the complete list of what is different:

| React (web) | React Native |
|---|---|
| `<div>`, `<section>` | `<View>` |
| any text | `<Text>` — **all** text must be wrapped, or it will not render |
| `<img>` | `<Image source={{ uri }} />` |
| `<button onClick>` | `<Pressable onPress>` (gets a `pressed` boolean from the callback) |
| `<input onChange>` | `<TextInput onChangeText>` — controlled via `value` + `onChangeText` |
| CSS file, `className` | `style={{...}}`, no selectors, no cascade |
| `localStorage` | `expo-secure-store` / `AsyncStorage` |
| `<a href>` | `router.push()` |
| `fontSize: '16px'` | `fontSize: 16` (unitless number) |

Three quirks that catch everyone:

1. **`flexDirection` defaults to `'column'`**, not row. Most vertical stacking
   is therefore free, and horizontal layout is the thing you ask for.
2. **`Input fontSize: 16` or smaller triggers the iOS zoom** — every field in
   this app uses 16 for that reason.
3. **Shadows need `elevation` on Android** or they are silently dropped (see
   the FAB in `home.tsx`).

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| App loads, every request fails | `EXPO_PUBLIC_API_URL` points at `localhost`. Use your LAN IP |
| "Cannot reach the API" | Backend not running, or wrong IP/port, or phone on a different network |
| Stalls for a few seconds on first action | Neon compute autosuspended. Send one request to wake it, or keep the Neon dashboard open |
| OTP rejected immediately | You read the code from an older log line. Codes are single-use — request a new one |
| Photo picker does nothing | Permission denied. Re-enable it in Settings, or reinstall Expo Go to re-prompt |
