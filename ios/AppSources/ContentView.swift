import SwiftUI

struct ContentView: View {
    @StateObject private var authManager = AuthManager.shared
    @State private var hasCompletedOnboarding = false
    @State private var selectedTab = 0
    
    var body: some View {
        Group {
            if !authManager.isAuthenticated {
                LoginView()
            } else if !hasCompletedOnboarding {
                OnboardingView()
                    .onAppear {
                        checkOnboardingStatus()
                    }
            } else {
                MainTabView(selectedTab: $selectedTab)
            }
        }
        .onChange(of: authManager.isAuthenticated) { _ in
            checkOnboardingStatus()
        }
        .onReceive(NotificationCenter.default.publisher(for: NSNotification.Name("OpenTodayScreen"))) { _ in
            selectedTab = 0
        }
    }
    
    private func checkOnboardingStatus() {
        // Check if user has completed onboarding (has account selection)
        // For MVP, we'll check if user has settings configured
        if let user = authManager.currentUser,
           user.timezone != nil,
           user.notificationTime != nil {
            hasCompletedOnboarding = true
        } else {
            hasCompletedOnboarding = false
        }
    }
}

struct MainTabView: View {
    @Binding var selectedTab: Int
    
    var body: some View {
        TabView(selection: $selectedTab) {
            TodayView()
                .tabItem {
                    Label("Today", systemImage: "calendar")
                }
                .tag(0)
            
            HistoryView()
                .tabItem {
                    Label("History", systemImage: "clock")
                }
                .tag(1)
            
            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(2)
        }
    }
}

#Preview {
    ContentView()
}

