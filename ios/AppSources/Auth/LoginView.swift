import SwiftUI

struct LoginView: View {
    @StateObject private var authManager = AuthManager.shared
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showRegister = false
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("DailyPaydown")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .padding(.top, 60)
                
                VStack(spacing: 16) {
                    TextField("Email", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .autocapitalization(.none)
                        .keyboardType(.emailAddress)
                    
                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                    
                    if let errorMessage = errorMessage {
                        Text(errorMessage)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                    
                    Button(action: handleLogin) {
                        if isLoading {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Text("Log In")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isLoading || email.isEmpty || password.isEmpty)
                }
                .padding(.horizontal, 32)
                
                Button("Don't have an account? Sign up") {
                    showRegister = true
                }
                .foregroundColor(.blue)
                
                Spacer()
            }
            .navigationDestination(isPresented: $showRegister) {
                RegisterView()
            }
        }
    }
    
    private func handleLogin() {
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                try await authManager.login(email: email, password: password)
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }
}

#Preview {
    LoginView()
}



