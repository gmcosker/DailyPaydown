import SwiftUI

struct HistoryView: View {
    @State private var days: [HistoryDay] = []
    @State private var isLoading = false
    
    private let apiClient = APIClient.shared
    
    var body: some View {
        NavigationStack {
            Group {
                if isLoading && days.isEmpty {
                    // Skeleton loading
                    ScrollView {
                        VStack(spacing: 0) {
                            ForEach(0..<5) { index in
                                HistorySkeletonRow()
                                    .padding(.horizontal)
                                    .padding(.vertical, 12)
                                    .opacity(1.0 - (Double(index) * 0.1))
                                Divider()
                            }
                            
                            // Disclaimer skeleton
                            VStack(spacing: 8) {
                                SkeletonView(width: nil, height: 12, cornerRadius: 4)
                                SkeletonView(width: nil, height: 12, cornerRadius: 4)
                            }
                            .padding(.vertical, 24)
                            .frame(maxWidth: .infinity)
                            .background(Color(.systemGray6))
                        }
                    }
                } else if days.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "clock.badge.questionmark")
                            .font(.system(size: 48))
                            .foregroundColor(.secondary)
                            .opacity(0.5)
                        Text("No history yet")
                            .font(.headline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .transition(.opacity)
                } else {
                    ScrollView {
                        VStack(spacing: 0) {
                            ForEach(Array(days.enumerated()), id: \.element.date) { index, day in
                                HistoryRow(day: day)
                                    .padding(.horizontal)
                                    .padding(.vertical, 12)
                                    .transition(.opacity.combined(with: .move(edge: .top)))
                                    .animation(
                                        .spring(response: 0.4, dampingFraction: 0.8)
                                        .delay(Double(index) * 0.05),
                                        value: days.count
                                    )
                                
                                if index < days.count - 1 {
                                    Divider()
                                }
                            }
                            
                            // Disclaimer
                            VStack(spacing: 8) {
                                Text("This is a personal habit tracker. Check your account balances to verify.")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal, 24)
                                
                                Text("If you've been tracking DailyPaydown for a while, don't forget about any preexisting credit card debt from before you started tracking.")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal, 24)
                            }
                            .padding(.vertical, 24)
                            .frame(maxWidth: .infinity)
                            .background(Color(.systemGray6))
                            .transition(.opacity)
                        }
                    }
                }
            }
            .navigationTitle("History")
            .task {
                await loadHistory()
            }
            .refreshable {
                HapticFeedback.light()
                await loadHistory()
            }
            .onAppear {
                Task {
                    await loadHistory()
                }
            }
        }
    }
    
    private func loadHistory() async {
        isLoading = true
        do {
            let response: HistoryResponse = try await apiClient.request(endpoint: Endpoints.history)
            print("[History] Loaded \(response.days.count) days from server")
            
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                days = response.days
            }
            
            if days.isEmpty {
                print("[History] Warning: Server returned empty days array")
            }
        } catch {
            print("[History] Error loading history: \(error.localizedDescription)")
            print("[History] Error details: \(error)")
            HapticFeedback.error()
        }
        
        withAnimation {
            isLoading = false
        }
    }
}

struct HistoryRow: View {
    let day: HistoryDay
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(formatDate(day.date))
                    .font(.headline)
                    .fontWeight(.semibold)
                Text("\(day.transactionCount) transaction\(day.transactionCount == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 4) {
                Text(formatCurrency(day.totalAmount))
                    .font(.body)
                    .fontWeight(.semibold)
                
                if day.markedPaid {
                    HStack(spacing: 4) {
                        Text("DailyPaydown")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.green)
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundColor(.green)
                    }
                    .transition(.scale.combined(with: .opacity))
                }
            }
        }
    }
    
    private func formatDate(_ dateString: String) -> String {
        // Try with fractional seconds first
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        if let date = formatter.date(from: dateString) {
            let dateFormatter = DateFormatter()
            dateFormatter.dateStyle = .medium
            dateFormatter.timeStyle = .none
            return dateFormatter.string(from: date)
        }
        
        // Try without fractional seconds
        let formatter2 = ISO8601DateFormatter()
        formatter2.formatOptions = [.withInternetDateTime]
        if let date = formatter2.date(from: dateString) {
            let dateFormatter = DateFormatter()
            dateFormatter.dateStyle = .medium
            dateFormatter.timeStyle = .none
            return dateFormatter.string(from: date)
        }
        
        // Fallback: try basic date parsing
        let fallbackFormatter = DateFormatter()
        fallbackFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
        if let date = fallbackFormatter.date(from: dateString) {
            let dateFormatter = DateFormatter()
            dateFormatter.dateStyle = .medium
            dateFormatter.timeStyle = .none
            return dateFormatter.string(from: date)
        }
        
        // Last resort: return the original string
        print("[History] Warning: Could not parse date string: \(dateString)")
        return dateString
    }
    
    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: amount)) ?? "$0.00"
    }
}

struct HistorySkeletonRow: View {
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 8) {
                SkeletonView(width: 120, height: 18)
                SkeletonView(width: 80, height: 12)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 8) {
                SkeletonView(width: 60, height: 16)
                SkeletonView(width: 90, height: 12)
            }
        }
    }
}

#Preview {
    HistoryView()
}



