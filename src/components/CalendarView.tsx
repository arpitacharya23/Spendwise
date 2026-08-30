import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Landmark, 
  ArrowRightLeft, 
  UserCheck, 
  X, 
  Edit3, 
  Trash2, 
  Wallet,
  Clock,
  Check,
  Filter,
  Palette
} from 'lucide-react';
import { Account, Category, Group, LoanEMI, Transaction, UserProfile } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { DayScheduleView } from './DayScheduleView';
import { getAccountAccess, canUserTransactAccount } from '../lib/accountPermissions';

interface CalendarViewProps {
  user: UserProfile;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  loans: LoanEMI[];
  groups: Group[];
  onOpenAddExpense: (prefillDate?: string) => void;
  onOpenCategories?: () => void;
  onEditTransaction: (txId: string, updatedData: Partial<Transaction>) => void;
  onDeleteTransaction: (txId: string) => void;
}

interface DayAggregate {
  income: number;
  expense: number;
  count: number;
  categoryAmounts: Record<string, number>;
  categories: Category[];
  dominantCategory?: Category;
  secondaryCategory?: Category;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  user,
  transactions,
  accounts,
  categories,
  loans,
  groups,
  onOpenAddExpense,
  onOpenCategories,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  // Current calendar month state (0-indexed month)
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()); // 0 = Jan, 11 = Dec
  
  // Selected day state (YYYY-MM-DD)
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [viewMode, setViewMode] = useState<'month' | 'day'>('month');

  // Filters
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Edit transaction modal state
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState<Transaction['type']>('expense');
  const [editAccountId, setEditAccountId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDate(todayStr);
  };

  // Month Name Formatter
  const monthName = useMemo(() => {
    return new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'long' });
  }, [currentYear, currentMonth]);

  // Filtered transactions for the selected account/category
  const scopedTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (selectedAccount !== 'all' && tx.accountId !== selectedAccount) return false;
      if (selectedCategory !== 'all' && tx.categoryId !== selectedCategory) return false;
      return true;
    });
  }, [transactions, selectedAccount, selectedCategory]);

  // Fast map of categoryId -> Category
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  // Aggregate daily income, expense, and category distribution map for fast lookup
  const dailyTotals = useMemo(() => {
    const map: Record<string, DayAggregate> = {};

    scopedTransactions.forEach(tx => {
      // Normalize date string (format YYYY-MM-DD)
      const dateStr = tx.date ? tx.date.split('T')[0] : '';
      if (!dateStr) return;

      if (!map[dateStr]) {
        map[dateStr] = { 
          income: 0, 
          expense: 0, 
          count: 0, 
          categoryAmounts: {}, 
          categories: [] 
        };
      }

      const dayObj = map[dateStr];
      dayObj.count += 1;

      // Track amount per category on this day
      if (tx.categoryId) {
        dayObj.categoryAmounts[tx.categoryId] = (dayObj.categoryAmounts[tx.categoryId] || 0) + tx.amount;
      }

      if (tx.type === 'income' || (tx.type === 'settlement' && tx.notes?.includes('Received from'))) {
        dayObj.income += tx.amount;
      } else if (tx.type === 'expense' || tx.type === 'emi_payment' || (tx.type === 'settlement' && tx.notes?.includes('Paid to'))) {
        dayObj.expense += tx.amount;
      }
    });

    // Resolve dominant and sorted unique categories for each day
    Object.keys(map).forEach(dateKey => {
      const dayObj = map[dateKey];
      const sortedCatIds = Object.keys(dayObj.categoryAmounts).sort(
        (a, b) => dayObj.categoryAmounts[b] - dayObj.categoryAmounts[a]
      );
      
      const resolvedCats: Category[] = [];
      sortedCatIds.forEach(id => {
        const cat = categoryMap.get(id);
        if (cat) resolvedCats.push(cat);
      });

      dayObj.categories = resolvedCats;
      dayObj.dominantCategory = resolvedCats[0];
      dayObj.secondaryCategory = resolvedCats[1];
    });

    return map;
  }, [scopedTransactions, categoryMap]);

  // Monthly aggregated totals for the current displayed month
  const monthlySummary = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let activeDays = 0;

    const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    Object.keys(dailyTotals).forEach(dateStr => {
      const data = dailyTotals[dateStr];
      if (dateStr.startsWith(monthPrefix) && data) {
        totalIncome += data.income;
        totalExpense += data.expense;
        if (data.income > 0 || data.expense > 0) {
          activeDays++;
        }
      }
    });

    const net = totalIncome - totalExpense;
    return { totalIncome, totalExpense, net, activeDays };
  }, [dailyTotals, currentYear, currentMonth]);

  // Build Calendar Grid Days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = lastDayOfMonth.getDate();
    
    const days = [];

    // Previous month padding days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month padding days to complete grid cells
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [currentYear, currentMonth, todayStr]);

  // Transactions for the selected date
  const selectedDateTransactions = useMemo(() => {
    if (!selectedDate) return [];
    return scopedTransactions.filter(tx => (tx.date ? tx.date.split('T')[0] : '') === selectedDate);
  }, [scopedTransactions, selectedDate]);

  const selectedDateSummary = useMemo(() => {
    const data = dailyTotals[selectedDate] || { income: 0, expense: 0, count: 0, categories: [] };
    return {
      ...data,
      net: data.income - data.expense
    };
  }, [dailyTotals, selectedDate]);

  // Open Edit Modal
  const handleOpenEdit = (tx: Transaction) => {
    const acc = accounts.find(a => a.id === tx.accountId);
    if (acc && !canUserTransactAccount(acc, user.email)) {
      return;
    }
    setEditingTx(tx);
    setEditTitle(tx.title);
    setEditAmount(String(tx.amount));
    setEditDate(tx.date);
    setEditType(tx.type);
    setEditAccountId(tx.accountId);
    setEditCategoryId(tx.categoryId || 'cat-1');
    setEditNotes(tx.notes || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !editTitle || !editAmount) return;

    // Permissions check
    const currentAcc = accounts.find(a => a.id === editingTx.accountId);
    if (currentAcc && !canUserTransactAccount(currentAcc, user.email)) {
      setEditingTx(null);
      return;
    }
    const newAcc = accounts.find(a => a.id === editAccountId);
    if (newAcc && !canUserTransactAccount(newAcc, user.email)) {
      setEditingTx(null);
      return;
    }

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

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* If Day View mode is active, render the Google Calendar styled Day Schedule */}
      {viewMode === 'day' ? (
        <DayScheduleView
          selectedDate={selectedDate}
          onSelectDate={(newDate) => {
            setSelectedDate(newDate);
            if (newDate && newDate.includes('-')) {
              const [y, m] = newDate.split('-').map(Number);
              if (!isNaN(y) && !isNaN(m)) {
                setCurrentYear(y);
                setCurrentMonth(m - 1);
              }
            }
          }}
          onBackToMonth={() => setViewMode('month')}
          user={user}
          transactions={scopedTransactions}
          accounts={accounts}
          categories={categories}
          loans={loans}
          groups={groups}
          onOpenAddExpense={onOpenAddExpense}
          onEditTransaction={handleOpenEdit}
          onDeleteTransaction={onDeleteTransaction}
        />
      ) : (
        <>
          {/* Top Month Selector Controls */}
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <button
              onClick={handleJumpToToday}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition shadow-xs"
            >
              Today
            </button>

            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-bold text-slate-800 min-w-[120px] text-center">
                {monthName} {currentYear}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {onOpenCategories && (
              <button
                onClick={onOpenCategories}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                title="Manage categories and colors"
              >
                <Palette className="w-3.5 h-3.5 text-slate-600" />
                <span>Palette</span>
              </button>
            )}

            <button
              onClick={() => onOpenAddExpense(selectedDate || todayStr)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition active:scale-95 ml-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add Entry</span>
            </button>
          </div>

          {/* Monthly KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="group bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:shadow-sm transition">
              <span className="text-[11px] font-bold uppercase text-slate-600">Month Total Income</span>
              <div className="text-xl font-extrabold text-emerald-700 mt-0.5 privacy-value">
                +{user.currency}{monthlySummary.totalIncome.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="group bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:shadow-sm transition">
              <span className="text-[11px] font-bold uppercase text-slate-600">Month Total Expense</span>
              <div className="text-xl font-extrabold text-rose-700 mt-0.5 privacy-value">
                -{user.currency}{monthlySummary.totalExpense.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="group bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:shadow-sm transition">
              <span className="text-[11px] font-bold uppercase text-slate-600">Net Month Flow</span>
              <div className={`text-xl font-extrabold mt-0.5 privacy-value ${monthlySummary.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {monthlySummary.net >= 0 ? '+' : ''}{user.currency}{monthlySummary.net.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="group bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:shadow-sm transition">
              <span className="text-[11px] font-bold uppercase text-slate-600">Active Spending Days</span>
              <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                {monthlySummary.activeDays} <span className="text-xs font-normal text-slate-600">days</span>
              </div>
            </div>
          </div>

          {/* Account / Category Filter bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-bold uppercase text-slate-600">Filter Calendar:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white"
              >
                <option value="all">All Accounts & Cards</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type === 'credit_card' ? 'Card' : 'Bank'})
                  </option>
                ))}
              </select>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.type})
                  </option>
                ))}
              </select>

              {(selectedAccount !== 'all' || selectedCategory !== 'all') && (
                <button
                  onClick={() => { setSelectedAccount('all'); setSelectedCategory('all'); }}
                  className="text-xs text-rose-600 hover:underline font-semibold"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Main Calendar Grid & Day Details Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Calendar Grid Container */}
            <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                {/* Day of Week Headers */}
                <div className="grid grid-cols-7 mb-2 text-center">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, index) => (
                    <div 
                      key={d} 
                      className={`py-2 text-xs font-bold uppercase tracking-wider ${
                        index === 0 || index === 6 ? 'text-slate-600' : 'text-slate-700'
                      }`}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Month Day Cells Grid */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {calendarDays.map((cell) => {
                    const totals = dailyTotals[cell.dateStr];
                    const isSelected = selectedDate === cell.dateStr;
                    const hasIncome = totals && totals.income > 0;
                    const hasExpense = totals && totals.expense > 0;
                    const hasTransactions = Boolean(totals && totals.count > 0);
                    const dominantCat = totals?.dominantCategory;
                    const secondaryCat = totals?.secondaryCategory;

                    // Build subtle soft background & border style based on category color
                    let cellBackground = undefined;
                    let cellBorderColor = undefined;

                    if (hasTransactions && dominantCat) {
                      if (secondaryCat && secondaryCat.color !== dominantCat.color) {
                        cellBackground = `linear-gradient(135deg, ${dominantCat.color}15 0%, ${secondaryCat.color}0E 100%)`;
                      } else {
                        cellBackground = `${dominantCat.color}12`;
                      }
                      cellBorderColor = `${dominantCat.color}35`;
                    }

                    return (
                      <div
                        key={cell.dateStr}
                        onClick={() => {
                          if (selectedDate === cell.dateStr) {
                            // If date is already selected, clicking it again opens the Day Schedule view
                            setViewMode('day');
                          } else {
                            // First click selects the date to highlight and inspect in sidebar
                            setSelectedDate(cell.dateStr);
                          }
                        }}
                        title={isSelected ? "Click again to open Google Calendar Day Schedule" : "Click to select date"}
                        style={{
                          background: !cell.isCurrentMonth || isSelected ? undefined : cellBackground,
                          borderColor: !cell.isCurrentMonth || isSelected ? undefined : cellBorderColor,
                        }}
                        className={`min-h-[78px] sm:min-h-[96px] p-1.5 sm:p-2 rounded-2xl border transition cursor-pointer flex flex-col justify-between select-none relative group ${
                          isSelected 
                            ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/40 shadow-xs' 
                            : cell.isCurrentMonth
                            ? hasTransactions
                              ? 'hover:border-slate-400 hover:shadow-xs shadow-2xs'
                              : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                            : 'border-slate-100 bg-slate-50/40 opacity-30 hover:opacity-60'
                        }`}
                      >
                        {/* Top: Day Number & Category Micro Dots / Count */}
                        <div className="flex items-center justify-between">
                          <span 
                            className={`text-xs font-bold inline-flex items-center justify-center w-6 h-6 rounded-full ${
                              cell.isToday
                                ? 'bg-blue-600 text-white shadow-xs'
                                : cell.isCurrentMonth
                                ? isSelected ? 'text-blue-700 font-extrabold' : 'text-slate-800'
                                : 'text-slate-400'
                            }`}
                          >
                            {cell.dayNum}
                          </span>

                          {/* Category micro indicators */}
                          {totals && totals.categories && totals.categories.length > 0 && (
                            <div className="flex items-center -space-x-1">
                              {totals.categories.slice(0, 3).map((c) => (
                                <span 
                                  key={c.id}
                                  className="w-2 h-2 rounded-full border border-white shadow-2xs inline-block"
                                  style={{ backgroundColor: c.color }}
                                  title={c.name}
                                />
                              ))}
                              {totals.count > 1 && (
                                <span className="text-[9px] font-bold text-slate-600 ml-1.5 hidden sm:inline">
                                  {totals.count}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom: Numbers only - Green Income & Red Expense */}
                        <div className="space-y-0.5 mt-1">
                          {hasIncome && (
                            <div className="text-[11px] sm:text-xs font-extrabold text-emerald-700 truncate tracking-tight text-right drop-shadow-2xs privacy-value">
                              +{user.currency}{Math.round(totals.income).toLocaleString('en-IN')}
                            </div>
                          )}

                          {hasExpense && (
                            <div className="text-[11px] sm:text-xs font-extrabold text-rose-700 truncate tracking-tight text-right drop-shadow-2xs privacy-value">
                              -{user.currency}{Math.round(totals.expense).toLocaleString('en-IN')}
                            </div>
                          )}

                          {!hasIncome && !hasExpense && (
                            <div className="h-4"></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Category Color Legend */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase text-slate-600">Category Colors:</span>
                <div className="flex flex-wrap items-center gap-2">
                  {categories.slice(0, 8).map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCategory(selectedCategory === c.id ? 'all' : c.id)}
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold transition border ${
                        selectedCategory === c.id
                          ? 'ring-2 ring-blue-600/30'
                          : 'border-slate-200/80 bg-slate-50 hover:bg-slate-100'
                      }`}
                      style={{
                        backgroundColor: selectedCategory === c.id ? `${c.color}20` : undefined,
                        borderColor: selectedCategory === c.id ? c.color : undefined,
                        color: selectedCategory === c.id ? c.color : undefined,
                      }}
                    >
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                      <span className="truncate max-w-[80px]">{c.name}</span>
                    </button>
                  ))}

                  {onOpenCategories && (
                    <button
                      onClick={onOpenCategories}
                      className="text-[11px] font-bold text-blue-600 hover:underline ml-1"
                    >
                      + Manage Palette
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Selected Day Transaction Breakdown Sidebar */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-slate-600 block">Selected Date</span>
                    <h3 className="text-base font-extrabold text-slate-900">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </h3>
                  </div>

                  <button
                    onClick={() => onOpenAddExpense(selectedDate)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                {/* Selected Day Stats (Green & Red) */}
                <div className="grid grid-cols-2 gap-2 my-4">
                  <div className="group p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 block">Total Income</span>
                    <div className="text-base font-extrabold text-emerald-800 mt-0.5 privacy-value">
                      +{user.currency}{selectedDateSummary.income.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="group p-3 bg-rose-50/70 border border-rose-100 rounded-2xl">
                    <span className="text-[10px] font-bold uppercase text-rose-700 block">Total Expense</span>
                    <div className="text-base font-extrabold text-rose-800 mt-0.5 privacy-value">
                      -{user.currency}{selectedDateSummary.expense.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* List of Transactions on Selected Date */}
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-600 block mb-2">
                    Day Records ({selectedDateTransactions.length})
                  </span>

                  {selectedDateTransactions.length > 0 ? (
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {selectedDateTransactions.map((tx) => {
                        const acc = accounts.find(a => a.id === tx.accountId);
                        const cat = categories.find(c => c.id === tx.categoryId);
                        const grp = groups.find(g => g.id === tx.groupId);
                        const emi = loans.find(l => l.id === tx.emiId);
                        const isExpense = tx.type === 'expense' || tx.type === 'emi_payment' || (tx.type === 'settlement' && tx.notes?.includes('Paid to'));
                        const canTransact = acc ? canUserTransactAccount(acc, user.email) : true;

                        return (
                          <div 
                            key={tx.id} 
                            className="group p-3 rounded-2xl border transition flex items-center justify-between gap-3"
                            style={{
                              backgroundColor: cat ? `${cat.color}0D` : '#F8FAFC',
                              borderColor: cat ? `${cat.color}30` : '#E2E8F0',
                            }}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                {cat && (
                                  <span
                                    className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: `${cat.color}25`, color: cat.color }}
                                  >
                                    <CategoryIcon iconName={cat.icon || 'Tag'} className="w-3 h-3" />
                                  </span>
                                )}
                                <span className="font-bold text-xs text-slate-900 truncate">{tx.title}</span>
                              </div>
                              <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1">
                                <span>{acc ? acc.name : 'Account'}</span>
                                {cat && (
                                  <span 
                                    className="font-semibold px-1.5 py-0.2 rounded text-[10px]"
                                    style={{ color: cat.color }}
                                  >
                                    • {cat.name}
                                  </span>
                                )}
                                {grp && <span className="text-emerald-700 font-medium">• {grp.name}</span>}
                                {emi && <span className="text-indigo-700 font-medium">• {emi.name}</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className={`font-extrabold text-xs text-right privacy-value ${isExpense ? 'text-rose-700' : 'text-emerald-700'}`}>
                                {isExpense ? '-' : '+'}{user.currency}{tx.amount.toLocaleString('en-IN')}
                              </div>

                              <div className="flex items-center">
                                {canTransact ? (
                                  <>
                                    <button
                                      onClick={() => handleOpenEdit(tx)}
                                      className="p-1 text-slate-400 hover:text-amber-600 transition cursor-pointer"
                                      title="Edit"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => onDeleteTransaction(tx.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                    View Only
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Clock className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-700">No transactions on this date</p>
                      <button
                        onClick={() => onOpenAddExpense(selectedDate)}
                        className="mt-3 text-xs font-bold text-blue-600 hover:underline"
                      >
                        + Record entry for {selectedDate}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit Transaction Modal */}
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
                    {accounts.map(acc => {
                      const access = getAccountAccess(acc, user.email);
                      return (
                        <option key={acc.id} value={acc.id} disabled={!access.canTransact}>
                          {acc.name} {!access.canTransact ? '(View Only)' : ''}
                        </option>
                      );
                    })}
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
    </div>
  );
};
