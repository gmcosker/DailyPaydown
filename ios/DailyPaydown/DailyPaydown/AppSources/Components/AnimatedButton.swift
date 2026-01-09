import SwiftUI

/// Button with haptic feedback and press animation
struct AnimatedButton<Label: View>: View {
    let action: () -> Void
    let label: () -> Label
    let style: ButtonStyle
    let hapticStyle: HapticStyle
    
    @State private var isPressed = false
    @State private var isDisabled = false
    
    enum ButtonStyle {
        case primary
        case secondary
        case plain
    }
    
    enum HapticStyle {
        case light
        case medium
        case heavy
        case success
        case error
        case none
    }
    
    init(
        action: @escaping () -> Void,
        style: ButtonStyle = .primary,
        hapticStyle: HapticStyle = .medium,
        @ViewBuilder label: @escaping () -> Label
    ) {
        self.action = action
        self.style = style
        self.hapticStyle = hapticStyle
        self.label = label
    }
    
    var body: some View {
        Button(action: {
            triggerHaptic()
            action()
        }) {
            label()
                .scaleEffect(isPressed ? 0.95 : 1.0)
                .opacity(isDisabled ? 0.6 : 1.0)
        }
        .buttonStyle(PlainButtonStyle())
        .background(buttonBackground)
        .cornerRadius(style == .primary ? 10 : 8)
        .shadow(color: style == .primary ? Color.black.opacity(0.1) : .clear, radius: 4, x: 0, y: 2)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    if !isPressed {
                        withAnimation(.easeInOut(duration: 0.1)) {
                            isPressed = true
                        }
                    }
                }
                .onEnded { _ in
                    withAnimation(.easeInOut(duration: 0.1)) {
                        isPressed = false
                    }
                }
        )
    }
    
    @ViewBuilder
    private var buttonBackground: some View {
        switch style {
        case .primary:
            Color.accentColor
        case .secondary:
            Color(.systemGray5)
        case .plain:
            Color.clear
        }
    }
    
    private func triggerHaptic() {
        switch hapticStyle {
        case .light:
            HapticFeedback.light()
        case .medium:
            HapticFeedback.medium()
        case .heavy:
            HapticFeedback.heavy()
        case .success:
            HapticFeedback.success()
        case .error:
            HapticFeedback.error()
        case .none:
            break
        }
    }
}

/// Convenience extension for standard button styles with haptics
extension View {
    func animatedButton(
        style: AnimatedButton<Text>.ButtonStyle = .primary,
        hapticStyle: AnimatedButton<Text>.HapticStyle = .medium
    ) -> some View {
        self.modifier(AnimatedButtonModifier(style: style, hapticStyle: hapticStyle))
    }
}

struct AnimatedButtonModifier: ViewModifier {
    let style: AnimatedButton<Text>.ButtonStyle
    let hapticStyle: AnimatedButton<Text>.HapticStyle
    
    @State private var isPressed = false
    
    func body(content: Content) -> some View {
        content
            .scaleEffect(isPressed ? 0.95 : 1.0)
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        if !isPressed {
                            withAnimation(.easeInOut(duration: 0.1)) {
                                isPressed = true
                            }
                            triggerHaptic()
                        }
                    }
                    .onEnded { _ in
                        withAnimation(.easeInOut(duration: 0.1)) {
                            isPressed = false
                        }
                    }
            )
    }
    
    private func triggerHaptic() {
        switch hapticStyle {
        case .light:
            HapticFeedback.light()
        case .medium:
            HapticFeedback.medium()
        case .heavy:
            HapticFeedback.heavy()
        case .success:
            HapticFeedback.success()
        case .error:
            HapticFeedback.error()
        case .none:
            break
        }
    }
}


