# Test & install on Android

You must run SessionAI on **your computer** (not the cloud agent VM). Your phone cannot reach `127.0.0.1` on a remote machine.

## Option A — Expo Go (fastest)

Best for day-to-day testing.

### 1. On your phone

1. Install **[Expo Go](https://play.google.com/store/apps/details?id=host.exp.exponent)** from the Play Store.
2. Connect the phone to the **same Wi‑Fi** as your computer.

### 2. On your computer

```bash
git pull
npm install
cp .env.example apps/api/.env          # if needed
cp apps/mobile/.env.example apps/mobile/.env
# Fill Supabase + API keys (same values you already use)
```

Find your computer’s LAN IP:

```bash
# macOS / Linux
ipconfig getifaddr en0 2>/dev/null || hostname -I | awk '{print $1}'

# Windows (PowerShell)
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' }).IPAddress
```

Set the mobile API URL to that IP (not `127.0.0.1`):

```env
# apps/mobile/.env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3847
```

Start both processes:

```bash
# terminal 1
npm run api

# terminal 2 — restart after any .env change
npm run mobile
# or: npm run mobile:android
```

In the Expo terminal, press `a` (emulator) or scan the QR code with Expo Go / Camera.

Allow microphone permission when Android asks.

### 3. Smoke check on the phone

1. Sign in / register.
2. Home should load sessions (or empty state).
3. If you see “Can't reach the SessionAI API”, the phone cannot hit your LAN IP — check Wi‑Fi, firewall (port **3847**), and that `EXPO_PUBLIC_API_BASE_URL` matches.

## Option B — Installable APK (no Expo Go)

Use this when you want a real app icon on the home screen.

### EAS Build (recommended)

```bash
cd apps/mobile
npx eas-cli login
npx eas build:configure
npx eas build -p android --profile preview
```

After the build finishes, open the Expo dashboard link on your phone and install the APK (enable “Install unknown apps” if prompted).

Set production-style env for the build (EAS secrets or `eas.json` env):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_BASE_URL` → a URL your phone can reach (LAN IP while at home, or a deployed HTTPS API)

Local APIs still need the phone on the same network (or use a tunnel such as ngrok for the API).

### Local debug APK (needs Android Studio)

```bash
cd apps/mobile
npx expo run:android
```

Requires Android SDK / a connected device with USB debugging.

## Cleartext HTTP

`app.json` sets `android.usesCleartextTraffic: true` so the app can call `http://LAN_IP:3847` during development. Prefer HTTPS for any public deployment.

## Firewall checklist

| Port | Service |
| --- | --- |
| `3847` | SessionAI API |
| `19047` | Expo Metro (dev client / Expo Go) |

Allow inbound TCP on those ports from your LAN, or temporarily disable the firewall while testing.

## Tunnel fallback (Metro only)

If the QR / LAN Expo connection fails:

```bash
cd apps/mobile
npx expo start --tunnel --port 19047
```

This tunnels the **JS bundler** only. The API must still be reachable via `EXPO_PUBLIC_API_BASE_URL` (LAN IP or a public tunnel to port 3847).
