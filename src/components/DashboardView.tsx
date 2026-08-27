import React, { useState } from 'react';
import { 
  TrendingUp, 
  CreditCard, 
  Landmark, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Users2, 
  UserCheck, 
  Plus, 
  Receipt, 
  Calendar,
  ChevronRight,
  PiggyBank,
  Coins
} from 'lucide-react';
import { Account, Friend, Group, LoanEMI, Transaction, UserProfile } from '../types';

interface DashboardViewProps {
  user: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  loans: LoanEMI[];
  groups: Group[];
  friends: Friend[];
  onOpenAddExpense: () => void;
  onOpenAddAccount: () => void;
  onOpenPayEMI: (emi: LoanEMI) => void;
  onOpenShareAccount: (account: Account) => void;
  onOpenPayCreditCard: (account: Account) => void;
  onSelectGroup: (groupId: string) => void;
  onSelectFriend: (friendId: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  accounts,
  transactions,
  loans,
  groups,
  friends,
  onOpenAddExpense,
  onOpenAddAccount,
  onOpenPayEMI,
  onOpenShareAccount,
  onOpenPayCreditCard,
  onSelectGroup,
  onSelectFriend,
  onNavigateTab,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Calculations
  const bankAccounts = accounts.filter(a => a.type === 'bank' || a.type === 'cash');
  const creditCards = accounts.filter(a => a.type === 'credit_card');

  const totalBankBalance = bankAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalCreditCardDue = creditCards.reduce((sum, a) => sum + (a.dueAmount || 0), 0);
  const totalLoanPrincipal = loans.filter(l => l.status === 'active').reduce((sum, l) => sum + l.remainingPrincipal, 0);
  
  // Splitwise Net Friends Balance
  const totalOwedToMe = friends.reduce((sum, f) => f.netBalance > 0 ? sum + f.netBalance : sum, 0);
  const totalIOwe = friends.reduce((sum, f) => f.netBalance < 0 ? sum + Math.abs(f.netBalance) : sum, 0);
  const netSplitwiseBalance = totalOwedToMe - totalIOwe;

  // Net Worth = Total Bank Cash + Money Owed To Me - (Credit Card Dues + Loan Principals + Money I Owe)
  const totalDebts = totalCreditCardDue + totalLoanPrincipal + totalIOwe;
  const netWorth = (totalBankBalance + totalOwedToMe) - totalDebts;

  // Filtered transactions
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (tx.notes && tx.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;
    if (filterType === 'all') return true;
    return tx.type === filterType;
  }).slice(0, 8);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Net Worth */}
        <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-700">Total Net Worth</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-extrabold tracking-tight privacy-value ${netWorth >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
              {user.currency}{netWorth.toLocaleString()}
            </div>
            <p className="text-xs text-slate-600 mt-1">Assets minus all card dues & loans</p>
          </div>
        </div>

        {/* 2. Bank & Cash Assets */}
        <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-700">Total Bank Balance</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-emerald-700 tracking-tight privacy-value">
              {user.currency}{totalBankBalance.toLocaleString()}
            </div>
            <p className="text-xs text-slate-600 mt-1">Across {bankAccounts.length} liquid accounts</p>
          </div>
        </div>

        {/* 3. Total Debts & Liabilities */}
        <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-700">Total Debts & Dues</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-rose-700 tracking-tight privacy-value">
              {user.currency}{totalDebts.toLocaleString()}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Cards: <span className="privacy-value">{user.currency}{totalCreditCardDue.toLocaleString()}</span> • Loans: <span className="privacy-value">{user.currency}{totalLoanPrincipal.toLocaleString()}</span>
            </p>
          </div>
        </div>

        {/* 4. Splitwise Net Balance */}
        <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-700">Splitwise Balance</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-extrabold tracking-tight privacy-value ${netSplitwiseBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {netSplitwiseBalance >= 0 ? `+${user.currency}${netSplitwiseBalance.toLocaleString()}` : `-${user.currency}${Math.abs(netSplitwiseBalance).toLocaleString()}`}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {netSplitwiseBalance >= 0 ? (
                <>Friends owe you <span className="privacy-value">{user.currency}{totalOwedToMe.toLocaleString()}</span></>
              ) : (
                <>You owe <span className="privacy-value">{user.currency}{totalIOwe.toLocaleString()}</span></>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Accounts & Cards Pill Grid */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {accounts.map((acc) => {
            const isCreditCard = acc.type === 'credit_card';
            const isCash = acc.type === 'cash';

            let displayAmount = '';
            if (isCreditCard) {
              const due = acc.dueAmount !== undefined ? acc.dueAmount : (acc.balance < 0 ? Math.abs(acc.balance) : 0);
              if (due > 0) {
                displayAmount = `-${user.currency}${due.toLocaleString()}`;
              } else {
                displayAmount = `${user.currency}0`;
              }
            } else {
              if (acc.balance < 0) {
                displayAmount = `-${user.currency}${Math.abs(acc.balance).toLocaleString()}`;
              } else {
                displayAmount = `${user.currency}${acc.balance.toLocaleString()}`;
              }
            }

            const bgColor = acc.color || (isCreditCard ? '#0F172A' : isCash ? '#16A34A' : '#005596');

            return (
              <div
                key={acc.id}
                onClick={() => {
                  if (isCreditCard) onOpenPayCreditCard(acc);
                  else onOpenShareAccount(acc);
                }}
                style={{ backgroundColor: bgColor }}
                className="group rounded-xl px-4 py-3 text-white flex items-center gap-3 shadow-sm hover:brightness-110 hover:shadow-md transition cursor-pointer relative overflow-hidden select-none min-h-[64px]"
                title={`${acc.name}: ${displayAmount}`}
              >
                {/* Left Icon */}
                <div className="flex-shrink-0 text-white">
                  {isCreditCard ? (
                    <CreditCard className="w-6 h-6" />
                  ) : isCash ? (
                    <Coins className="w-6 h-6" />
                  ) : (
                    <PiggyBank className="w-6 h-6" />
                  )}
                </div>

                {/* Account Details */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs sm:text-sm text-white truncate leading-tight">
                    {acc.name}
                  </div>
                  <div className="font-semibold text-xs sm:text-sm text-white/95 truncate leading-tight mt-0.5 privacy-value">
                    {displayAmount}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add Account Pill Button */}
          <button
            onClick={onOpenAddAccount}
            id="btn-dash-add-account-pill"
            className="rounded-xl px-4 py-3 border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-slate-500 hover:text-blue-600 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold transition cursor-pointer min-h-[64px] bg-slate-50/40"
          >
            <Plus className="w-4 h-4" />
            <span>+Add Account</span>
          </button>
        </div>
      </div>

      {/* Active Loans & EMI Tracker Row */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-indigo-600" />
              Active Loans & EMI Schedule
            </h2>
            <p className="text-xs text-slate-600">Linked to your bank accounts for automatic deduction tracking</p>
          </div>
          <button
            onClick={() => onNavigateTab('loans')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
          >
            Manage Loans <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loans.map((loan) => {
              const progressPercent = Math.round((loan.paidTenureMonths / loan.totalTenureMonths) * 100);

              return (
                <div 
                  key={loan.id}
                  className="group p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {loan.category}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 mt-1">{loan.name}</h3>
                        <p className="text-xs text-slate-600">{loan.lender}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-600 block">Monthly EMI</span>
                        <span className="font-extrabold text-sm text-slate-900 privacy-value">
                          {user.currency}{loan.monthlyEMI.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-slate-600 mb-1">
                        <span>{loan.paidTenureMonths} of {loan.totalTenureMonths} EMIs Paid</span>
                        <span className="font-semibold text-slate-700">{progressPercent}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 rounded-full transition-all"
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                    <div className="text-slate-700">
                      <span>Remaining: </span>
                      <span className="font-bold text-slate-800 privacy-value">{user.currency}{loan.remainingPrincipal.toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => onOpenPayEMI(loan)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition cursor-pointer"
                    >
                      Pay EMI
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
            <Landmark className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs text-slate-600 mb-3">No active loans or EMI repayment plans linked.</p>
            <button
              onClick={() => onNavigateTab('loans')}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              Add Loan / EMI
            </button>
          </div>
        )}
      </div>

      {/* Friends & Groups Quick Glance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Splitwise Groups */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users2 className="w-4 h-4 text-emerald-600" />
                Active Splitwise Groups
              </h2>
              <p className="text-xs text-slate-600">Track group spending and activity logs</p>
            </div>
            <button
              onClick={() => onNavigateTab('groups')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              View Groups <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {groups.length > 0 ? (
              groups.map((grp) => (
                <div
                  key={grp.id}
                  onClick={() => onSelectGroup(grp.id)}
                  className="group p-4 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30 transition cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                      style={{ backgroundColor: grp.avatarColor }}
                    >
                      {grp.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-slate-900">{grp.name}</h3>
                      <p className="text-xs text-slate-600">
                        {grp.members.length} members • {grp.category}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                      Open Group
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
                <Users2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-600 mb-3">No expense splitting groups created yet.</p>
                <button
                  onClick={() => onNavigateTab('groups')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  Create Split Group
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Friends & Balances */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                Friends & Direct Balances
              </h2>
              <p className="text-xs text-slate-600">Who owes you money and who you owe</p>
            </div>
            <button
              onClick={() => onNavigateTab('friends')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              All Friends <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {friends.length > 0 ? (
              friends.slice(0, 4).map((friend) => (
                <div
                  key={friend.id}
                  onClick={() => onSelectFriend(friend.id)}
                  className="group p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm"
                      style={{ backgroundColor: friend.avatarColor }}
                    >
                      {friend.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-slate-900">{friend.name}</h3>
                      <p className="text-xs text-slate-600">{friend.email}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    {friend.netBalance > 0 ? (
                      <div>
                        <span className="text-[11px] text-emerald-800 font-medium block">owes you</span>
                        <span className="font-bold text-sm text-emerald-800 privacy-value">
                          {user.currency}{friend.netBalance.toLocaleString()}
                        </span>
                      </div>
                    ) : friend.netBalance < 0 ? (
                      <div>
                        <span className="text-[11px] text-rose-800 font-medium block">you owe</span>
                        <span className="font-bold text-sm text-rose-800 privacy-value">
                          {user.currency}{Math.abs(friend.netBalance).toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600 font-medium">Settled up</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
                <UserCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-600 mb-3">No friends or individual balances logged yet.</p>
                <button
                  onClick={() => onNavigateTab('friends')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  Add Friend
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions Section */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-600" />
              Recent Transactions
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigateTab('calendar')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-600" />
              <span>Calendar</span>
            </button>

            <button
              onClick={() => onNavigateTab('transactions')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Filters */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {['all', 'expense', 'income', 'emi_payment'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg capitalize transition cursor-pointer ${
                    filterType === type 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type === 'emi_payment' ? 'EMI' : type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Transaction Table / List */}
        {filteredTransactions.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredTransactions.map((tx) => {
              const acc = accounts.find(a => a.id === tx.accountId);
              const isExpense = tx.type === 'expense' || tx.type === 'emi_payment';

              return (
                <div key={tx.id} className="group py-3.5 flex items-center justify-between hover:bg-slate-50/60 px-2 rounded-xl transition">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      tx.type === 'income' 
                        ? 'bg-emerald-100 text-emerald-600' 
                        : tx.type === 'emi_payment'
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {tx.type === 'income' ? (
                        <ArrowDownLeft className="w-5 h-5" />
                      ) : tx.type === 'emi_payment' ? (
                        <Landmark className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900">{tx.title}</span>
                        {tx.groupId && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                            Group Split
                          </span>
                        )}
                        {tx.emiId && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-medium">
                            Loan EMI
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600">
                        {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {acc ? acc.name : 'Default Account'}
                        {tx.notes ? ` • ${tx.notes}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`font-extrabold text-sm privacy-value ${isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {isExpense ? '-' : '+'}{user.currency}{tx.amount.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
            <Receipt className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs text-slate-600 mb-3">No transactions found matching your selection.</p>
            <button
              onClick={onOpenAddExpense}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              Record First Expense
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
