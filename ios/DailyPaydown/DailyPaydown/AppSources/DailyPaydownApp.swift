import SwiftUI
import UserNotifications
import UIKit

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
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    init() {
        // Set up notification delegate
        UNUserNotificationCenter.current().delegate = NotificationManager.shared
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

