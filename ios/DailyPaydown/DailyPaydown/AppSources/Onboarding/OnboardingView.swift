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
        
        var stepNumber: Int {
            switch self {
            case .plaidLink: return 1
            case .accountSelection: return 2
            case .settingsSetup: return 3
            case .complete: return 3
            }
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Progress indicator
            if currentStep != .complete {
                ProgressIndicatorView(
                    currentStep: currentStep.stepNumber,
                    totalSteps: 3
                )
                .padding(.top)
            }
            
            // Content with transitions
            Group {
                switch currentStep {
                case .plaidLink:
                    PlaidLinkView(
                        onSuccess: { token, itemId in
                            self.publicToken = token
                            self.itemId = itemId
                            HapticFeedback.success()
                            Task {
                                await fetchAccounts(itemId: itemId)
                            }
                        }
                    )
                    .transition(.asymmetric(
                        insertion: .move(edge: .leading).combined(with: .opacity),
                        removal: .move(edge: .trailing).combined(with: .opacity)
                    ))
                    
                case .accountSelection:
                    AccountSelectionView(
                        accounts: accounts,
                        selectedCreditAccountId: $selectedCreditAccountId,
                        selectedCheckingAccountId: $selectedCheckingAccountId,
                        onContinue: {
                            HapticFeedback.medium()
                            Task {
                                await selectAccounts()
                            }
                        },
                        onAddAnotherBank: {
                            HapticFeedback.light()
                            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                                currentStep = .plaidLink
                            }
                        }
                    )
                    .transition(.asymmetric(
                        insertion: .move(edge: .leading).combined(with: .opacity),
                        removal: .move(edge: .trailing).combined(with: .opacity)
                    ))
                    
                case .settingsSetup:
                    SettingsSetupView(
                        notificationTime: $notificationTime,
                        timezone: $timezone,
                        goal: $goal,
                        onComplete: {
                            HapticFeedback.medium()
                            Task {
                                await completeOnboarding()
                            }
                        }
                    )
                    .transition(.asymmetric(
                        insertion: .move(edge: .leading).combined(with: .opacity),
                        removal: .opacity
                    ))
                    
                case .complete:
                    VStack(spacing: 16) {
                        ProgressView()
                            .scaleEffect(1.2)
                        Text("Setting up your account...")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .transition(.opacity)
                }
            }
            .animation(.spring(response: 0.4, dampingFraction: 0.8), value: currentStep)
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
            
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                currentStep = .accountSelection
            }
        } catch {
            print("Error fetching accounts: \(error)")
            HapticFeedback.error()
        }
    }
    
    private func selectAccounts() async {
        guard let creditAccountId = selectedCreditAccountId else {
            HapticFeedback.warning()
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
            
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                currentStep = .settingsSetup
            }
        } catch {
            print("Error selecting accounts: \(error)")
            HapticFeedback.error()
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
            
            // Refresh user data so ContentView can detect onboarding is complete
            await authManager.fetchCurrentUser()
            
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                currentStep = .complete
            }
            
            HapticFeedback.success()
            // Onboarding complete - app will navigate to main view
        } catch {
            print("Error completing onboarding: \(error)")
            HapticFeedback.error()
        }
    }
}

#Preview {
    OnboardingView()
}



