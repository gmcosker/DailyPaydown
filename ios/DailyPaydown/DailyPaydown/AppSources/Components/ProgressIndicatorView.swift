import SwiftUI

/// Progress indicator for onboarding steps
struct ProgressIndicatorView: View {
    let currentStep: Int
    let totalSteps: Int
    
    var body: some View {
        VStack(spacing: 8) {
            // Step text
            Text("Step \(currentStep) of \(totalSteps)")
                .font(.caption)
                .foregroundColor(.secondary)
            
            // Progress bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Background
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color(.systemGray5))
                        .frame(height: 4)
                    
                    // Progress
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.accentColor)
                        .frame(width: geometry.size.width * CGFloat(currentStep) / CGFloat(totalSteps), height: 4)
                        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: currentStep)
                }
            }
            .frame(height: 4)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }
}

/// Segmented progress indicator with circles
struct SegmentedProgressIndicator: View {
    let currentStep: Int
    let totalSteps: Int
    
    var body: some View {
        HStack(spacing: 12) {
            ForEach(1...totalSteps, id: \.self) { step in
                Circle()
                    .fill(step <= currentStep ? Color.accentColor : Color(.systemGray4))
                    .frame(width: 10, height: 10)
                    .scaleEffect(step == currentStep ? 1.2 : 1.0)
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: currentStep)
            }
        }
        .padding(.vertical, 8)
    }
}

#Preview {
    VStack(spacing: 30) {
        ProgressIndicatorView(currentStep: 1, totalSteps: 3)
        ProgressIndicatorView(currentStep: 2, totalSteps: 3)
        ProgressIndicatorView(currentStep: 3, totalSteps: 3)
        
        Divider()
        
        SegmentedProgressIndicator(currentStep: 1, totalSteps: 3)
        SegmentedProgressIndicator(currentStep: 2, totalSteps: 3)
        SegmentedProgressIndicator(currentStep: 3, totalSteps: 3)
    }
    .padding()
}


