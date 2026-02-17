# Biometric Authentication Guide

## Overview
The VIT (Vehicle Income Tracker) app supports biometric authentication (fingerprint and face recognition) to secure your app and provide quick access after the app locks.

## How Biometric Authentication Works

### 1. **Registration/Setup Process**

#### Step 1: Check Device Support
- The app automatically checks if your device supports biometric authentication when you open the Profile screen
- Supported devices: Most modern smartphones with fingerprint sensors or face recognition (Face ID, Face Unlock)

#### Step 2: Enable Biometrics
1. Open the app and navigate to **Profile** (tap the person icon in the bottom navigation)
2. Scroll down to the **Security** section
3. Find the **Biometrics** toggle switch
4. If your device supports biometrics, the toggle will be enabled
5. Turn on the **Biometrics** toggle to enable biometric authentication

#### Step 3: First-Time Setup
- When you enable biometrics for the first time, your device may prompt you to:
  - Set up a fingerprint (if not already set up)
  - Set up face recognition (if not already set up)
- Follow your device's on-screen instructions to complete the setup

### 2. **How It Works After Setup**

#### Auto-Lock Behavior
Once biometrics are enabled, the app will automatically lock when:
- The app goes to the background (you switch to another app or lock your phone)
- The auto-lock timeout period expires (default: 5 minutes of inactivity)
- You can configure the timeout in Profile → Security → Auto-lock timeout (1, 5, 15, or 30 minutes)

#### Unlocking with Biometrics
When the app is locked:
1. The **Biometric Lock Screen** appears automatically
2. Your device will prompt you to authenticate using:
   - **Fingerprint**: Place your registered finger on the fingerprint sensor
   - **Face Recognition**: Look at your device's front camera
3. Once authenticated successfully, the app unlocks and you can continue using it
4. If authentication fails or is cancelled, tap "Try Again" to retry

### 3. **Tenant-Level Requirements**

#### Tenant-Enforced Biometrics
- Some tenants (companies) may require biometric authentication for all users
- If your tenant requires biometrics:
  - The toggle in Profile → Security will be **disabled** (you cannot turn it off)
  - Biometrics will be **automatically enabled** and cannot be disabled
  - The app will show "Biometrics Required: Required" in the Security section

#### Optional Biometrics
- If your tenant doesn't require biometrics:
  - You can enable or disable biometrics at any time
  - The toggle will be **enabled** and you can control it yourself
  - The app will show "Biometrics Required: Optional" in the Security section

### 4. **Troubleshooting**

#### Biometrics Not Working?
1. **Check Device Support**:
   - Ensure your device has a fingerprint sensor or face recognition capability
   - Make sure biometrics are set up in your device's system settings

2. **Check App Permissions**:
   - The app needs permission to use biometric authentication
   - On Android: Go to Settings → Apps → VIT → Permissions → Biometrics
   - On iOS: Biometrics work automatically if Face ID/Touch ID is enabled

3. **Device Settings**:
   - Ensure fingerprint/face recognition is enabled in your device settings
   - Make sure at least one fingerprint/face is registered on your device

4. **Re-authenticate**:
   - If biometrics fail, you can tap "Try Again" on the lock screen
   - If biometrics continue to fail, you may need to log out and log back in with your password

#### Can't Enable Biometrics?
- If the toggle is disabled, check:
  - Your device may not support biometrics
  - Your tenant may require biometrics (in which case it's already enabled)
  - There may be a system error (try restarting the app)

### 5. **Security Features**

#### Additional Security
- Biometric authentication works alongside other security features:
  - **MFA (Multi-Factor Authentication)**: May be required by your tenant
  - **Device Binding**: Your device may be registered with your tenant
  - **Session Timeout**: Automatic lock after inactivity

#### Privacy
- Biometric data is stored securely on your device only
- The app does not transmit or store your biometric data
- Biometric authentication is handled by your device's secure hardware

### 6. **Disabling Biometrics**

If biometrics are optional (not required by your tenant):
1. Go to **Profile** → **Security**
2. Turn off the **Biometrics** toggle
3. The app will no longer require biometric authentication to unlock
4. You'll still need to log in with your password when the app is closed

## Summary

**To Start Using Biometrics:**
1. ✅ Open Profile screen
2. ✅ Scroll to Security section
3. ✅ Enable Biometrics toggle
4. ✅ Follow device prompts to set up (if needed)
5. ✅ App will now lock automatically and require biometrics to unlock

**When App Locks:**
- App goes to background → Locks automatically
- Inactivity timeout → Locks after configured time
- Unlock → Use fingerprint or face recognition

**Note**: If your tenant requires biometrics, they are automatically enabled and cannot be disabled.

