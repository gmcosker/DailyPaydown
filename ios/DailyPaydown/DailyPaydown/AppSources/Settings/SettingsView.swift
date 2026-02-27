import SwiftUI

struct SettingsView: View {
    @StateObject private var authManager = AuthManager.shared
    @State private var notificationTime: Date = Date()
    @State private var timezone: String = TimeZone.current.identifier
    @State private var goal: String = "Spend like cash"
    @State private var showSaveSuccess = false
    @State private var saveError: String?
    @State private var hasLoadedSettings = false
    @State private var isTestingNotification = false
    @State private var testNotificationMessage: String?
    @State private var testNotificationSuccess = false
    @State private var showPlaidLink = false
    @State private var plaidConnectionMessage: String?
    @State private var plaidConnectionSuccess = false
    @State private var showAccountSelection = false
    @State private var accounts: [Account] = []
    @State private var selectedCreditAccountId: String?
    @State private var selectedCheckingAccountId: String?
    @State private var isLoadingAccounts = false
    @State private var showDeleteConfirmation = false
    @State private var isDeletingAccount = false
    
    private let apiClient = APIClient.shared
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Notification Time", selection: $notificationTime, displayedComponents: .hourAndMinute)
                } header: {
                    Text("Notifications")
                }
                
                Section {
                    Picker("Timezone", selection: $timezone) {
                        ForEach(TimeZone.knownTimeZoneIdentifiers.sorted(), id: \.self) { tz in
                            Text(tz).tag(tz)
                        }
                    }
                } header: {
                    Text("Timezone")
                }
                
                Section {
                    Picker("Goal", selection: $goal) {
                        Text("Spend like cash").tag("Spend like cash")
                        Text("Avoid surprise statements").tag("Avoid surprise statements")
                        Text("Pay down daily").tag("Pay down daily")
                        Text("Build awareness").tag("Build awareness")
                        Text("Other").tag("Other")
                    }
                } header: {
                    Text("Your Goal")
                }
                
                Section {
                    Button("Reconnect Plaid") {
                        HapticFeedback.medium()
                        showPlaidLink = true
                    }
                    
                    Button(action: {
                        HapticFeedback.light()
                        fetchAccountsForSelection()
                    }) {
                        HStack {
                            if isLoadingAccounts {
                                ProgressView()
                                    .scaleEffect(0.8)
                            }
                            Text("Change Selected Accounts")
                        }
                    }
                    .disabled(isLoadingAccounts)
                    
                    if let message = plaidConnectionMessage {
                        Text(message)
                            .font(.caption)
                            .foregroundColor(plaidConnectionSuccess ? .green : .orange)
                    }
                } header: {
                    Text("Bank Connection")
                }
                
                Section {
                    Button(action: {
                        HapticFeedback.medium()
                        testNotification()
                    }) {
                        HStack {
                            if isTestingNotification {
                                ProgressView()
                                    .scaleEffect(0.8)
                            } else {
                                Image(systemName: "bell.badge")
                            }
                            Text("Test Push Notification")
                        }
                    }
                    .disabled(isTestingNotification)
                    
                    if let message = testNotificationMessage {
                        Text(message)
                            .font(.caption)
                            .foregroundColor(testNotificationSuccess ? .green : .orange)
                    }
                } header: {
                    Text("Testing")
                } footer: {
                    Text("This will send a push notification immediately. Requires APNs to be configured on the server and device to be registered.")
                }
                
                Section {
                    Link("Privacy Policy", destination: URL(string: "https://dailypaydown.com/privacy")!)
                }
                
                Section {
                    Button(action: {
                        HapticFeedback.heavy()
                        showDeleteConfirmation = true
                    }) {
                        HStack {
                            if isDeletingAccount {
                                ProgressView()
                                    .scaleEffect(0.8)
                            }
                            Text("Delete Account")
                        }
                        .foregroundColor(.red)
                    }
                    .disabled(isDeletingAccount)
                }
            }
            .navigationTitle("Settings")
            .overlay(alignment: .top) {
                if showSaveSuccess {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        Text("Saved")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.green)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color(.systemBackground))
                    .cornerRadius(20)
                    .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
                    .padding(.top, 60)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .zIndex(1)
                }
            }
            .onAppear {
                loadSettings()
            }
            .onChange(of: notificationTime) { _ in
                if hasLoadedSettings {
                    saveSettings()
                }
            }
            .onChange(of: timezone) { _ in
                if hasLoadedSettings {
                    saveSettings()
                }
            }
            .onChange(of: goal) { _ in
                if hasLoadedSettings {
                    saveSettings()
                }
            }
            .fullScreenCover(isPresented: $showPlaidLink) {
                PlaidLinkView(
                    onSuccess: { publicToken, itemId in
                        Task {
                            await exchangePublicToken(publicToken: publicToken)
                        }
                    }
                )
            }
            .sheet(isPresented: $showAccountSelection) {
                NavigationStack {
                    AccountSelectionView(
                        accounts: accounts,
                        selectedCreditAccountId: $selectedCreditAccountId,
                        selectedCheckingAccountId: $selectedCheckingAccountId,
                        onContinue: {
                            HapticFeedback.medium()
                            Task {
                                await saveAccountSelection()
                            }
                        },
                        onAddAnotherBank: {
                            showAccountSelection = false
                            HapticFeedback.light()
                            showPlaidLink = true
                        }
                    )
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") {
                                showAccountSelection = false
                            }
                        }
                    }
                }
            }
            .alert("Delete Account", isPresented: $showDeleteConfirmation) {
                Button("Cancel", role: .cancel) { }
                Button("Delete", role: .destructive) {
                    deleteAccount()
                }
            } message: {
                Text("This will permanently delete your account and all associated data. This action cannot be undone.")
            }
        }
    }
    
    private func exchangePublicToken(publicToken: String) async {
        do {
            struct ExchangeRequest: Codable {
                let publicToken: String
            }
            
            struct ExchangeResponse: Codable {
                let success: Bool
                let itemId: String?
            }
            
            let response: ExchangeResponse = try await apiClient.request(
                endpoint: Endpoints.exchangePublicToken,
                method: "POST",
                body: ExchangeRequest(publicToken: publicToken)
            )
            
            await MainActor.run {
                showPlaidLink = false
                if response.success {
                    plaidConnectionSuccess = true
                    plaidConnectionMessage = "Bank account reconnected successfully!"
                    HapticFeedback.success()
                } else {
                    plaidConnectionSuccess = false
                    plaidConnectionMessage = "Failed to reconnect bank account"
                    HapticFeedback.error()
                }
                
                // Clear message after 5 seconds
                Task {
                    try? await Task.sleep(nanoseconds: 5_000_000_000)
                    await MainActor.run {
                        plaidConnectionMessage = nil
                    }
                }
            }
        } catch {
            await MainActor.run {
                showPlaidLink = false
                plaidConnectionSuccess = false
                plaidConnectionMessage = "Error: \(error.localizedDescription)"
                HapticFeedback.error()
                
                // Clear message after 5 seconds
                Task {
                    try? await Task.sleep(nanoseconds: 5_000_000_000)
                    await MainActor.run {
                        plaidConnectionMessage = nil
                    }
                }
            }
        }
    }
    
    private func testNotification() {
        isTestingNotification = true
        testNotificationMessage = nil
        testNotificationSuccess = false
        
        Task {
            do {
                struct TestNotificationResponse: Codable {
                    let success: Bool
                    let message: String?
                    let error: String?
                    let details: String?
                }
                
                let response: TestNotificationResponse = try await apiClient.request(
                    endpoint: Endpoints.testNotification,
                    method: "POST"
                )
                
                await MainActor.run {
                    isTestingNotification = false
                    if response.success {
                        testNotificationSuccess = true
                        testNotificationMessage = response.message ?? "Notification sent successfully!"
                        HapticFeedback.success()
                    } else {
                        testNotificationSuccess = false
                        testNotificationMessage = response.message ?? response.error ?? "Failed to send notification. Check APNs configuration."
                        HapticFeedback.error()
                    }
                    
                    // Clear message after 5 seconds
                    Task {
                        try? await Task.sleep(nanoseconds: 5_000_000_000)
                        await MainActor.run {
                            testNotificationMessage = nil
                        }
                    }
                }
            } catch {
                await MainActor.run {
                    isTestingNotification = false
                    testNotificationSuccess = false
                    testNotificationMessage = "Error: \(error.localizedDescription)"
                    HapticFeedback.error()
                    
                    // Clear message after 5 seconds
                    Task {
                        try? await Task.sleep(nanoseconds: 5_000_000_000)
                        await MainActor.run {
                            testNotificationMessage = nil
                        }
                    }
                }
            }
        }
    }
    
    private func loadSettings() {
        if let user = authManager.currentUser {
            if let notificationTimeString = user.notificationTime {
                let formatter = DateFormatter()
                formatter.dateFormat = "HH:mm"
                if let time = formatter.date(from: notificationTimeString) {
                    notificationTime = time
                }
            }
            if let userTimezone = user.timezone {
                timezone = userTimezone
            }
            if let userGoal = user.goal {
                goal = userGoal
            }
        }
        // Mark as loaded after initial load to prevent auto-save on first render
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            hasLoadedSettings = true
        }
    }
    
    private func saveSettings() {
        let timeFormatter = DateFormatter()
        timeFormatter.dateFormat = "HH:mm"
        let timeString = timeFormatter.string(from: notificationTime)
        
        // Clear previous error
        saveError = nil
        
        Task {
            do {
                let request = UpdateSettingsRequest(
                    notificationTime: timeString,
                    timezone: timezone,
                    goal: goal,
                    creditAccountId: nil,
                    checkingAccountId: nil
                )
                let _: [String: Bool] = try await apiClient.request(
                    endpoint: Endpoints.settings,
                    method: "PATCH",
                    body: request
                )
                
                // Show success feedback
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    showSaveSuccess = true
                }
                
                HapticFeedback.success()
                
                // Auto-hide success indicator
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                withAnimation {
                    showSaveSuccess = false
                }
            } catch {
                print("Error saving settings: \(error)")
                saveError = error.localizedDescription
                HapticFeedback.error()
            }
        }
    }
    private func fetchAccountsForSelection() {
        isLoadingAccounts = true

        Task {
            do {
                let response: GetAccountsResponse = try await apiClient.request(
                    endpoint: Endpoints.getAccounts
                )

                await MainActor.run {
                    isLoadingAccounts = false
                    accounts = response.accounts

                    if accounts.isEmpty {
                        plaidConnectionSuccess = false
                        plaidConnectionMessage = "No accounts found. Try reconnecting your bank."
                        HapticFeedback.warning()

                        Task {
                            try? await Task.sleep(nanoseconds: 5_000_000_000)
                            await MainActor.run {
                                plaidConnectionMessage = nil
                            }
                        }
                    } else {
                        showAccountSelection = true
                    }
                }
            } catch {
                await MainActor.run {
                    isLoadingAccounts = false
                    plaidConnectionSuccess = false
                    plaidConnectionMessage = "Failed to load accounts: \(error.localizedDescription)"
                    HapticFeedback.error()

                    Task {
                        try? await Task.sleep(nanoseconds: 5_000_000_000)
                        await MainActor.run {
                            plaidConnectionMessage = nil
                        }
                    }
                }
            }
        }
    }

    private func saveAccountSelection() async {
        guard let creditAccountId = selectedCreditAccountId else {
            HapticFeedback.warning()
            return
        }

        do {
            let request = SelectAccountsRequest(
                creditAccountId: creditAccountId,
                checkingAccountId: selectedCheckingAccountId
            )
            let _: [String: Bool] = try await apiClient.request(
                endpoint: Endpoints.selectAccounts,
                method: "POST",
                body: request
            )

            await MainActor.run {
                showAccountSelection = false
                plaidConnectionSuccess = true
                plaidConnectionMessage = "Accounts updated successfully!"
                HapticFeedback.success()

                Task {
                    try? await Task.sleep(nanoseconds: 5_000_000_000)
                    await MainActor.run {
                        plaidConnectionMessage = nil
                    }
                }
            }
        } catch {
            await MainActor.run {
                plaidConnectionSuccess = false
                plaidConnectionMessage = "Failed to update accounts: \(error.localizedDescription)"
                HapticFeedback.error()

                Task {
                    try? await Task.sleep(nanoseconds: 5_000_000_000)
                    await MainActor.run {
                        plaidConnectionMessage = nil
                    }
                }
            }
        }
    }

    private func deleteAccount() {
        isDeletingAccount = true

        Task {
            do {
                let _: [String: Bool] = try await apiClient.request(
                    endpoint: Endpoints.deleteAccount,
                    method: "DELETE"
                )

                await MainActor.run {
                    isDeletingAccount = false
                    HapticFeedback.success()
                    authManager.logout()
                }
            } catch {
                await MainActor.run {
                    isDeletingAccount = false
                    saveError = "Failed to delete account: \(error.localizedDescription)"
                    HapticFeedback.error()
                }
            }
        }
    }
}

#Preview {
    SettingsView()
}



