# CAF Pharmacy POS - Live Update & APK Build Setup

## Overview

Your CAF Pharmacy POS system uses:
- **GitHub Actions** for CI/CD
- **Capgo** for live updates (no app store re-submission needed)
- **Capacitor** for Android/iOS deployment

---

## GitHub Actions Workflows

### 1. `build-apk.yml` - Android APK Build

**Triggers:**
- Push to `main` or `master` branch
- Manual dispatch with options:
  - Build type: `release` (signed) or `debug`
  - Upload to Capgo: `true/false`

**What it does:**
1. Sets up Java 17, Android SDK, Node.js 20, pnpm
2. Installs dependencies
3. Builds web assets (`pnpm run build`)
4. Syncs to Android (`cap sync android`)
5. Builds APK (release or debug)
6. Uploads artifact (APK file)
7. Optionally publishes to Capgo

**Secrets needed:**
| Secret | Description |
|--------|-------------|
| `ANDROID_KEYSTORE_B64` | Base64-encoded keystore file |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias |
| `ANDROID_KEY_PASSWORD` | Key password |
| `CAPGO_API_KEY` | Capgo API key (for live updates) |

---

### 2. `live-update.yml` - Web Asset Updates (NEW!)

**Triggers:**
- Push to `main` branch (only when `caf-frontend/**` changes)

**What it does:**
1. Sets up Node.js 20, pnpm
2. Installs dependencies
3. Builds web assets (`pnpm run build`)
4. Uploads to Capgo (`npx @capgo/cli bundle upload`)

**Secrets needed:**
| Secret | Description |
|--------|-------------|
| `CAPGO_API_KEY` | Capgo API key |

---

## How Updates Reach Users

### For Web Assets (Live Updates via Capgo):

```
[You push code to main]
    ↓
[GitHub Actions: live-update.yml triggers]
    ↓
[Builds web assets in CI]
    ↓
[Uploads bundle to Capgo CDN]
    ↓
[App checks for update on startup]
    ↓
[Downloads update in background]
    ↓
[Next app restart = new version loaded!]
```

**No app store re-submission needed!**

---

### For Full APK Builds (Native Changes):

```
[You push code to main]
    ↓
[GitHub Actions: build-apk.yml triggers]
    ↓
[Builds signed APK in CI]
    ↓
[Download APK from Actions artifacts]
    ↓
[Install on device or distribute manually]
```

**Use this when:**
- Updating native plugins (camera, biometrics, etc.)
- Changing Capacitor config
- Updating Android/iOS permissions

---

## Setting Up Secrets

### 1. Capgo API Key

1. Go to [Capgo Dashboard](https://capgo.app/dashboard)
2. Login with your GitHub account
3. Find or create app: **com.caf.pharmacy**
4. Go to **Settings → API Keys**
5. Copy the API key
6. Add to GitHub: `https://github.com/Onahi7/caf-frontend/settings/secrets/actions`
   - Name: `CAPGO_API_KEY`
   - Value: Paste your API key

### 2. Android Signing (for release APKs)

Generate a keystore (if you haven't):
```bash
keytool -genkey -v -keystore release-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias caf-pharmacy
```

Convert to base64:
```bash
base64 release-key.jks > release-key.jks.base64
```

Add to GitHub secrets:
- `ANDROID_KEYSTORE_B64`: Copy contents of `release-key.jks.base64`
- `ANDROID_KEYSTORE_PASSWORD`: Your keystore password
- `ANDROID_KEY_ALIAS`: `caf-pharmacy`
- `ANDROID_KEY_PASSWORD`: Your key password

---

## Testing Live Updates

### 1. Make a Small Change
```bash
cd caf-frontend
echo "console.log('v2.0 - Live Update Test');" >> src/main.tsx
git add .
git commit -m "Test live update"
git push origin main
```

### 2. Check GitHub Actions
- Go to: `https://github.com/Onahi7/caf-frontend/actions`
- Wait for `Deploy Live Update to Capgo` workflow to complete (~5 min)

### 3. Test on Device
- Open your Android app
- Close and restart the app (or wait for auto-check)
- The new version should load!

Check Capgo dashboard to see the uploaded bundle.

---

## Common Commands

### Capgo CLI (Local)
```bash
# Login to Capgo
npx @capgo/cli login

# Check app info
npx @capgo/cli app:info

# List bundles
npx @capgo/cli bundle:list

# Upload manually
npx @capgo/cli bundle upload --channel production

# Check for updates (in app)
npx @capgo/cli doctor
```

### GitHub Actions (Manual Trigger)
```bash
# Trigger APK build manually
gh workflow run build-apk.yml \
  -f build_type=release \
  -f upload_to_capgo=true
```

---

## Troubleshooting

### Live Updates Not Working?

1. Check `VITE_ENABLE_LIVE_UPDATES=true` in `.env`
2. Verify `@capgo/capacitor-updater` is installed
3. Check Capgo dashboard for uploaded bundles
4. Check GitHub Actions logs for errors
5. Test with: `npx @capgo/cli doctor`

### APK Build Fails?

1. Check GitHub Actions logs
2. Verify all secrets are set correctly
3. Check Java/Android SDK setup
4. Ensure `cap sync android` runs successfully locally

### App Not Updating?

1. Check Capgo channel (`production` vs `staging`)
2. Verify app ID matches: `com.caf.pharmacy`
3. Check network connectivity on device
4. View logs: `adb logcat | grep Capgo`

---

## Next Steps

1. ✅ **Add `CAPGO_API_KEY` to GitHub secrets**
2. ✅ **Push a test change to `main` branch**
3. ✅ **Watch GitHub Actions build the live update**
4. ✅ **Restart your app and see the new version!**

For detailed Capgo setup, see `CAPGO_SETUP.md`.

---

## File Checklist

- ✅ `.github/workflows/live-update.yml` - Live update workflow (NEW!)
- ✅ `.github/workflows/build-apk.yml` - APK build workflow (already existed)
- ✅ `CAPGO_SETUP.md` - Detailed Capgo setup guide (NEW!)
- ✅ `@capgo/capacitor-updater` - Already in `package.json`
- ✅ `capacitor.config.ts` - App ID: `com.caf.pharmacy`

---

**You're all set!** 🎉

Push code → GitHub Actions builds → Capgo deploys → App updates automatically!
