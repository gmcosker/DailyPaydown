import SwiftUI
import LinkKit

struct PlaidLinkView: View {
    let onSuccess: (String, String) -> Void // publicToken, itemId
    @State private var linkController: PLKLinkViewController?
    @State private var isPresented = false
    
    var body: some View {
        VStack {
            Text("Connect Your Bank")
                .font(.largeTitle)
                .fontWeight(.bold)
                .padding()
            
            Text("We'll securely connect to your bank to track your credit card spending.")
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            
            Spacer()
            
            Button("Connect Bank Account") {
                Task {
                    await startPlaidLink()
                }
            }
            .buttonStyle(.borderedProminent)
            .padding()
        }
        .sheet(isPresented: $isPresented) {
            if let linkController = linkController {
                PlaidLinkViewControllerWrapper(controller: linkController)
            }
        }
    }
    
    private func startPlaidLink() async {
        do {
            let response: CreateLinkTokenResponse = try await APIClient.shared.request(
                endpoint: Endpoints.createLinkToken,
                method: "POST"
            )
            
            let linkConfiguration = PLKConfiguration(
                linkToken: response.linkToken
            ) { result in
                switch result {
                case .success(let success):
                    if let publicToken = success.publicToken,
                       let metadata = success.metadata,
                       let itemId = metadata.itemId {
                        onSuccess(publicToken, itemId)
                        
                        // Exchange public token
                        Task {
                            await exchangePublicToken(publicToken: publicToken)
                        }
                    }
                case .failure(let error):
                    print("Plaid Link error: \(error)")
                }
            }
            
            linkController = PLKLinkViewController(
                linkToken: response.linkToken,
                delegate: linkConfiguration
            )
            
            isPresented = true
        } catch {
            print("Error starting Plaid Link: \(error)")
        }
    }
    
    private func exchangePublicToken(publicToken: String) async {
        do {
            let request = ExchangePublicTokenRequest(publicToken: publicToken)
            let _: ExchangePublicTokenResponse = try await APIClient.shared.request(
                endpoint: Endpoints.exchangePublicToken,
                method: "POST",
                body: request
            )
        } catch {
            print("Error exchanging public token: \(error)")
        }
    }
}

// Wrapper to present PLKLinkViewController in SwiftUI
struct PlaidLinkViewControllerWrapper: UIViewControllerRepresentable {
    let controller: PLKLinkViewController
    
    func makeUIViewController(context: Context) -> PLKLinkViewController {
        return controller
    }
    
    func updateUIViewController(_ uiViewController: PLKLinkViewController, context: Context) {}
}

#Preview {
    PlaidLinkView { token, itemId in
        print("Success: \(token), \(itemId)")
    }
}



