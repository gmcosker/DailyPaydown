# DailyPaydown

An iOS-first MVP app that helps users treat their credit card like cash by sending daily push notifications summarizing credit card spend and reminding them to pay it manually.

## Project Structure

- `/ios` - Xcode project (SwiftUI, iOS 17+)
- `/server` - Node.js + TypeScript + Express backend
- `/prisma` - Prisma schema and migrations

## Prerequisites

- Node.js (v18+)
- Docker (for local PostgreSQL)
- Xcode 15+ (for iOS development)
- Plaid account (Sandbox for development)
- Apple Developer account (for APNs)

## Setup Instructions

### Database Setup

1. Start PostgreSQL in Docker:
```bash
docker run --name dailypaydown-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=dailypaydown -p 5432:5432 -d postgres:15
```

### Backend Setup

1. Navigate to server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Configure `.env` with your values:
- Database URL: `postgresql://postgres:postgres@localhost:5432/dailypaydown`
- JWT secret (generate a random string)
- Plaid credentials (from Plaid Dashboard)
- APNs credentials (.p8 key path, Key ID, Team ID, Bundle ID)
- Encryption key for Plaid tokens (32-byte hex string)

5. Run Prisma migrations:
```bash
npx prisma migrate dev
```

6. Start the server:
```bash
npm run dev
```

### iOS Setup

1. Open `ios/DailyPaydown.xcodeproj` in Xcode
2. Configure bundle ID in project settings
3. Enable Push Notifications capability
4. Add your APNs key to the server configuration
5. Build and run on simulator or device

### Plaid Configuration

1. Sign up for Plaid account at https://plaid.com
2. Create a Sandbox application
3. Get your `CLIENT_ID` and `SECRET`
4. Configure products: `transactions`, `auth`
5. Add credentials to server `.env`

### APNs Configuration

1. Generate APNs key in Apple Developer portal
2. Download `.p8` key file
3. Note your Key ID and Team ID
4. Configure Bundle ID
5. Add all values to server `.env`

## Development Notes

- Transaction sync job runs every 15 minutes via node-cron
- Notification scheduler runs every minute (checks for users whose notification time matches)
- For production, use an external scheduler instead of in-process cron
- Use Plaid Sandbox test credentials for development
- The iOS app uses Plaid Link SDK which must be added via Swift Package Manager or CocoaPods

## Quick Start

### Backend
```bash
cd server
npm install
# Create .env file with your credentials (see .env.example)
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Database
```bash
docker run --name dailypaydown-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=dailypaydown -p 5432:5432 -d postgres:15
```

### iOS
1. Open Xcode and create a new iOS App project (iOS 17+, SwiftUI)
2. Copy files from `ios/DailyPaydown/` to your Xcode project
3. Add Plaid Link SDK dependency (Swift Package Manager: https://github.com/plaid/plaid-link-ios)
4. Configure Push Notifications capability
5. Update API base URL in `Network/APIClient.swift` if needed

## Testing

- Use Plaid Sandbox test credentials
- Manually trigger sync job for testing
- Test notifications by setting notification time to current time + 1 minute
- For iOS, use a real device or configure simulator for network testing

