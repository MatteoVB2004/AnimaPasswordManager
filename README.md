# Anima Password Manager (PWA)

This project is a client-side password manager. It stores data in your browser's localStorage and encrypts vault contents with your master password.

## Install as an Android app (PWA)

1. Serve the folder locally or host it (PWA requires HTTPS unless localhost):
   - Option A: Double-click `index.html` for quick testing (install prompt may be limited).
   - Option B (recommended): Use a simple local server for full PWA support.
2. Open the site in Chrome on Android.
3. Tap the three-dot menu > "Install app" (or "Add to Home screen").

### Simple local server options
- VS Code Live Server extension
- Python (if installed): `python -m http.server 8080`
- Node: `npx serve .`

Then browse to `http://<your-pc-ip>:8080` on your phone (both devices on same Wi‑Fi).

## Features
- Local-only accounts with encrypted vault per user
- Password generator and strength meter
- Categories, search, and drag reordering
- MFA setup with otplib + QR code
- Backup/restore vault (encrypted with master password)
- Optional particles background and theme toggle
- Installable PWA with offline support

## Packaging a native Android APK (optional)
If you need a Play-Store-style APK, wrap this PWA with Capacitor:

1. Initialize Node project and install Capacitor:
   ```bash
   npm init -y
   npm install @capacitor/core @capacitor/cli --save
   npx cap init anima com.example.anima --web-dir .
   ```
2. Add Android platform and open Android Studio:
   ```bash
   npm install @capacitor/android --save
   npx cap add android
   npx cap open android
   ```
3. In Android Studio, build a Signed Bundle/APK. Set app icon using your images in `Images/`.

Notes:
- PWA install is easiest and safe (no app store needed).
- The app is local-only. Do NOT uninstall without exporting a backup first if you need to keep data.
