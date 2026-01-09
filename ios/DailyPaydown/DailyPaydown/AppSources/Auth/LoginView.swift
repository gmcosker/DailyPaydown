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
                                .fontWeight(.semibold)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isLoading || email.isEmpty || password.isEmpty)
                    .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
                    .simultaneousGesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { _ in
                                if !isLoading && !email.isEmpty && !password.isEmpty {
                                    HapticFeedback.light()
                                }
                            }
                    )
                }
                .padding(.horizontal, 32)
                
                Button("Don't have an account? Sign up") {
                    HapticFeedback.light()
                    showRegister = true
                }
                .foregroundColor(.blue)
                .simultaneousGesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { _ in
                            HapticFeedback.light()
                        }
                )
                
                Spacer()
            }
            .navigationDestination(isPresented: $showRegister) {
                RegisterView()
            }
        }
    }
    
    private func handleLogin() {
        HapticFeedback.medium()
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                try await authManager.login(email: email, password: password)
                HapticFeedback.success()
            } catch {
                errorMessage = error.localizedDescription
                HapticFeedback.error()
                
                // Shake animation on error
                withAnimation(.spring(response: 0.1, dampingFraction: 0.2).repeatCount(3, autoreverses: true)) {
                    // Trigger view update for shake effect
                }
            }
            isLoading = false
        }
    }
}

#Preview {
    LoginView()
}



