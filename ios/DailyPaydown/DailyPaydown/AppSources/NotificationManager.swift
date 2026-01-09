import Foundation
import UserNotifications
import UIKit

class NotificationManager: NSObject {
    static let shared = NotificationManager()
    
    private let apiClient = APIClient.shared
    
    override init() {
        super.init()
        requestAuthorization()
    }
    
    func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if granted {
                DispatchQueue.main.async {
                    self.registerForRemoteNotifications()
                }
            } else if let error = error {
                print("Notification authorization error: \(error)")
            }
        }
    }
    
    func registerForRemoteNotifications() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            if settings.authorizationStatus == .authorized {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
    }
    
    @MainActor
    func didRegisterForRemoteNotifications(deviceToken: Data) {
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        sendTokenToBackend(token: tokenString)
    }
    
    @MainActor
    func didFailToRegisterForRemoteNotifications(error: Error) {
        print("Failed to register for remote notifications: \(error)")
    }
    
    private func sendTokenToBackend(token: String) {
        Task {
            do {
                let request = RegisterDeviceRequest(apnsToken: token)
                let _: [String: Bool] = try await apiClient.request(
                    endpoint: Endpoints.registerDevice,
                    method: "POST",
                    body: request
                )
                print("Device token registered successfully")
            } catch {
                print("Error registering device token: \(error)")
            }
        }
    }
    
    func handleNotificationTap(userInfo: [AnyHashable: Any]) {
        // Notification tap opens the app to Today screen
        // The app's navigation will handle this automatically
        NotificationCenter.default.post(name: NSNotification.Name("OpenTodayScreen"), object: nil)
    }
}

extension NotificationManager: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show notification even when app is in foreground
        completionHandler([.banner, .sound, .badge])
    }
    
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        handleNotificationTap(userInfo: response.notification.request.content.userInfo)
        completionHandler()
    }
}



