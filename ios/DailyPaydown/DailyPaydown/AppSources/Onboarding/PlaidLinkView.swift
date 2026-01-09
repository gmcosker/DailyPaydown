import SwiftUI

// TEMPORARY: Stub version without Plaid SDK for preview/testing
// TODO: Add Plaid SDK and restore full functionality
struct PlaidLinkView: View {
    let onSuccess: (String, String) -> Void // publicToken, itemId
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Connect Your Bank")
                .font(.largeTitle)
                .fontWeight(.bold)
                .padding()
            
            Text("We'll securely connect to your bank to track your credit card spending.")
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            
            Spacer()
            
            VStack(spacing: 12) {
                Button("Connect Bank Account") {
                    // Simulate success for preview/testing
                    // In production, this will call the real Plaid Link SDK
                    onSuccess("preview-token", "preview-item-id")
                }
                .buttonStyle(.borderedProminent)
                .padding()
                
                Text("(Plaid SDK not yet configured)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}

#Preview {
    PlaidLinkView { token, itemId in
        print("Success: \(token), \(itemId)")
    }
}



