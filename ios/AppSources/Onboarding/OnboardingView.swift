import SwiftUI

struct OnboardingView: View {
    @StateObject private var authManager = AuthManager.shared
    @State private var currentStep: OnboardingStep = .plaidLink
    @State private var linkToken: String?
    @State private var publicToken: String?
    @State private var itemId: String?
    @State private var accounts: [Account] = []
    @State private var selectedCreditAccountId: String?
    @State private var selectedCheckingAccountId: String?
    @State private var notificationTime = Date()
    @State private var timezone = TimeZone.current.identifier
    @State private var goal = "Spend like cash"
    
    enum OnboardingStep {
        case plaidLink
        case accountSelection
        case settingsSetup
        case complete
    }
    
    var body: some View {
        Group {
            switch currentStep {
            case .plaidLink:
                PlaidLinkView(
                    onSuccess: { token, itemId in
                        self.publicToken = token
                        self.itemId = itemId
                        Task {
                            await fetchAccounts(itemId: itemId)
                        }
                    }
                )
            case .accountSelection:
                AccountSelectionView(
                    accounts: accounts,
                    selectedCreditAccountId: $selectedCreditAccountId,
                    selectedCheckingAccountId: $selectedCheckingAccountId,
                    onContinue: {
                        Task {
                            await selectAccounts()
                        }
                    },
                    onAddAnotherBank: {
                        currentStep = .plaidLink
                    }
                )
            case .settingsSetup:
                SettingsSetupView(
                    notificationTime: $notificationTime,
                    timezone: $timezone,
                    goal: $goal,
                    onComplete: {
                        Task {
                            await completeOnboarding()
                        }
                    }
                )
            case .complete:
                ProgressView("Setting up your account...")
            }
        }
        .task {
            await createLinkToken()
        }
    }
    
    private func createLinkToken() async {
        do {
            let response: CreateLinkTokenResponse = try await APIClient.shared.request(
                endpoint: Endpoints.createLinkToken,
                method: "POST"
            )
            linkToken = response.linkToken
        } catch {
            print("Error creating link token: \(error)")
        }
    }
    
    private func fetchAccounts(itemId: String) async {
        do {
            let response: GetAccountsResponse = try await APIClient.shared.request(
                endpoint: "\(Endpoints.getAccounts)?itemId=\(itemId)"
            )
            accounts = response.accounts
            currentStep = .accountSelection
        } catch {
            print("Error fetching accounts: \(error)")
        }
    }
    
    private func selectAccounts() async {
        guard let creditAccountId = selectedCreditAccountId else {
            return
        }
        
        do {
            let request = SelectAccountsRequest(
                creditAccountId: creditAccountId,
                checkingAccountId: selectedCheckingAccountId
            )
            let _: [String: Bool] = try await APIClient.shared.request(
                endpoint: Endpoints.selectAccounts,
                method: "POST",
                body: request
            )
            currentStep = .settingsSetup
        } catch {
            print("Error selecting accounts: \(error)")
        }
    }
    
    private func completeOnboarding() async {
        // Update settings
        let timeFormatter = DateFormatter()
        timeFormatter.dateFormat = "HH:mm"
        let timeString = timeFormatter.string(from: notificationTime)
        
        do {
            let request = UpdateSettingsRequest(
                notificationTime: timeString,
                timezone: timezone,
                goal: goal,
                creditAccountId: selectedCreditAccountId,
                checkingAccountId: selectedCheckingAccountId
            )
            let _: [String: Bool] = try await APIClient.shared.request(
                endpoint: Endpoints.settings,
                method: "PATCH",
                body: request
            )
            currentStep = .complete
            // Onboarding complete - app will navigate to main view
        } catch {
            print("Error completing onboarding: \(error)")
        }
    }
}

#Preview {
    OnboardingView()
}



