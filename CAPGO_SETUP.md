# Capgo Live Updates Setup

## 1. Get Capgo API Key

1. Go to [Capgo Dashboard](https://capgo.app/dashboard)
2. Login with your GitHub account
3. Select app: **com.caf.pharmacy** (or create it if needed)
4. Go to **Settings → API Keys**
5. Copy your **API Key**

## 2. Add API Key to GitHub Secrets

1. Go to: `https://github.com/Onahi7/caf-frontend/settings/secrets/actions`
2. Click **"New repository secret"**
3. Name: `CAPGO_API_KEY`
4. Value: Paste your Capgo API key
5. Click **"Add secret"**

## 3. Configure Frontend Environment

Create `.env` file in `caf-frontend/`:

```bash
VITE_API_URL=https://your-heroku-backend.herokuapp.com/api
VITE_WS_URL=wss://your-heroku-backend.herokuapp.com/inventory
VITE_ENABLE_OFFLINE=true
VITE_ENABLE_LIVE_UPDATES=true
VITE_LIVE_UPDATE_CHANNEL=production
```

## 4. Initialize Capgo in Your Project

```bash
cd caf-frontend
npx @capgo/cli init
# OR if already initialized:
npx @capgo/cli auth login
npx @capgo/cli app:info
```

## 5. How Updates Work

```
[Push to main branch]
    ↓
[GitHub Actions triggers]
    ↓
[Builds web assets + deploys to Capgo]
    ↓
[App checks for update on startup]
    ↓
[Downloads update in background]
    ↓
[Next app restart = new version]
```

## 6. Test Live Update

```bash
# Make a small change to frontend
echo "console.log('v2.0');" >> src/main.tsx

# Commit and push
git add .
git commit -m "Test live update"
git push origin main

# Check GitHub Actions: https://github.com/Onahi7/caf-frontend/actions

# After ~5 min, restart your Android app
# It should load the new version!
```

## 7. Capgo CLI Commands (Optional)

```bash
# Check for updates manually
npx @capgo/cli bundle:list

# Upload manually (without GitHub Actions)
npx @capgo/cli bundle upload --channel production

# Check app update status
npx @capgo/cli app:info
```

## Notes

- **Channel**: `production` (you can create `staging`, `development` too)
- **Auto-update**: Capgo SDK checks on app startup by default
- **Fallback**: If Capgo is unreachable, app uses bundled web assets
- **Rollback**: Use Capgo dashboard to revert to previous bundle

## Troubleshooting

If updates don't work:

1. Check `VITE_ENABLE_LIVE_UPDATES=true` in `.env`
2. Verify `@capgo/capacitor-updater` is installed
3. Check GitHub Actions logs for deployment errors
4. Check Capgo dashboard for uploaded bundles
5. Test with: `npx @capgo/cli doctor`
