import SwiftUI

struct SettingsView: View {
    @StateObject private var authManager = AuthManager.shared
    @State private var notificationTime: Date = Date()
    @State private var timezone: String = TimeZone.current.identifier
    @State private var goal: String = "Spend like cash"
    @State private var showSaveSuccess = false
    @State private var saveError: String?
    @State private var hasLoadedSettings = false
    
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
                        HapticFeedback.light()
                        // TODO: Implement Plaid reconnection
                    }
                    
                    Button("Change Selected Accounts") {
                        HapticFeedback.light()
                        // TODO: Implement account selection change
                    }
                } header: {
                    Text("Bank Connection")
                }
                
                Section {
                    Link("Privacy Policy", destination: URL(string: "https://dailypaydown.com/privacy")!)
                }
                
                Section {
                    Button("Delete Account", role: .destructive) {
                        HapticFeedback.heavy()
                        // TODO: Implement account deletion
                    }
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
            .onChange(of: notificationTime) {
                if hasLoadedSettings {
                    saveSettings()
                }
            }
            .onChange(of: timezone) {
                if hasLoadedSettings {
                    saveSettings()
                }
            }
            .onChange(of: goal) {
                if hasLoadedSettings {
                    saveSettings()
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
}

#Preview {
    SettingsView()
}



