import SwiftUI

struct HistoryView: View {
    @State private var days: [HistoryDay] = []
    @State private var isLoading = false
    
    private let apiClient = APIClient.shared
    
    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView()
                } else if days.isEmpty {
                    Text("No history yet")
                        .foregroundColor(.secondary)
                } else {
                    List(days, id: \.date) { day in
                        HistoryRow(day: day)
                    }
                }
            }
            .navigationTitle("History")
            .task {
                await loadHistory()
            }
        }
    }
    
    private func loadHistory() async {
        isLoading = true
        do {
            let response: HistoryResponse = try await apiClient.request(endpoint: Endpoints.history)
            days = response.days
        } catch {
            print("Error loading history: \(error)")
        }
        isLoading = false
    }
}

struct HistoryRow: View {
    let day: HistoryDay
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(formatDate(day.date))
                    .font(.headline)
                Text("\(day.transactionCount) transaction\(day.transactionCount == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 4) {
                Text(formatCurrency(day.totalAmount))
                    .font(.body)
                    .fontWeight(.medium)
                if day.markedPaid {
                    Text("Paid")
                        .font(.caption)
                        .foregroundColor(.green)
                }
            }
        }
    }
    
    private func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        if let date = formatter.date(from: dateString) {
            let dateFormatter = DateFormatter()
            dateFormatter.dateStyle = .medium
            dateFormatter.timeStyle = .none
            return dateFormatter.string(from: date)
        }
        
        return dateString
    }
    
    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: amount)) ?? "$0.00"
    }
}

#Preview {
    HistoryView()
}



