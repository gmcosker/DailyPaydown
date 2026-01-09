import SwiftUI

struct AccountSelectionView: View {
    let accounts: [Account]
    @Binding var selectedCreditAccountId: String?
    @Binding var selectedCheckingAccountId: String?
    let onContinue: () -> Void
    let onAddAnotherBank: () -> Void
    
    private var creditAccounts: [Account] {
        accounts.filter { account in
            account.type.lowercased() == "credit" || 
            account.subtype?.lowercased().contains("credit") == true
        }
    }
    
    private var checkingAccounts: [Account] {
        accounts.filter { account in
            account.type.lowercased() == "depository" && 
            (account.subtype?.lowercased() == "checking" || account.subtype?.lowercased() == "checking")
        }
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if creditAccounts.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("You didn't connect a credit card here")
                                .font(.headline)
                            Text("Add another bank?")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            Button("Add Another Bank") {
                                onAddAnotherBank()
                            }
                            .buttonStyle(.bordered)
                        }
                        .padding(.vertical, 8)
                    } else {
                        Picker("Credit Card to Track", selection: $selectedCreditAccountId) {
                            Text("Select a credit card").tag(nil as String?)
                            ForEach(creditAccounts, id: \.accountId) { account in
                                Text(accountDisplayName(account)).tag(account.accountId as String?)
                            }
                        }
                    }
                } header: {
                    Text("Credit Card")
                } footer: {
                    Text("Select the credit card account you want to track daily spending for.")
                }
                
                Section {
                    if checkingAccounts.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("You didn't connect a checking account here")
                                .font(.headline)
                            Text("Add another bank?")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            Button("Add Another Bank") {
                                onAddAnotherBank()
                            }
                            .buttonStyle(.bordered)
                        }
                        .padding(.vertical, 8)
                    } else {
                        Picker("Checking Account", selection: $selectedCheckingAccountId) {
                            Text("Select a checking account").tag(nil as String?)
                            ForEach(checkingAccounts, id: \.accountId) { account in
                                Text(accountDisplayName(account)).tag(account.accountId as String?)
                            }
                        }
                    }
                } header: {
                    Text("Checking Account")
                } footer: {
                    Text("Select the checking account to compare available cash against your spending.")
                }
                
                Section {
                    Button("Continue") {
                        onContinue()
                    }
                    .disabled(selectedCreditAccountId == nil)
                }
            }
            .navigationTitle("Select Accounts")
        }
    }
    
    private func accountDisplayName(_ account: Account) -> String {
        var name = account.name
        if let mask = account.mask {
            name += " •••• \(mask)"
        }
        return name
    }
}

#Preview {
    AccountSelectionView(
        accounts: [
            Account(accountId: "1", name: "Chase Sapphire", type: "credit", subtype: "credit card", mask: "1234"),
            Account(accountId: "2", name: "Checking", type: "depository", subtype: "checking", mask: "5678")
        ],
        selectedCreditAccountId: .constant(nil),
        selectedCheckingAccountId: .constant(nil),
        onContinue: {},
        onAddAnotherBank: {}
    )
}



