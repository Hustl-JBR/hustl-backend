# Hustl iOS App - Build & Deployment Guide

## Project Setup Complete ✅

The Capacitor iOS project has been configured with:
- App ID: `com.hustljobs.app`
- App Name: `Hustl`
- Real-time WebSocket updates
- Native status bar styling
- Keyboard handling for mobile forms
- Background/foreground state management
- Privacy permissions configured

---

## Step 1: Apple Developer Account (Required)

1. Go to [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll)
2. Sign up with your Apple ID ($99/year)
3. Wait for approval (24-48 hours)

---

## Step 2: Create App in App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click "My Apps" → "+" → "New App"
3. Fill in:
   - **Platform**: iOS
   - **Name**: Hustl
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: com.hustljobs.app
   - **SKU**: hustl-ios-1
   - **User Access**: Full Access

---

## Step 3: Create Certificates & Provisioning (On Your Mac - 10 mins)

### 3a. Create Distribution Certificate

1. Open **Keychain Access** on your Mac
2. Go to **Keychain Access** → **Certificate Assistant** → **Request a Certificate from a Certificate Authority**
3. Enter your email, leave CA email blank, select "Saved to disk"
4. Save the `.certSigningRequest` file

5. Go to [developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates)
6. Click "+" → Select "Apple Distribution"
7. Upload your `.certSigningRequest` file
8. Download the certificate and double-click to install

### 3b. Create App ID

1. Go to [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers)
2. Click "+" → "App IDs" → "App"
3. Description: `Hustl`
4. Bundle ID: Explicit → `com.hustljobs.app`
5. Enable capabilities: Push Notifications (for future use)
6. Register

### 3c. Create Provisioning Profile

1. Go to [developer.apple.com/account/resources/profiles](https://developer.apple.com/account/resources/profiles)
2. Click "+" → "App Store Connect"
3. Select your App ID (`com.hustljobs.app`)
4. Select your Distribution Certificate
5. Name it: `Hustl App Store`
6. Download the `.mobileprovision` file

---

## Step 4: Set Up Codemagic (Cloud Build)

1. Go to [codemagic.io](https://codemagic.io) and sign up (free tier)
2. Connect your GitHub repository
3. Add a new app → Select your Hustl repo
4. Choose "Capacitor/Ionic" as the project type

### Upload Signing Credentials to Codemagic:

1. In Codemagic, go to your app settings → "Code signing"
2. Upload:
   - **Distribution Certificate** (.p12 file - export from Keychain Access)
   - **Provisioning Profile** (.mobileprovision file from Step 3c)
3. Set the certificate password

---

## Step 5: Configure Codemagic Build (codemagic.yaml)

Create this file in your repo root:

```yaml
# codemagic.yaml
workflows:
  ios-release:
    name: iOS Release
    instance_type: mac_mini_m2
    max_build_duration: 60
    environment:
      ios_signing:
        distribution_type: app_store
        bundle_identifier: com.hustljobs.app
      vars:
        XCODE_WORKSPACE: "ios/App/App.xcworkspace"
        XCODE_SCHEME: "App"
    scripts:
      - name: Install dependencies
        script: npm ci
      - name: Sync Capacitor
        script: npx cap sync ios
      - name: Install CocoaPods
        script: |
          cd ios/App
          pod install
      - name: Build IPA
        script: |
          xcode-project use-profiles
          xcode-project build-ipa \
            --workspace "$XCODE_WORKSPACE" \
            --scheme "$XCODE_SCHEME"
    artifacts:
      - build/ios/ipa/*.ipa
    publishing:
      app_store_connect:
        auth: integration
        submit_to_testflight: true
```

---

## Step 6: App Store Assets Required

Before submitting, you'll need:

### Screenshots (Required)
- 6.7" iPhone (1290 x 2796 px) - iPhone 14 Pro Max
- 6.5" iPhone (1284 x 2778 px) - iPhone 12 Pro Max
- 5.5" iPhone (1242 x 2208 px) - iPhone 8 Plus

### App Information
- **App Name**: Hustl
- **Subtitle**: Fast Local Help in Tennessee
- **Description**: (See below)
- **Keywords**: hustl, local help, moving, yard work, gig jobs, tennessee, hire help
- **Support URL**: https://hustljobs.com/support
- **Privacy Policy URL**: https://hustljobs.com/privacy

### Suggested App Store Description:

```
Hustl connects you with local help for moving, yard work, power washing, junk removal, and more – instantly.

FOR CUSTOMERS:
• Post a job in under 60 seconds
• Get offers from verified local hustlers
• Secure payment held in escrow until job is done
• Rate and review after completion

FOR HUSTLERS:
• Browse jobs near you
• Set your own rates
• Get paid same-day via Stripe
• Build your reputation with reviews

Whether you need help moving furniture, cleaning gutters, or hauling junk – Hustl makes it easy to find reliable local help fast.

Currently serving all of Tennessee including Knoxville, Nashville, Chattanooga, and Memphis.
```

---

## Step 7: App Icons

You'll need to generate app icons in these sizes:
- 20x20, 29x29, 40x40, 58x58, 60x60, 76x76, 80x80, 87x87, 120x120, 152x152, 167x167, 180x180, 1024x1024

**Tool**: Use [appicon.co](https://www.appicon.co/) - upload your logo SVG and it generates all sizes.

Place generated icons in: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

---

## Build Commands (Local Reference)

```bash
# Sync web code to iOS
npx cap sync ios

# Open in Xcode (on Mac)
npx cap open ios

# Build from command line (on Mac)
cd ios/App && xcodebuild -workspace App.xcworkspace -scheme App -configuration Release
```

---

## Timeline Estimate

| Task | Time |
|------|------|
| Apple Developer enrollment | 24-48 hours |
| Certificates & profiles | 30 minutes |
| Codemagic setup | 30 minutes |
| App icons & screenshots | 1-2 hours |
| First build & test | 1 hour |
| App Store review | 1-3 days |

**Total: ~1 week from start to App Store**

---

## Questions?

Common issues:
- **Build fails**: Usually missing CocoaPods. Run `pod install` in `ios/App/`
- **Signing error**: Check that Bundle ID matches exactly in all places
- **Rejected by Apple**: Most common reasons are missing privacy policy or screenshot issues

---

## Next Steps After iOS Launch

1. **Push Notifications** - Already have the capability enabled
2. **Android Build** - Same Capacitor setup, just run `npx cap add android`
3. **App Updates** - Just push to GitHub, Codemagic builds automatically
