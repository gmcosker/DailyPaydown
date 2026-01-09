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
    @State private var showMarkedPaidSuccess = false
    @State private var showSaveSuccess = false
    
    private let apiClient = APIClient.shared
    
    var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: true) {
                VStack(spacing: 24) {
                    // Today's total
                    Group {
                        if isLoading && summary == nil {
                            VStack(spacing: 8) {
                                Text("Today's Card Spend")
                                    .font(.headline)
                                    .foregroundColor(.secondary)
                                
                                AmountSkeletonView()
                            }
                            .padding(.top, 32)
                        } else {
                            VStack(spacing: 8) {
                                Text("Today's Card Spend")
                                    .font(.headline)
                                    .foregroundColor(.secondary)
                                
                                Text(formatCurrency(summary?.totalAmount ?? 0))
                                    .font(.system(size: 48, weight: .bold))
                                    .transition(.opacity.combined(with: .scale(scale: 0.95)))
                                
                                if let lastUpdated = summary?.lastUpdated {
                                    Text("Last updated: \(formatTime(lastUpdated))")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                        .transition(.opacity)
                                }
                            }
                            .padding(.top, 32)
                        }
                    }
                    .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isLoading)
                    
                    // Cash coverage
                    Group {
                        if isLoading && summary == nil {
                            CashCoverageSkeletonView()
                        } else if let checkingAvailable = summary?.checkingAvailable,
                                  let totalAmount = summary?.totalAmount {
                            HStack {
                                Image(systemName: checkingAvailable >= totalAmount ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                                    .foregroundColor(checkingAvailable >= totalAmount ? .green : .orange)
                                    .symbolEffect(.pulse, isActive: checkingAvailable < totalAmount && totalAmount > 0)
                                Text(checkingAvailable >= totalAmount 
                                     ? "You have enough cash to cover today."
                                     : "You may not have enough cash to cover today.")
                                Spacer()
                            }
                            .padding()
                            .background(Color(.systemGray6))
                            .cornerRadius(8)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                        }
                    }
                    .animation(.spring(response: 0.4, dampingFraction: 0.8), value: summary?.checkingAvailable)
                    
                    // Mark as paid
                    Group {
                        if markedPaid || summary?.markedPaid == true {
                            HStack(spacing: 8) {
                                if showMarkedPaidSuccess {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.green)
                                        .transition(.scale.combined(with: .opacity))
                                }
                                Text("You marked as paid.")
                                    .font(.subheadline)
                                    .foregroundColor(.green)
                            }
                            .transition(.opacity.combined(with: .scale(scale: 0.9)))
                        } else {
                            Button(action: {
                                HapticFeedback.medium()
                                markAsPaid()
                            }) {
                                Text("Mark as Paid")
                                    .frame(maxWidth: .infinity)
                                    .fontWeight(.semibold)
                            }
                            .buttonStyle(.borderedProminent)
                            .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
                            .simultaneousGesture(
                                DragGesture(minimumDistance: 0)
                                    .onChanged { _ in
                                        HapticFeedback.light()
                                    }
                            )
                            .transition(.opacity.combined(with: .move(edge: .bottom)))
                        }
                    }
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: markedPaid)
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: showMarkedPaidSuccess)
                    
                    // Snooze button
                    if let snoozeUntil = snoozeUntil, snoozeUntil > Date() {
                        Text("Reminder snoozed until \(formatTime(from: snoozeUntil))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .transition(.opacity)
                    } else {
                        Button("Remind me later") {
                            HapticFeedback.light()
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                snoozeUntil = Date().addingTimeInterval(3600) // 1 hour
                            }
                        }
                        .buttonStyle(.bordered)
                        .simultaneousGesture(
                            DragGesture(minimumDistance: 0)
                                .onChanged { _ in
                                    HapticFeedback.light()
                                }
                        )
                    }
                    
                    // Transactions
                    VStack(alignment: .leading, spacing: 12) {
                        Button(action: {
                            HapticFeedback.light()
                            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                                showTransactions.toggle()
                            }
                        }) {
                            HStack {
                                Text("Transactions (\(summary?.transactionCount ?? 0))")
                                    .font(.headline)
                                Spacer()
                                Image(systemName: showTransactions ? "chevron.up" : "chevron.down")
                                    .rotationEffect(.degrees(showTransactions ? 0 : 180))
                                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: showTransactions)
                            }
                        }
                        .buttonStyle(.plain)
                        
                        if showTransactions {
                            if isLoading && transactions.isEmpty {
                                // Skeleton loading
                                VStack(alignment: .leading, spacing: 8) {
                                    ForEach(0..<3) { _ in
                                        TransactionSkeletonRow()
                                    }
                                }
                                .transition(.opacity)
                            } else {
                                VStack(alignment: .leading, spacing: 8) {
                                    ForEach(Array(transactions.enumerated()), id: \.element.id) { index, transaction in
                                        TransactionRow(transaction: transaction)
                                            .id(transaction.id)
                                            .transition(.opacity.combined(with: .move(edge: .top)))
                                            .animation(
                                                .spring(response: 0.4, dampingFraction: 0.8)
                                                .delay(Double(index) * 0.05),
                                                value: transactions.count
                                            )
                                    }
                                    
                                    if transactions.isEmpty {
                                        Text("No transactions today")
                                            .foregroundColor(.secondary)
                                            .padding()
                                            .transition(.opacity)
                                    }
                                }
                                .transition(.asymmetric(
                                    insertion: .opacity.combined(with: .move(edge: .top)),
                                    removal: .opacity
                                ))
                            }
                        }
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .animation(.spring(response: 0.4, dampingFraction: 0.8), value: showTransactions)
                    
                    // Footer
                    Text("Some purchases may finalize tomorrow (tips/holds).")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .padding()
                .padding(.bottom, 100) // Extra padding to account for tab bar and ensure scrolling
            }
            .scrollContentBackground(.hidden)
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
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            isLoading = false
        }
    }
    
    private func refreshData() async {
        isRefreshing = true
        
        do {
            let summaryResponse: TodaySummary = try await apiClient.request(endpoint: Endpoints.today)
            let transactionsResponse: TodayTransactionsResponse = try await apiClient.request(
                endpoint: Endpoints.todayTransactions
            )
            
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                summary = summaryResponse
                markedPaid = summaryResponse.markedPaid
                transactions = transactionsResponse.transactions
            }
            
            // Auto-expand transactions if there are any (after animation completes)
            if !transactionsResponse.transactions.isEmpty {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        showTransactions = true
                    }
                }
            }
        } catch {
            print("Error loading today data: \(error)")
            HapticFeedback.error()
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
                
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    markedPaid = true
                }
                
                // Show success animation
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7).delay(0.1)) {
                    showMarkedPaidSuccess = true
                }
                
                HapticFeedback.success()
                
                // Refresh data to get updated summary from server
                await refreshData()
                
                // Auto-hide success indicator after delay
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                withAnimation {
                    showMarkedPaidSuccess = false
                }
            } catch {
                print("Error marking as paid: \(error)")
                HapticFeedback.error()
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
    
    private func formatTime(from date: Date) -> String {
        let timeFormatter = DateFormatter()
        timeFormatter.timeStyle = .short
        return timeFormatter.string(from: date)
    }
}

struct TransactionRow: View {
    let transaction: Transaction
    @State private var isPulsing = false
    
    var body: some View {
        HStack(spacing: 12) {
            // Transaction icon
            ZStack {
                Circle()
                    .fill(transaction.pending ? Color.orange.opacity(0.2) : Color(.systemGray5))
                    .frame(width: 40, height: 40)
                
                Image(systemName: transaction.pending ? "clock.fill" : "creditcard.fill")
                    .foregroundColor(transaction.pending ? .orange : .secondary)
                    .font(.system(size: 16))
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(transaction.name)
                    .font(.body)
                    .fontWeight(.medium)
                
                HStack(spacing: 4) {
                    if transaction.pending {
                        Circle()
                            .fill(Color.orange)
                            .frame(width: 6, height: 6)
                            .opacity(isPulsing ? 0.3 : 1.0)
                            .animation(
                                Animation.easeInOut(duration: 1.0)
                                    .repeatForever(autoreverses: true),
                                value: isPulsing
                            )
                        
                        Text("Pending")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(.orange)
                    } else {
                        Text("Posted")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            Spacer()
            
            Text(formatCurrency(transaction.amount))
                .font(.body)
                .fontWeight(.semibold)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 4)
        .background(
            transaction.pending
                ? Color.orange.opacity(0.05)
                : Color.clear
        )
        .cornerRadius(8)
        .onAppear {
            if transaction.pending {
                isPulsing = true
            }
        }
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



