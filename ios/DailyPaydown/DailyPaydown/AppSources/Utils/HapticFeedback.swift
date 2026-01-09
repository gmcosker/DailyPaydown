import UIKit

/// Provides haptic feedback for user interactions
struct HapticFeedback {
    /// Light impact for standard buttons
    static func light() {
        #if DEBUG
        print("🔔 Haptic: Light impact")
        #endif
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
    }
    
    /// Medium impact for primary/prominent actions
    static func medium() {
        #if DEBUG
        print("🔔 Haptic: Medium impact")
        #endif
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()
    }
    
    /// Heavy impact for important actions
    static func heavy() {
        #if DEBUG
        print("🔔 Haptic: Heavy impact")
        #endif
        let generator = UIImpactFeedbackGenerator(style: .heavy)
        generator.impactOccurred()
    }
    
    /// Success feedback
    static func success() {
        #if DEBUG
        print("✅ Haptic: Success notification")
        #endif
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }
    
    /// Error feedback
    static func error() {
        #if DEBUG
        print("❌ Haptic: Error notification")
        #endif
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.error)
    }
    
    /// Warning feedback
    static func warning() {
        #if DEBUG
        print("⚠️ Haptic: Warning notification")
        #endif
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.warning)
    }
}


