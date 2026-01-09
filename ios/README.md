# iOS App Setup

## Prerequisites

- Xcode 15+ (with iOS 17+ SDK)
- CocoaPods or Swift Package Manager
- Apple Developer account (for APNs)

## Setup Instructions

1. **Create Xcode Project**
   - Open Xcode
   - Create a new iOS App project
   - Product Name: `DailyPaydown`
   - Interface: SwiftUI
   - Language: Swift
   - Minimum Deployment: iOS 17.0

2. **Add Plaid Link SDK**
   - In Xcode, go to File > Add Package Dependencies
   - Add: `https://github.com/plaid/plaid-link-ios`
   - Or use CocoaPods: add `pod 'Plaid'` to Podfile

3. **Copy Source Files**
   - Copy all files from this directory to your Xcode project
   - Maintain the folder structure (Network/, Auth/, Onboarding/, etc.)

4. **Configure Capabilities**
   - Select your target in Xcode
   - Go to Signing & Capabilities
   - Add "Push Notifications" capability
   - Configure your Bundle Identifier

5. **Update API Base URL**
   - In `Network/APIClient.swift`, update the `baseURL` for production

6. **Configure Info.plist**
   - Add `NSAppTransportSecurity` settings if needed for localhost development
   - For localhost testing, add:
   ```xml
   <key>NSAppTransportSecurity</key>
   <dict>
       <key>NSAllowsLocalNetworking</key>
       <true/>
   </dict>
   ```

## Project Structure

```
DailyPaydown/
├── DailyPaydownApp.swift      # App entry point
├── ContentView.swift          # Main navigation
├── Network/
│   ├── APIClient.swift        # HTTP client
│   ├── Endpoints.swift        # API endpoints
│   └── Models.swift           # Data models
├── Auth/
│   ├── AuthManager.swift      # Auth state management
│   ├── LoginView.swift        # Login screen
│   └── RegisterView.swift    # Registration screen
├── Onboarding/
│   ├── OnboardingView.swift   # Onboarding coordinator
│   ├── PlaidLinkView.swift    # Plaid Link integration
│   ├── AccountSelectionView.swift
│   └── SettingsSetupView.swift
├── Today/
│   └── TodayView.swift        # Main today screen
├── History/
│   └── HistoryView.swift      # History screen
├── Settings/
│   └── SettingsView.swift    # Settings screen
└── NotificationManager.swift  # Push notification handling
```

## Testing

- Use iOS Simulator for UI testing
- For Plaid Link, you'll need a real device or use Plaid's test mode
- Configure backend URL to point to your local server for development




