import React, { useState, useMemo } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  BarChart, 
  Bar, 
  CartesianGrid, 
  XAxis, 
  YAxis 
} from 'recharts';
import { 
  BarChart3, 
  PieChart as PieIcon, 
  TrendingUp, 
  Calendar, 
  Landmark, 
  CreditCard, 
  Users2, 
  DollarSign,
  Layers,
  Table as TableIcon,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Account, Category, Friend, Group, LoanEMI, Transaction, UserProfile } from '../types';

interface ReportsViewProps {
  user: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  loans: LoanEMI[];
  groups: Group[];
  friends: Friend[];
  categories: Category[];
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#EF4444', '#64748B'];

export const ReportsView: React.FC<ReportsViewProps> = ({
  user,
  accounts,
  transactions,
  loans,
  groups,
  friends,
  categories,
}) => {
  const [activeTableTab, setActiveTableTab] = useState<'categories' | 'accounts' | 'loans' | 'friends' | 'groups' | 'transactions'>('categories');
  const [txSearchTerm, setTxSearchTerm] = useState('');
  const [txCategoryFilter, setTxCategoryFilter] = useState('all');
  const [txTypeFilter, setTxTypeFilter] = useState('all');

  // Calculations
  const expenseTransactions = transactions.filter(t => t.type === 'expense' || t.type === 'emi_payment');
  const incomeTransactions = transactions.filter(t => t.type === 'income');
  
  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  const totalMonthlyEMI = loans.filter(l => l.status === 'active').reduce((sum, l) => sum + l.monthlyEMI, 0);
  const totalLoanPrincipalRemaining = loans.filter(l => l.status === 'active').reduce((sum, l) => sum + l.remainingPrincipal, 0);
  const totalCreditCardDue = accounts.filter(a => a.type === 'credit_card').reduce((sum, a) => sum + (a.dueAmount || 0), 0);
  const totalBankBalance = accounts.filter(a => a.type === 'bank' || a.type === 'cash').reduce((sum, a) => sum + a.balance, 0);

  // 1. Category Stats Breakdown
  const categoryStats = useMemo(() => {
    const map: Record<string, { id: string; name: string; total: number; count: number; color: string }> = {};

    categories.forEach(c => {
      map[c.id] = { id: c.id, name: c.name, total: 0, count: 0, color: c.color };
    });

    expenseTransactions.forEach(t => {
      const catId = t.categoryId || 'cat-1';
      if (!map[catId]) {
        map[catId] = { id: catId, name: t.type === 'emi_payment' ? 'EMI Repayment' : 'Miscellaneous', total: 0, count: 0, color: '#64748B' };
      }
      map[catId].total += t.amount;
      map[catId].count += 1;
    });

    return Object.values(map)
      .filter(item => item.count > 0 || item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [categories, expenseTransactions]);

  const categoryPieData = categoryStats.map((c, i) => ({
    name: c.name,
    value: c.total,
    color: c.color || COLORS[i % COLORS.length],
  }));

  // 2. Filtered Transactions for Ledger Table
  const filteredLedger = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(txSearchTerm.toLowerCase()) ||
                            (t.notes && t.notes.toLowerCase().includes(txSearchTerm.toLowerCase()));
      if (!matchesSearch) return false;

      if (txCategoryFilter !== 'all' && t.categoryId !== txCategoryFilter) return false;
      if (txTypeFilter !== 'all' && t.type !== txTypeFilter) return false;

      return true;
    });
  }, [transactions, txSearchTerm, txCategoryFilter, txTypeFilter]);

  // 3. Dynamic Cash Flow Data derived from actual recorded transactions
  const cashFlowTrendData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIdx = new Date().getMonth();
    
    // Create last 6 months slice
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const mIdx = (currentMonthIdx - i + 12) % 12;
      const monthName = months[mIdx];
      
      const mExpenses = transactions
        .filter(t => {
          const d = new Date(t.date);
          return d.getMonth() === mIdx && (t.type === 'expense' || t.type === 'emi_payment');
        })
        .reduce((sum, t) => sum + t.amount, 0);

      const mIncome = transactions
        .filter(t => {
          const d = new Date(t.date);
          return d.getMonth() === mIdx && t.type === 'income';
        })
        .reduce((sum, t) => sum + t.amount, 0);

      result.push({
        month: monthName,
        Income: mIncome,
        Expenses: mExpenses,
      });
    }
    return result;
  }, [transactions]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Financial Analytics & Reports
          </h1>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <span className="text-xs font-bold uppercase text-slate-700">Total Recorded Outflow</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1 privacy-value">
            {user.currency}{totalExpenses.toLocaleString()}
          </div>
          <p className="text-xs text-slate-600 mt-1">{expenseTransactions.length} expenses logged</p>
        </div>

        <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <span className="text-xs font-bold uppercase text-slate-700">Total Recorded Inflow</span>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1 privacy-value">
            {user.currency}{totalIncome.toLocaleString()}
          </div>
          <p className="text-xs text-slate-600 mt-1">{incomeTransactions.length} income deposits</p>
        </div>

        <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <span className="text-xs font-bold uppercase text-slate-700">Active Monthly EMI</span>
          <div className="text-2xl font-extrabold text-rose-700 mt-1 privacy-value">
            {user.currency}{totalMonthlyEMI.toLocaleString()}
          </div>
          <p className="text-xs text-slate-600 mt-1">{loans.filter(l => l.status === 'active').length} active loan obligations</p>
        </div>

        <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <span className="text-xs font-bold uppercase text-slate-700">Credit Cards & Debt Due</span>
          <div className="text-2xl font-extrabold text-orange-700 mt-1 privacy-value">
            {user.currency}{(totalCreditCardDue + totalLoanPrincipalRemaining).toLocaleString()}
          </div>
          <p className="text-xs text-slate-600 mt-1">Cards: <span className="privacy-value">{user.currency}{totalCreditCardDue.toLocaleString()}</span> • Loans: <span className="privacy-value">{user.currency}{totalLoanPrincipalRemaining.toLocaleString()}</span></p>
        </div>
      </div>

      {/* Visual Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Pie Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
            <PieIcon className="w-4 h-4 text-blue-600" />
            Spending by Category
          </h3>
          <p className="text-xs text-slate-700 mb-4">Distribution of all outgoing expenses</p>

          {categoryPieData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val: any) => [`${user.currency}${Number(val).toLocaleString()}`, 'Amount']}
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-600 text-xs">
              <PieIcon className="w-8 h-8 text-slate-400 mb-2" />
              <span>No expense records available to graph</span>
            </div>
          )}
        </div>

        {/* Inflow vs Outflow Trend */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Cash Flow Trend (Income vs Outflow)
          </h3>
          <p className="text-xs text-slate-700 mb-4">Monthly comparison of deposits against total spending</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748B" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748B" />
                <Tooltip 
                  formatter={(val: any) => [`${user.currency}${Number(val).toLocaleString()}`, '']}
                  contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Analytics Tables Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Selector Tabs */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none">
            {[
              { id: 'categories', label: 'Category Breakdown', count: categoryStats.length },
              { id: 'accounts', label: 'Accounts', count: accounts.length },
              { id: 'loans', label: 'Loans', count: loans.length },
              { id: 'friends', label: 'Friends', count: friends.length },
              { id: 'groups', label: 'Splitwise', count: groups.length },
              { id: 'transactions', label: 'Complete Ledger', count: transactions.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTableTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                  activeTableTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTableTab === tab.id ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 1. Category Breakdown Table */}
        {activeTableTab === 'categories' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5 text-right">Transactions</th>
                  <th className="p-3.5 text-right">Total Outflow</th>
                  <th className="p-3.5 text-right">Average / Tx</th>
                  <th className="p-3.5 text-right">% of Total Spending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {categoryStats.length > 0 ? (
                  categoryStats.map((cat) => {
                    const percentage = totalExpenses > 0 ? Math.round((cat.total / totalExpenses) * 100) : 0;
                    const avg = cat.count > 0 ? Math.round(cat.total / cat.count) : 0;

                    return (
                      <tr key={cat.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5">
                          <div className="flex items-center space-x-2">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }}></span>
                            <span className="font-bold text-slate-900">{cat.name}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-right font-medium text-slate-700">{cat.count}</td>
                        <td className="p-3.5 text-right font-extrabold text-slate-900">{user.currency}{cat.total.toLocaleString()}</td>
                        <td className="p-3.5 text-right font-medium text-slate-700">{user.currency}{avg.toLocaleString()}</td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-bold text-slate-900">{percentage}%</span>
                            <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${percentage}%` }}></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-600 text-xs">
                      No category expense records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. Accounts & Cards Table */}
        {activeTableTab === 'accounts' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5">Account Name</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Bank / Provider</th>
                  <th className="p-3.5 text-right">Balance / Due</th>
                  <th className="p-3.5 text-right">Credit Limit</th>
                  <th className="p-3.5 text-right">Utilization / Status</th>
                  <th className="p-3.5 text-center">Permissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {accounts.length > 0 ? (
                  accounts.map((acc) => {
                    const isCard = acc.type === 'credit_card';
                    const due = acc.dueAmount || 0;
                    const limit = acc.creditLimit || 0;
                    const utilization = limit > 0 ? Math.round((due / limit) * 100) : 0;

                    return (
                      <tr key={acc.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5">
                          <div className="flex items-center space-x-2">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }}></span>
                            <span className="font-bold text-slate-900">{acc.name}</span>
                            {acc.accountNumberLast4 && (
                              <span className="text-[10px] text-slate-600">•••• {acc.accountNumberLast4}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 capitalize font-medium text-slate-700">{acc.type.replace('_', ' ')}</td>
                        <td className="p-3.5 font-medium text-slate-700">{acc.bankName || '-'}</td>
                        <td className="p-3.5 text-right font-extrabold">
                          {isCard ? (
                            <span className="text-rose-700">{acc.currency}{due.toLocaleString()} (Due)</span>
                          ) : (
                            <span className="text-slate-900">{acc.currency}{acc.balance.toLocaleString()}</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right font-medium text-slate-700">
                          {isCard ? `${acc.currency}${limit.toLocaleString()}` : '-'}
                        </td>
                        <td className="p-3.5 text-right">
                          {isCard ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              utilization > 50 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {utilization}% Limit Used
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                              Liquid Active
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center font-medium text-slate-700">
                          {acc.sharedWith && acc.sharedWith.length > 0 ? (
                            <span className="text-blue-700 font-semibold">{acc.sharedWith.length} shared</span>
                          ) : (
                            <span className="text-slate-600">Private</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-600 text-xs">
                      No accounts or credit cards added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. Loans & EMI Schedule Table */}
        {activeTableTab === 'loans' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5">Loan / EMI Name</th>
                  <th className="p-3.5">Lender</th>
                  <th className="p-3.5 text-right">Monthly EMI</th>
                  <th className="p-3.5 text-right">Total Principal</th>
                  <th className="p-3.5 text-right">Remaining Principal</th>
                  <th className="p-3.5 text-center">Tenure Progress</th>
                  <th className="p-3.5">Next Due Date</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loans.length > 0 ? (
                  loans.map((loan) => {
                    const progress = Math.round((loan.paidTenureMonths / loan.totalTenureMonths) * 100);

                    return (
                      <tr key={loan.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5 font-bold text-slate-900">{loan.name}</td>
                        <td className="p-3.5 text-slate-700">{loan.lender}</td>
                        <td className="p-3.5 text-right font-extrabold text-slate-900">{user.currency}{loan.monthlyEMI.toLocaleString()}</td>
                        <td className="p-3.5 text-right text-slate-700">{user.currency}{loan.totalPrincipal.toLocaleString()}</td>
                        <td className="p-3.5 text-right font-extrabold text-rose-700">{user.currency}{loan.remainingPrincipal.toLocaleString()}</td>
                        <td className="p-3.5 text-center">
                          <span className="font-semibold text-slate-800">{loan.paidTenureMonths}/{loan.totalTenureMonths} Mo ({progress}%)</span>
                        </td>
                        <td className="p-3.5 text-slate-700">{loan.nextDueDate || '-'}</td>
                        <td className="p-3.5 text-center">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold uppercase text-[10px]">
                            {loan.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-600 text-xs">
                      No active loans or EMI schedules configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Friends & Debts Table */}
        {activeTableTab === 'friends' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5">Friend Name</th>
                  <th className="p-3.5">Contact Email</th>
                  <th className="p-3.5">Phone</th>
                  <th className="p-3.5 text-right">Net Debt Position</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {friends.length > 0 ? (
                  friends.map((friend) => (
                    <tr key={friend.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5">
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: friend.avatarColor }}>
                            {friend.name.substring(0, 1).toUpperCase()}
                          </span>
                          <span className="font-bold text-slate-900">{friend.name}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-700">{friend.email}</td>
                      <td className="p-3.5 text-slate-700">{friend.phone || '-'}</td>
                      <td className="p-3.5 text-right font-extrabold">
                        {friend.netBalance > 0 ? (
                          <span className="text-emerald-700">+{user.currency}{friend.netBalance.toLocaleString()} (Owes You)</span>
                        ) : friend.netBalance < 0 ? (
                          <span className="text-rose-700">-{user.currency}{Math.abs(friend.netBalance).toLocaleString()} (You Owe)</span>
                        ) : (
                          <span className="text-slate-600">{user.currency}0</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          friend.netBalance === 0 ? 'bg-slate-100 text-slate-700' : friend.netBalance > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {friend.netBalance === 0 ? 'Settled' : friend.netBalance > 0 ? 'Collect' : 'Pay'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-700">{friend.lastActivity || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-600 text-xs">
                      No friend debt balances recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Groups & Splitwise Table */}
        {activeTableTab === 'groups' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5">Group Name</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5 text-center">Members Count</th>
                  <th className="p-3.5 text-right">Total Group Spend</th>
                  <th className="p-3.5 text-right">Transactions Count</th>
                  <th className="p-3.5">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {groups.length > 0 ? (
                  groups.map((grp) => {
                    const grpTxs = transactions.filter(t => t.groupId === grp.id);
                    const totalSpend = grpTxs.reduce((sum, t) => sum + t.amount, 0);

                    return (
                      <tr key={grp.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5">
                          <div className="flex items-center space-x-2">
                            <span className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: grp.avatarColor }}>
                              {grp.name.substring(0, 1).toUpperCase()}
                            </span>
                            <span className="font-bold text-slate-900">{grp.name}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-700">{grp.category}</td>
                        <td className="p-3.5 text-center font-medium text-slate-700">{grp.members.length} members</td>
                        <td className="p-3.5 text-right font-extrabold text-slate-900">{user.currency}{totalSpend.toLocaleString()}</td>
                        <td className="p-3.5 text-right font-medium text-slate-700">{grpTxs.length}</td>
                        <td className="p-3.5 text-slate-700">{grp.createdAt || '-'}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-600 text-xs">
                      No Splitwise groups created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. Complete Ledger Table */}
        {activeTableTab === 'transactions' && (
          <div>
            {/* Search & Sub-filters */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search ledger by title, notes..."
                  value={txSearchTerm}
                  onChange={(e) => setTxSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={txTypeFilter}
                  onChange={(e) => setTxTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-900"
                >
                  <option value="all">All Types</option>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="emi_payment">EMI Payment</option>
                  <option value="settlement">Settlement</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 z-10">
                  <tr className="border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3">Date</th>
                    <th className="p-3">Title & Notes</th>
                    <th className="p-3">Account</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Link Tag</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredLedger.length > 0 ? (
                    filteredLedger.map((tx) => {
                      const acc = accounts.find(a => a.id === tx.accountId);
                      const cat = categories.find(c => c.id === tx.categoryId);
                      const isOutflow = tx.type === 'expense' || tx.type === 'emi_payment';

                      return (
                        <tr key={tx.id} className="hover:bg-slate-50 transition">
                          <td className="p-3 whitespace-nowrap text-slate-700 font-mono text-[11px]">{tx.date}</td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{tx.title}</span>
                            {tx.notes && <span className="text-[11px] text-slate-600 truncate block max-w-xs">{tx.notes}</span>}
                          </td>
                          <td className="p-3 text-slate-700">{acc ? acc.name : '-'}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-medium">
                              {cat ? cat.name : tx.type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-3">
                            {tx.groupId && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium mr-1">
                                Group Split
                              </span>
                            )}
                            {tx.emiId && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-medium">
                                EMI Linked
                              </span>
                            )}
                            {!tx.groupId && !tx.emiId && <span className="text-slate-600">-</span>}
                          </td>
                          <td className="p-3 text-right font-extrabold whitespace-nowrap">
                            <span className={isOutflow ? 'text-slate-900' : 'text-emerald-700'}>
                              {isOutflow ? '-' : '+'}{user.currency}{tx.amount.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-600 text-xs">
                        No transactions match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
