import React, { useState, useMemo } from 'react';
import { 
  Receipt, 
  Plus, 
  Search, 
  Filter, 
  X, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Landmark, 
  CreditCard, 
  Users2, 
  UserCheck, 
  Calendar, 
  Download, 
  SlidersHorizontal, 
  Trash2, 
  Edit3, 
  Eye, 
  RotateCcw, 
  Check, 
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  Sparkles,
  DollarSign
} from 'lucide-react';
import { Account, Category, Group, LoanEMI, SplitMemberShare, Transaction, UserProfile } from '../types';

interface TransactionsViewProps {
  user: UserProfile;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  loans: LoanEMI[];
  groups: Group[];
  onOpenAddExpense: () => void;
  onOpenCalendar?: () => void;
  onEditTransaction: (txId: string, updatedData: Partial<Transaction>) => void;
  onDeleteTransaction: (txId: string) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  user,
  transactions,
  accounts,
  categories,
  loans,
  groups,
  onOpenAddExpense,
  onOpenCalendar,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedLoan, setSelectedLoan] = useState<string>('all');
  
  // Date Filters
  const [datePreset, setDatePreset] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Amount Filters
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  // Sort State
  const [sortBy, setSortBy] = useState<string>('date-desc');

  // UI state
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [selectedTxDetail, setSelectedTxDetail] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);

  // Edit Modal Form State
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState<Transaction['type']>('expense');
  const [editAccountId, setEditAccountId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Open Edit Modal
  const handleOpenEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setEditTitle(tx.title);
    setEditAmount(String(tx.amount));
    setEditDate(tx.date);
    setEditType(tx.type);
    setEditAccountId(tx.accountId);
    setEditCategoryId(tx.categoryId || 'cat-1');
    setEditNotes(tx.notes || '');
  };

  // Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !editTitle || !editAmount) return;

    onEditTransaction(editingTx.id, {
      title: editTitle,
      amount: Number(editAmount),
      date: editDate,
      type: editType,
      accountId: editAccountId,
      categoryId: editCategoryId,
      notes: editNotes,
      updatedAt: new Date().toISOString(),
    });

    setEditingTx(null);
  };

  // Helper date calculators
  const getPresetDateRange = (preset: string) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'today') {
      return { from: todayStr, to: todayStr };
    }
    if (preset === 'week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(d.setDate(diff)).toISOString().split('T')[0];
      return { from: startOfWeek, to: todayStr };
    }
    if (preset === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      return { from: startOfMonth, to: todayStr };
    }
    if (preset === 'last_month') {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      return { from: startOfLastMonth, to: endOfLastMonth };
    }
    if (preset === 'year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      return { from: startOfYear, to: todayStr };
    }
    return { from: '', to: '' };
  };

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    if (preset === 'custom' || preset === 'all') {
      if (preset === 'all') {
        setStartDate('');
        setEndDate('');
      }
    } else {
      const range = getPresetDateRange(preset);
      setStartDate(range.from);
      setEndDate(range.to);
    }
  };

  // Clear All Filters
  const handleClearAllFilters = () => {
    setSearchTerm('');
    setSelectedType('all');
    setSelectedCategory('all');
    setSelectedAccount('all');
    setSelectedGroup('all');
    setSelectedLoan('all');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setSortBy('date-desc');
  };

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (selectedType !== 'all') count++;
    if (selectedCategory !== 'all') count++;
    if (selectedAccount !== 'all') count++;
    if (selectedGroup !== 'all') count++;
    if (selectedLoan !== 'all') count++;
    if (datePreset !== 'all' || startDate || endDate) count++;
    if (minAmount || maxAmount) count++;
    if (sortBy !== 'date-desc') count++;
    return count;
  }, [searchTerm, selectedType, selectedCategory, selectedAccount, selectedGroup, selectedLoan, datePreset, startDate, endDate, minAmount, maxAmount, sortBy]);

  // Main Filtering Logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // 1. Search text
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const acc = accounts.find(a => a.id === tx.accountId);
        const cat = categories.find(c => c.id === tx.categoryId);
        const grp = groups.find(g => g.id === tx.groupId);

        const matchTitle = tx.title.toLowerCase().includes(query);
        const matchNotes = tx.notes ? tx.notes.toLowerCase().includes(query) : false;
        const matchAcc = acc ? acc.name.toLowerCase().includes(query) || (acc.bankName && acc.bankName.toLowerCase().includes(query)) : false;
        const matchCat = cat ? cat.name.toLowerCase().includes(query) : false;
        const matchGrp = grp ? grp.name.toLowerCase().includes(query) : false;
        const matchPayer = tx.paidByMemberId ? true : false;

        if (!matchTitle && !matchNotes && !matchAcc && !matchCat && !matchGrp && !matchPayer) {
          return false;
        }
      }

      // 2. Type filter
      if (selectedType !== 'all') {
        if (tx.type !== selectedType) return false;
      }

      // 3. Category filter
      if (selectedCategory !== 'all') {
        if (tx.categoryId !== selectedCategory) return false;
      }

      // 4. Account filter
      if (selectedAccount !== 'all') {
        if (selectedAccount === 'type_bank') {
          const acc = accounts.find(a => a.id === tx.accountId);
          if (acc?.type !== 'bank' && acc?.type !== 'cash') return false;
        } else if (selectedAccount === 'type_card') {
          const acc = accounts.find(a => a.id === tx.accountId);
          if (acc?.type !== 'credit_card') return false;
        } else {
          if (tx.accountId !== selectedAccount) return false;
        }
      }

      // 5. Group filter
      if (selectedGroup !== 'all') {
        if (selectedGroup === 'only_groups') {
          if (!tx.groupId) return false;
        } else if (selectedGroup === 'no_groups') {
          if (tx.groupId) return false;
        } else {
          if (tx.groupId !== selectedGroup) return false;
        }
      }

      // 6. Loan / EMI filter
      if (selectedLoan !== 'all') {
        if (selectedLoan === 'only_emi') {
          if (!tx.emiId && tx.type !== 'emi_payment') return false;
        } else if (selectedLoan === 'no_emi') {
          if (tx.emiId || tx.type === 'emi_payment') return false;
        } else {
          if (tx.emiId !== selectedLoan) return false;
        }
      }

      // 7. Date range filter
      if (startDate) {
        if (tx.date < startDate) return false;
      }
      if (endDate) {
        if (tx.date > endDate) return false;
      }

      // 8. Amount range filter
      if (minAmount && !isNaN(Number(minAmount))) {
        if (tx.amount < Number(minAmount)) return false;
      }
      if (maxAmount && !isNaN(Number(maxAmount))) {
        if (tx.amount > Number(maxAmount)) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'date-desc') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (sortBy === 'date-asc') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (sortBy === 'amount-desc') {
        return b.amount - a.amount;
      }
      if (sortBy === 'amount-asc') {
        return a.amount - b.amount;
      }
      if (sortBy === 'title-asc') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
  }, [transactions, searchTerm, selectedType, selectedCategory, selectedAccount, selectedGroup, selectedLoan, startDate, endDate, minAmount, maxAmount, sortBy, accounts, categories, groups]);

  // Filtered totals
  const totalFilteredOutflow = filteredTransactions
    .filter(t => t.type === 'expense' || t.type === 'emi_payment' || (t.type === 'settlement' && t.notes?.includes('Paid to')))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalFilteredInflow = filteredTransactions
    .filter(t => t.type === 'income' || (t.type === 'settlement' && t.notes?.includes('Received from')))
    .reduce((sum, t) => sum + t.amount, 0);

  const netFilteredAmount = totalFilteredInflow - totalFilteredOutflow;

  // Export CSV Handler
  const handleExportCSV = () => {
    const headers = ['ID', 'Date', 'Title', 'Amount', 'Type', 'Account', 'Category', 'Group', 'EMI', 'Notes'];
    const rows = filteredTransactions.map(t => {
      const acc = accounts.find(a => a.id === t.accountId);
      const cat = categories.find(c => c.id === t.categoryId);
      const grp = groups.find(g => g.id === t.groupId);
      const emi = loans.find(l => l.id === t.emiId);

      return [
        t.id,
        t.date,
        `"${t.title.replace(/"/g, '""')}"`,
        t.amount,
        t.type,
        `"${(acc?.name || '').replace(/"/g, '""')}"`,
        `"${(cat?.name || '').replace(/"/g, '""')}"`,
        `"${(grp?.name || '').replace(/"/g, '""')}"`,
        `"${(emi?.name || '').replace(/"/g, '""')}"`,
        `"${(t.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `transactions_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Transactions Ledger
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          {onOpenCalendar && (
            <button
              onClick={onOpenCalendar}
              id="btn-switch-to-calendar"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition shadow-xs"
              title="Open monthly cashflow calendar"
            >
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Calendar View</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            id="btn-export-transactions-csv"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition shadow-xs"
            title="Download CSV of filtered results"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filtered Financial Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="group bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:shadow-sm transition">
          <span className="text-[11px] font-bold uppercase text-slate-600">Total Filtered Count</span>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">
            {filteredTransactions.length} <span className="text-xs font-normal text-slate-700">/ {transactions.length}</span>
          </div>
        </div>

        <div className="group bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:shadow-sm transition">
          <span className="text-[11px] font-bold uppercase text-slate-600">Filtered Outflow</span>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5 privacy-value">
            {user.currency}{totalFilteredOutflow.toLocaleString()}
          </div>
        </div>

        <div className="group bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:shadow-sm transition">
          <span className="text-[11px] font-bold uppercase text-slate-600">Filtered Inflow</span>
          <div className="text-xl font-extrabold text-emerald-700 mt-0.5 privacy-value">
            {user.currency}{totalFilteredInflow.toLocaleString()}
          </div>
        </div>

        <div className="group bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:shadow-sm transition">
          <span className="text-[11px] font-bold uppercase text-slate-600">Net Balance</span>
          <div className={`text-xl font-extrabold mt-0.5 privacy-value ${netFilteredAmount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {netFilteredAmount >= 0 ? '+' : ''}{user.currency}{netFilteredAmount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Primary Filter Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
        {/* Row 1: Search, Type, Category, Advanced Toggle, Reset */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, notes, account..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="emi_payment">Loan EMI Repayment</option>
              <option value="transfer">Account Transfer</option>
              <option value="settlement">Split / Settlement</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Advanced Filter Toggle & Reset */}
          <div className="md:col-span-2 flex items-center justify-end gap-2">
            <button
              onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border ${
                isAdvancedFiltersOpen || activeFiltersCount > 0
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {activeFiltersCount > 0 && (
              <button
                onClick={handleClearAllFilters}
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Advanced Filters Tray */}
        {isAdvancedFiltersOpen && (
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
            {/* Account Selector */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Account / Card</label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
              >
                <option value="all">All Accounts & Cards</option>
                <option value="type_bank">Bank & Cash Accounts</option>
                <option value="type_card">Credit Cards Only</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type === 'credit_card' ? 'Credit Card' : 'Bank'})
                  </option>
                ))}
              </select>
            </div>

            {/* Splitwise / Group Filter */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Group / Splitwise</label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
              >
                <option value="all">All Records</option>
                <option value="only_groups">Group Splits Only</option>
                <option value="no_groups">Personal / Non-Group Only</option>
                {groups.map(grp => (
                  <option key={grp.id} value={grp.id}>
                    {grp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Loans & EMI Filter */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Loans & EMIs</label>
              <select
                value={selectedLoan}
                onChange={(e) => setSelectedLoan(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
              >
                <option value="all">All Transactions</option>
                <option value="only_emi">Loan EMIs Only</option>
                <option value="no_emi">Non-EMI Only</option>
                {loans.map(loan => (
                  <option key={loan.id} value={loan.id}>
                    {loan.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Sort Order</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
              >
                <option value="date-desc">Date: Newest First</option>
                <option value="date-asc">Date: Oldest First</option>
                <option value="amount-desc">Amount: High to Low</option>
                <option value="amount-asc">Amount: Low to High</option>
                <option value="title-asc">Title: A to Z</option>
              </select>
            </div>

            {/* Date Range Presets & Custom Pickers */}
            <div className="sm:col-span-2 space-y-2">
              <label className="block text-[11px] font-bold uppercase text-slate-600">Date Range</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'All Time' },
                  { id: 'today', label: 'Today' },
                  { id: 'week', label: 'This Week' },
                  { id: 'month', label: 'This Month' },
                  { id: 'last_month', label: 'Last Month' },
                  { id: 'year', label: 'This Year' },
                  { id: 'custom', label: 'Custom' },
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleDatePresetChange(p.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      datePreset === p.id 
                        ? 'bg-slate-900 text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Range Inputs */}
              {(datePreset === 'custom' || startDate || endDate) && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-600 block">From:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setDatePreset('custom');
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-600 block">To:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setDatePreset('custom');
                      }}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Amount Range Filter */}
            <div className="sm:col-span-2 space-y-2">
              <label className="block text-[11px] font-bold uppercase text-slate-600">Amount Range ({user.currency})</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="number"
                    placeholder="Min amount"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Max amount"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {[
                  { label: '< 500', min: '', max: '500' },
                  { label: '500 - 2k', min: '500', max: '2000' },
                  { label: '2k - 10k', min: '2000', max: '10000' },
                  { label: '10k+', min: '10000', max: '' },
                ].map(tier => (
                  <button
                    key={tier.label}
                    type="button"
                    onClick={() => {
                      setMinAmount(tier.min);
                      setMaxAmount(tier.max);
                    }}
                    className="px-2 py-0.5 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active Filter Chips */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] text-slate-600 font-bold uppercase mr-1">Active:</span>

            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                Search: "{searchTerm}"
                <button onClick={() => setSearchTerm('')}><X className="w-3 h-3 hover:text-blue-900" /></button>
              </span>
            )}

            {selectedType !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                Type: {selectedType.replace('_', ' ')}
                <button onClick={() => setSelectedType('all')}><X className="w-3 h-3 hover:text-blue-900" /></button>
              </span>
            )}

            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                Cat: {categories.find(c => c.id === selectedCategory)?.name || selectedCategory}
                <button onClick={() => setSelectedCategory('all')}><X className="w-3 h-3 hover:text-blue-900" /></button>
              </span>
            )}

            {selectedAccount !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                Acc: {accounts.find(a => a.id === selectedAccount)?.name || selectedAccount}
                <button onClick={() => setSelectedAccount('all')}><X className="w-3 h-3 hover:text-blue-900" /></button>
              </span>
            )}

            {selectedGroup !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                Group: {groups.find(g => g.id === selectedGroup)?.name || selectedGroup}
                <button onClick={() => setSelectedGroup('all')}><X className="w-3 h-3 hover:text-blue-900" /></button>
              </span>
            )}

            {selectedLoan !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                Loan: {loans.find(l => l.id === selectedLoan)?.name || selectedLoan}
                <button onClick={() => setSelectedLoan('all')}><X className="w-3 h-3 hover:text-blue-900" /></button>
              </span>
            )}

            {(startDate || endDate) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                Date: {startDate || 'Start'} to {endDate || 'End'}
                <button onClick={() => { setStartDate(''); setEndDate(''); setDatePreset('all'); }}>
                  <X className="w-3 h-3 hover:text-blue-900" />
                </button>
              </span>
            )}

            {(minAmount || maxAmount) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                Amount: {minAmount || '0'} - {maxAmount || '∞'}
                <button onClick={() => { setMinAmount(''); setMaxAmount(''); }}>
                  <X className="w-3 h-3 hover:text-blue-900" />
                </button>
              </span>
            )}

            <button
              onClick={handleClearAllFilters}
              className="text-xs font-semibold text-rose-600 hover:underline ml-auto"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Main Transactions List / Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredTransactions.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredTransactions.map((tx) => {
              const acc = accounts.find(a => a.id === tx.accountId);
              const cat = categories.find(c => c.id === tx.categoryId);
              const grp = groups.find(g => g.id === tx.groupId);
              const emi = loans.find(l => l.id === tx.emiId);
              const isExpense = tx.type === 'expense' || tx.type === 'emi_payment' || (tx.type === 'settlement' && tx.notes?.includes('Paid to'));

              return (
                <div
                  key={tx.id}
                  className="group p-4 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  {/* Left Column: Icon + Title + Tags */}
                  <div className="flex items-start sm:items-center space-x-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      tx.type === 'income' 
                        ? 'bg-emerald-100 text-emerald-600' 
                        : tx.type === 'emi_payment'
                        ? 'bg-indigo-100 text-indigo-600'
                        : tx.type === 'transfer'
                        ? 'bg-blue-100 text-blue-600'
                        : tx.type === 'settlement'
                        ? 'bg-purple-100 text-purple-600'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {tx.type === 'income' ? (
                        <ArrowDownLeft className="w-5 h-5" />
                      ) : tx.type === 'emi_payment' ? (
                        <Landmark className="w-5 h-5" />
                      ) : tx.type === 'transfer' ? (
                        <ArrowRightLeft className="w-5 h-5" />
                      ) : tx.type === 'settlement' ? (
                        <UserCheck className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-sm text-slate-900 truncate">{tx.title}</span>
                        
                        {/* Category Badge */}
                        {cat && (
                          <span 
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-slate-700"
                            style={{ backgroundColor: `${cat.color}15`, borderColor: `${cat.color}40` }}
                          >
                            {cat.name}
                          </span>
                        )}

                        {/* Group Badge */}
                        {grp && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-medium">
                            {grp.name}
                          </span>
                        )}

                        {/* Loan EMI Badge */}
                        {emi && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full font-medium">
                            {emi.name}
                          </span>
                        )}
                      </div>

                      {/* Subtitle Info */}
                      <p className="text-xs text-slate-700 mt-0.5">
                        <span>{new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <span className="mx-1.5">•</span>
                        <span className="font-medium text-slate-800">{acc ? acc.name : 'Primary Account'}</span>
                        {tx.notes && (
                          <>
                            <span className="mx-1.5">•</span>
                            <span className="italic text-slate-600">{tx.notes}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Amount + Action Controls */}
                  <div className="flex items-center justify-between sm:justify-end space-x-4 pl-13 sm:pl-0">
                    <div className="text-left sm:text-right">
                      <div className={`font-extrabold text-sm privacy-value ${isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {isExpense ? '-' : '+'}{user.currency}{tx.amount.toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedTxDetail(tx)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleOpenEdit(tx)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        title="Edit transaction"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setDeletingTxId(tx.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Transactions Found</h3>
            <p className="text-xs text-slate-700 max-w-sm mx-auto mt-1 mb-6">
              {activeFiltersCount > 0 
                ? 'Try adjusting or clearing your filters to see more results.'
                : 'Start tracking expenses, income deposits, or split bills.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              {activeFiltersCount > 0 && (
                <button
                  onClick={handleClearAllFilters}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Clear All Filters
                </button>
              )}
              <button
                onClick={onOpenAddExpense}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                Add Transaction
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Edit Transaction */}
      {editingTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Edit Transaction</h2>
              <button onClick={() => setEditingTx(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Amount ({user.currency})</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Type</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as Transaction['type'])}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="emi_payment">Loan EMI</option>
                    <option value="transfer">Transfer</option>
                    <option value="settlement">Settlement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Account</label>
                  <select
                    value={editAccountId}
                    onChange={(e) => setEditAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Category</label>
                <select
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Notes</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional memo"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: View Transaction Details */}
      {selectedTxDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Transaction Details</h2>
              <button onClick={() => setSelectedTxDetail(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-600 block">Total Amount</span>
                  <span className={`text-2xl font-extrabold ${(selectedTxDetail.type === 'expense' || selectedTxDetail.type === 'emi_payment' || (selectedTxDetail.type === 'settlement' && selectedTxDetail.notes?.includes('Paid to'))) ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {(selectedTxDetail.type === 'expense' || selectedTxDetail.type === 'emi_payment' || (selectedTxDetail.type === 'settlement' && selectedTxDetail.notes?.includes('Paid to'))) ? '-' : '+'}{user.currency}{selectedTxDetail.amount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Title:</span>
                  <span className="font-bold text-slate-900">{selectedTxDetail.title}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Date:</span>
                  <span className="font-semibold text-slate-800">{selectedTxDetail.date}</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Account:</span>
                  <span className="font-semibold text-slate-800">
                    {accounts.find(a => a.id === selectedTxDetail.accountId)?.name || 'Default Account'}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Category:</span>
                  <span className="font-semibold text-slate-800">
                    {categories.find(c => c.id === selectedTxDetail.categoryId)?.name || 'General'}
                  </span>
                </div>

                {selectedTxDetail.groupId && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Split Group:</span>
                    <span className="font-semibold text-emerald-700">
                      {groups.find(g => g.id === selectedTxDetail.groupId)?.name}
                    </span>
                  </div>
                )}

                {selectedTxDetail.emiId && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">Linked Loan:</span>
                    <span className="font-semibold text-indigo-700">
                      {loans.find(l => l.id === selectedTxDetail.emiId)?.name}
                    </span>
                  </div>
                )}

                {selectedTxDetail.notes && (
                  <div className="py-1">
                    <span className="text-slate-600 block mb-1">Notes:</span>
                    <p className="p-2.5 bg-slate-50 rounded-xl text-slate-800">{selectedTxDetail.notes}</p>
                  </div>
                )}

                {selectedTxDetail.splitDetails && selectedTxDetail.splitDetails.length > 0 && (
                  <div className="pt-2">
                    <span className="text-slate-600 font-bold uppercase text-[10px] block mb-2">Split Breakdown</span>
                    <div className="space-y-1.5">
                      {selectedTxDetail.splitDetails.map((split) => (
                        <div key={split.memberId} className="flex justify-between items-center p-2 rounded-lg bg-slate-50">
                          <span className={split.isSelected ? 'font-medium text-slate-900' : 'line-through text-slate-400'}>
                            {split.memberName}
                          </span>
                          <span className="font-bold text-slate-800">
                            {user.currency}{split.shareAmount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setSelectedTxDetail(null)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Delete Confirmation */}
      {deletingTxId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Delete Transaction?</h3>
            <p className="text-xs text-slate-700 mt-1 mb-6">
              Are you sure you want to delete this record? This action will permanently remove it from your ledger.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeletingTxId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteTransaction(deletingTxId);
                  setDeletingTxId(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
