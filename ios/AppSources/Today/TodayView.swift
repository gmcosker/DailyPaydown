import SwiftUI

struct TodayView: View {
    @StateObject private var authManager = AuthManager.shared
    @State private var summary: TodaySummary?
    @State private var transactions: [Transaction] = []
    @State private var isLoading = false
    @State private var isRefreshing = false
    @State private var markedPaid = false
    @State private var snoozeUntil: Date?
    @State private var showTransactions = false
    
    private let apiClient = APIClient.shared
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Today's total
                    VStack(spacing: 8) {
                        Text("Today's Card Spend")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        
                        Text(formatCurrency(summary?.totalAmount ?? 0))
                            .font(.system(size: 48, weight: .bold))
                        
                        if let lastUpdated = summary?.lastUpdated {
                            Text("Last updated: \(formatTime(lastUpdated))")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.top, 32)
                    
                    // Cash coverage
                    if let checkingAvailable = summary?.checkingAvailable,
                       let totalAmount = summary?.totalAmount {
                        HStack {
                            Image(systemName: checkingAvailable >= totalAmount ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                                .foregroundColor(checkingAvailable >= totalAmount ? .green : .orange)
                            Text(checkingAvailable >= totalAmount 
                                 ? "You have enough cash to cover today."
                                 : "You may not have enough cash to cover today.")
                            Spacer()
                        }
                        .padding()
                        .background(Color(.systemGray6))
                        .cornerRadius(8)
                    }
                    
                    // Mark as paid
                    if markedPaid || summary?.markedPaid == true {
                        Text("You marked as paid.")
                            .font(.subheadline)
                            .foregroundColor(.green)
                    } else {
                        Button(action: markAsPaid) {
                            Text("Mark as Paid")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    
                    // Snooze button
                    if let snoozeUntil = snoozeUntil, snoozeUntil > Date() {
                        Text("Reminder snoozed until \(formatTime(snoozeUntil))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    } else {
                        Button("Remind me later") {
                            snoozeUntil = Date().addingTimeInterval(3600) // 1 hour
                        }
                        .buttonStyle(.bordered)
                    }
                    
                    // Transactions
                    VStack(alignment: .leading, spacing: 12) {
                        Button(action: {
                            withAnimation {
                                showTransactions.toggle()
                            }
                        }) {
                            HStack {
                                Text("Transactions (\(summary?.transactionCount ?? 0))")
                                    .font(.headline)
                                Spacer()
                                Image(systemName: showTransactions ? "chevron.up" : "chevron.down")
                            }
                        }
                        .buttonStyle(.plain)
                        
                        if showTransactions {
                            ForEach(transactions, id: \.id) { transaction in
                                TransactionRow(transaction: transaction)
                            }
                            
                            if transactions.isEmpty {
                                Text("No transactions today")
                                    .foregroundColor(.secondary)
                                    .padding()
                            }
                        }
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                    
                    // Footer
                    Text("Some purchases may finalize tomorrow (tips/holds).")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .padding()
            }
            .navigationTitle("Today")
            .refreshable {
                await refreshData()
            }
            .task {
                await loadData()
            }
        }
    }
    
    private func loadData() async {
        isLoading = true
        await refreshData()
        isLoading = false
    }
    
    private func refreshData() async {
        isRefreshing = true
        
        do {
            let summaryResponse: TodaySummary = try await apiClient.request(endpoint: Endpoints.today)
            summary = summaryResponse
            markedPaid = summaryResponse.markedPaid
            
            let transactionsResponse: TodayTransactionsResponse = try await apiClient.request(
                endpoint: Endpoints.todayTransactions
            )
            transactions = transactionsResponse.transactions
        } catch {
            print("Error loading today data: \(error)")
        }
        
        isRefreshing = false
    }
    
    private func markAsPaid() {
        Task {
            do {
                let _: MarkPaidResponse = try await apiClient.request(
                    endpoint: Endpoints.markPaid,
                    method: "POST",
                    body: MarkPaidRequest(date: nil)
                )
                markedPaid = true
                summary?.markedPaid = true
            } catch {
                print("Error marking as paid: \(error)")
            }
        }
    }
    
    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: amount)) ?? "$0.00"
    }
    
    private func formatTime(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        if let date = formatter.date(from: dateString) {
            let timeFormatter = DateFormatter()
            timeFormatter.timeStyle = .short
            return timeFormatter.string(from: date)
        }
        
        // Fallback: try without fractional seconds
        formatter.formatOptions = [.withInternetDateTime]
        if let date = formatter.date(from: dateString) {
            let timeFormatter = DateFormatter()
            timeFormatter.timeStyle = .short
            return timeFormatter.string(from: date)
        }
        
        return dateString
    }
}

struct TransactionRow: View {
    let transaction: Transaction
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(transaction.name)
                    .font(.body)
                if transaction.pending {
                    Text("Pending")
                        .font(.caption)
                        .foregroundColor(.orange)
                } else {
                    Text("Posted")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            Text(formatCurrency(transaction.amount))
                .font(.body)
                .fontWeight(.medium)
        }
        .padding(.vertical, 4)
    }
    
    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: amount)) ?? "$0.00"
    }
}

#Preview {
    TodayView()
}



