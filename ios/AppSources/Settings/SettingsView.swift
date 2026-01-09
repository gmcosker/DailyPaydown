import SwiftUI

struct SettingsView: View {
    @StateObject private var authManager = AuthManager.shared
    @State private var notificationTime: Date = Date()
    @State private var timezone: String = TimeZone.current.identifier
    @State private var goal: String = "Spend like cash"
    
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
                        // TODO: Implement Plaid reconnection
                    }
                    
                    Button("Change Selected Accounts") {
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
                        // TODO: Implement account deletion
                    }
                }
            }
            .navigationTitle("Settings")
            .onAppear {
                loadSettings()
            }
            .onChange(of: notificationTime) { _ in
                saveSettings()
            }
            .onChange(of: timezone) { _ in
                saveSettings()
            }
            .onChange(of: goal) { _ in
                saveSettings()
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
    }
    
    private func saveSettings() {
        let timeFormatter = DateFormatter()
        timeFormatter.dateFormat = "HH:mm"
        let timeString = timeFormatter.string(from: notificationTime)
        
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
            } catch {
                print("Error saving settings: \(error)")
            }
        }
    }
}

#Preview {
    SettingsView()
}



