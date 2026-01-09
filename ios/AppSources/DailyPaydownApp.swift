import SwiftUI
import UserNotifications

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationManager.shared.didRegisterForRemoteNotifications(deviceToken: deviceToken)
    }
    
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationManager.shared.didFailToRegisterForRemoteNotifications(error: error)
    }
}

@main
struct DailyPaydownApp: App {
    @StateObject private var notificationManager = NotificationManager.shared
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    init() {
        // Set up notification delegate
        UNUserNotificationCenter.current().delegate = notificationManager
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

