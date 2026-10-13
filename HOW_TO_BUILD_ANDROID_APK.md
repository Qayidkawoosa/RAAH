# Building the Android APK for RAAH (Raasta Kashmir)

This guide walks you through generating a standalone `.apk` file that you can install directly on any Android phone (no Google Play Store required).

---

## 1. What Has Been Configured

1. **`app.json`**:
   - Package name: `com.raasta.kashmir`
   - Android permissions: `CAMERA`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`
   - Version code: `1`
2. **`eas.json`**:
   - `preview` build profile configured with `"buildType": "apk"` (generates an installable `.apk` instead of an `.aab` bundle).
3. **`package.json`**:
   - Added `"build:apk"` shortcut script.

---

## 2. Generate the APK (Cloud Build - Recommended)

Using Expo Application Services (EAS) is free and requires zero local Android SDK / Gradle configuration.

### Step 1: Log in to Expo
In your terminal:
```bash
npx eas-cli login
```
*(If you don't have an Expo account, sign up for free at [expo.dev](https://expo.dev) or choose "Create an account" in the prompt).*

### Step 2: Configure the Project on EAS (One-time only)
```bash
npx eas-cli project:init
```
*(When prompted to create a new project on your account, hit Enter / Yes).*

### Step 3: Start the APK Build
Run:
```bash
npm run build:apk
```
*(Or directly: `npx eas-cli build -p android --profile preview`)*

When prompted:
- **"Generate a new Android Keystore?"** -> Choose **Yes** (EAS will securely manage it).

### Step 4: Download & Install
Once the build completes (usually ~5-10 minutes):
1. EAS will display a direct URL and a QR code in your terminal.
2. Open the link or scan the QR code on your Android device.
3. Download the `.apk` file and tap **Install**.
   *(If prompted, allow "Install from unknown sources" on your Android device).*

---

## 3. Alternative: Local Offline Build (Advanced)

If you have **Android Studio**, **Android SDK**, and **Java 17** installed on your Mac:

```bash
# 1. Generate the native android/ folder
npx expo prebuild --platform android

# 2. Build the release APK locally
cd android && ./gradlew assembleRelease
```
The output `.apk` will be generated at:
`android/app/build/outputs/apk/release/app-release.apk`
