import Foundation
import Combine

@MainActor
class AuthManager: ObservableObject {
    static let shared = AuthManager()
    
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    
    private let tokenKey = "auth_token"
    private let apiClient = APIClient.shared
    
    private init() {
        loadToken()
    }
    
    func loadToken() {
        if let token = UserDefaults.standard.string(forKey: tokenKey) {
            apiClient.setAuthToken(token)
            Task {
                await fetchCurrentUser()
            }
        }
    }
    
    func saveToken(_ token: String) {
        UserDefaults.standard.set(token, forKey: tokenKey)
        apiClient.setAuthToken(token)
    }
    
    func clearToken() {
        UserDefaults.standard.removeObject(forKey: tokenKey)
        apiClient.setAuthToken(nil)
        isAuthenticated = false
        currentUser = nil
    }
    
    func register(email: String, password: String) async throws {
        let request = RegisterRequest(email: email, password: password)
        let response: AuthResponse = try await apiClient.request(
            endpoint: Endpoints.register,
            method: "POST",
            body: request
        )
        
        saveToken(response.token)
        currentUser = response.user
        isAuthenticated = true
    }
    
    func login(email: String, password: String) async throws {
        let request = LoginRequest(email: email, password: password)
        let response: AuthResponse = try await apiClient.request(
            endpoint: Endpoints.login,
            method: "POST",
            body: request
        )
        
        saveToken(response.token)
        currentUser = response.user
        isAuthenticated = true
    }
    
    func logout() {
        clearToken()
    }
    
    func fetchCurrentUser() async {
        do {
            let user: User = try await apiClient.request(endpoint: Endpoints.me)
            currentUser = user
            isAuthenticated = true
        } catch {
            clearToken()
        }
    }
}



