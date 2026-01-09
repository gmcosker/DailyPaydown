import Foundation

// MARK: - Auth Models
struct RegisterRequest: Codable {
    let email: String
    let password: String
}

struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct AuthResponse: Codable {
    let token: String
    let user: User
}

struct User: Codable {
    let id: String
    let email: String
    let timezone: String?
    let notificationTime: String?
    let goal: String?
    let createdAt: String
}

// MARK: - Plaid Models
struct CreateLinkTokenResponse: Codable {
    let linkToken: String
}

struct ExchangePublicTokenRequest: Codable {
    let publicToken: String
}

struct ExchangePublicTokenResponse: Codable {
    let success: Bool
    let itemId: String
}

struct Account: Codable {
    let accountId: String
    let name: String
    let type: String
    let subtype: String?
    let mask: String?
}

struct GetAccountsResponse: Codable {
    let accounts: [Account]
}

struct SelectAccountsRequest: Codable {
    let creditAccountId: String?
    let checkingAccountId: String?
}

// MARK: - Today Models
struct TodaySummary: Codable {
    let totalAmount: Double
    let transactionCount: Int
    let lastUpdated: String?
    let checkingAvailable: Double?
    let markedPaid: Bool
}

struct Transaction: Codable {
    let id: String
    let name: String
    let amount: Double
    let pending: Bool
    let date: String
}

struct TodayTransactionsResponse: Codable {
    let transactions: [Transaction]
}

struct MarkPaidRequest: Codable {
    let date: String?
}

struct MarkPaidResponse: Codable {
    let success: Bool
    let markedPaidAt: String?
}

// MARK: - History Models
struct HistoryDay: Codable {
    let date: String
    let totalAmount: Double
    let transactionCount: Int
    let markedPaid: Bool
}

struct HistoryResponse: Codable {
    let days: [HistoryDay]
}

// MARK: - Settings Models
struct UpdateSettingsRequest: Codable {
    let notificationTime: String?
    let timezone: String?
    let goal: String?
    let creditAccountId: String?
    let checkingAccountId: String?
}

// MARK: - Device Models
struct RegisterDeviceRequest: Codable {
    let apnsToken: String
}



