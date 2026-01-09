import SwiftUI

struct SettingsSetupView: View {
    @Binding var notificationTime: Date
    @Binding var timezone: String
    @Binding var goal: String
    let onComplete: () -> Void
    
    private let goalOptions = [
        "Spend like cash",
        "Avoid surprise statements",
        "Pay down daily",
        "Build awareness",
        "Other"
    ]
    
    private var timezoneOptions: [String] {
        TimeZone.knownTimeZoneIdentifiers.sorted()
    }
    
    private var detectedTimezone: String {
        TimeZone.current.identifier
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Notification Time", selection: $notificationTime, displayedComponents: .hourAndMinute)
                        .datePickerStyle(.wheel)
                } header: {
                    Text("Daily Reminder")
                } footer: {
                    Text("You'll receive a push notification at this time each day summarizing your spending.")
                }
                
                Section {
                    Picker("Timezone", selection: $timezone) {
                        ForEach(timezoneOptions, id: \.self) { tz in
                            Text(timezoneDisplayName(tz)).tag(tz)
                        }
                    }
                } header: {
                    Text("Timezone")
                } footer: {
                    Text("Detected: \(timezoneDisplayName(detectedTimezone))")
                }
                
                Section {
                    Picker("Goal", selection: $goal) {
                        ForEach(goalOptions, id: \.self) { option in
                            Text(option).tag(option)
                        }
                    }
                } header: {
                    Text("Your Goal")
                } footer: {
                    Text("This helps us understand your motivation. You can change this later.")
                }
                
                Section {
                    Button("Complete Setup") {
                        onComplete()
                    }
                    .buttonStyle(.borderedProminent)
                    .fontWeight(.semibold)
                    .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
                }
            }
            .navigationTitle("Setup")
            .onAppear {
                if timezone.isEmpty {
                    timezone = detectedTimezone
                }
            }
        }
    }
    
    private func timezoneDisplayName(_ identifier: String) -> String {
        let timezone = TimeZone(identifier: identifier)
        let offset = timezone?.secondsFromGMT() ?? 0
        let hours = offset / 3600
        let sign = hours >= 0 ? "+" : ""
        return "\(identifier) (GMT\(sign)\(hours))"
    }
}

#Preview {
    SettingsSetupView(
        notificationTime: .constant(Date()),
        timezone: .constant("America/New_York"),
        goal: .constant("Spend like cash"),
        onComplete: {}
    )
}



