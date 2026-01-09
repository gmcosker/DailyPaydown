import SwiftUI

/// Reusable skeleton loading component with shimmer effect
struct SkeletonView: View {
    let width: CGFloat?
    let height: CGFloat
    let cornerRadius: CGFloat
    
    @State private var isAnimating = false
    
    init(width: CGFloat? = nil, height: CGFloat = 20, cornerRadius: CGFloat = 8) {
        self.width = width
        self.height = height
        self.cornerRadius = cornerRadius
    }
    
    var body: some View {
        Rectangle()
            .fill(
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color(.systemGray5),
                        Color(.systemGray4),
                        Color(.systemGray5)
                    ]),
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .frame(width: width, height: height)
            .cornerRadius(cornerRadius)
            .overlay(
                Rectangle()
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color.clear,
                                Color.white.opacity(0.3),
                                Color.clear
                            ]),
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .rotationEffect(.degrees(-30))
                    .offset(x: isAnimating ? 200 : -200)
            )
            .onAppear {
                withAnimation(
                    Animation.linear(duration: 1.5)
                        .repeatForever(autoreverses: false)
                ) {
                    isAnimating = true
                }
            }
    }
}

/// Skeleton for transaction rows
struct TransactionSkeletonRow: View {
    var body: some View {
        HStack(spacing: 12) {
            // Icon placeholder
            Circle()
                .fill(Color(.systemGray5))
                .frame(width: 40, height: 40)
            
            VStack(alignment: .leading, spacing: 8) {
                SkeletonView(width: 150, height: 16)
                SkeletonView(width: 80, height: 12)
            }
            
            Spacer()
            
            SkeletonView(width: 80, height: 16)
        }
        .padding(.vertical, 8)
    }
}

/// Skeleton for amount display
struct AmountSkeletonView: View {
    var body: some View {
        VStack(spacing: 12) {
            SkeletonView(width: 200, height: 48, cornerRadius: 12)
            SkeletonView(width: 120, height: 12)
        }
    }
}

/// Skeleton for cash coverage card
struct CashCoverageSkeletonView: View {
    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color(.systemGray5))
                .frame(width: 24, height: 24)
            
            SkeletonView(width: nil, height: 16)
            Spacer()
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

#Preview {
    VStack(spacing: 20) {
        AmountSkeletonView()
        CashCoverageSkeletonView()
        TransactionSkeletonRow()
        TransactionSkeletonRow()
        TransactionSkeletonRow()
    }
    .padding()
}


