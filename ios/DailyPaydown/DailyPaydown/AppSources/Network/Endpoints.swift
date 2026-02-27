import Foundation

enum Endpoints {
    // Auth
    static let register = "/auth/register"
    static let login = "/auth/login"
    static let me = "/auth/me"
    
    // Plaid
    static let createLinkToken = "/plaid/create-link-token"
    static let exchangePublicToken = "/plaid/exchange-public-token"
    static let getAccounts = "/plaid/accounts"
    static let selectAccounts = "/plaid/select-accounts"
    
    // Today
    static let today = "/today"
    static let todayTransactions = "/today/transactions"
    static let markPaid = "/today/mark-paid"
    static let testHistory = "/today/test/history"
    static let testTransactions = "/today/test/transactions"
    static let testResetPaid = "/today/test/reset-paid"
    static let testNotification = "/today/test/notification"
    
    // History
    static let history = "/history"
    
    // Settings
    static let settings = "/settings"
    
    // Account
    static let deleteAccount = "/auth/account"

    // Device
    static let registerDevice = "/device/register"
}



