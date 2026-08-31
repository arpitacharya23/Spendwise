import React, { useState, useMemo } from 'react';
import { 
  Target, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Edit2, 
  Check, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingDown, 
  TrendingUp, 
  Calendar as CalendarIcon,
  Receipt,
  Wallet,
  Sparkles,
  SlidersHorizontal,
  PieChart as PieIcon,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { Category, Transaction, UserProfile } from '../types';
import { CategoryIcon } from './CategoryIcon';

interface BudgetsViewProps {
  user: UserProfile;
  categories: Category[];
  transactions: Transaction[];
  onUpdateUserBudget: (newBudget: number) => void;
  onUpdateCategoryBudget: (categoryId: string, budgetLimit?: number) => void;
  onOpenAddExpense: (prefillDate?: string) => void;
  onNavigateToCategory?: (categoryId: string) => void;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  user,
  categories,
  transactions,
  onUpdateUserBudget,
  onUpdateCategoryBudget,
  onOpenAddExpense,
}) => {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth()); // 0-indexed
  const [editingMasterBudget, setEditingMasterBudget] = useState<boolean>(false);
  const [masterBudgetValue, setMasterBudgetValue] = useState<string>(String(user.monthlyBudget || 50000));
  
  // Category budget editing state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryBudgetValue, setCategoryBudgetValue] = useState<string>('');

  // Selected category filter or view
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'over_budget' | 'near_limit' | 'on_track'>('all');
  const [searchCategory, setSearchCategory] = useState<string>('');

  const monthName = new Date(selectedYear, selectedMonth, 1).toLocaleString('default', { month: 'long' });
  const isCurrentMonth = today.getFullYear() === selectedYear && today.getMonth() === selectedMonth;
  const daysInSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const currentDayNum = isCurrentMonth ? today.getDate() : daysInSelectedMonth;
  const daysRemaining = isCurrentMonth ? Math.max(0, daysInSelectedMonth - currentDayNum) : 0;

  // Month navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handleJumpToCurrent = () => {
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth());
  };

  // Filter transactions for the selected month
  const monthTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (!tx.date || typeof tx.date !== 'string') return false;
      const parts = tx.date.split('-');
      if (parts.length >= 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        return y === selectedYear && m === selectedMonth;
      }
      const d = new Date(tx.date);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });
  }, [transactions, selectedYear, selectedMonth]);

  // Expenses only in this month
  const expenseTransactions = useMemo(() => {
    return monthTransactions.filter(
      tx => tx.type === 'expense' || tx.type === 'emi_payment' || (tx.type === 'settlement' && tx.notes?.includes('Paid to'))
    );
  }, [monthTransactions]);

  const totalMonthSpending = useMemo(() => {
    return expenseTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  }, [expenseTransactions]);

  const totalMonthIncome = useMemo(() => {
    return monthTransactions
      .filter(tx => tx.type === 'income' || (tx.type === 'settlement' && tx.notes?.includes('Received from')))
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
  }, [monthTransactions]);

  const masterBudgetLimit = user.monthlyBudget || 50000;
  const masterPercentage = masterBudgetLimit > 0 ? (totalMonthSpending / masterBudgetLimit) * 100 : 0;
  const clampedMasterPercent = Math.min(Math.max(masterPercentage, 0), 100);
  const remainingMasterBudget = masterBudgetLimit - totalMonthSpending;
  const isMasterOverBudget = remainingMasterBudget < 0;
  const dailyRunway = daysRemaining > 0 && remainingMasterBudget > 0 
    ? Math.round(remainingMasterBudget / daysRemaining) 
    : 0;

  // Expense categories
  const expenseCategories = useMemo(() => {
    return categories.filter(c => c.type === 'expense');
  }, [categories]);

  // Category stats calculation
  const categoryStats = useMemo(() => {
    return expenseCategories.map(cat => {
      const catTxs = expenseTransactions.filter(tx => tx.categoryId === cat.id);
      const spent = catTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const budget = cat.budgetLimit || 0;
      const percent = budget > 0 ? (spent / budget) * 100 : 0;
      const remaining = budget > 0 ? budget - spent : 0;
      const isOver = budget > 0 && spent > budget;
      const isNear = budget > 0 && percent >= 75 && percent <= 100;
      
      return {
        category: cat,
        spent,
        budget,
        percent,
        remaining,
        isOver,
        isNear,
        txCount: catTxs.length,
        recentTxs: catTxs.slice(0, 3)
      };
    });
  }, [expenseCategories, expenseTransactions]);

  // Total allocated to specific categories
  const totalAllocatedToCategories = useMemo(() => {
    return categoryStats.reduce((sum, s) => sum + (s.budget || 0), 0);
  }, [categoryStats]);

  // Filtered categories
  const filteredCategoryStats = useMemo(() => {
    const q = (searchCategory || '').trim().toLowerCase();
    return categoryStats.filter(s => {
      if (q) {
        if (!s.category?.name || !s.category.name.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (categoryFilter === 'over_budget') return s.isOver;
      if (categoryFilter === 'near_limit') return s.isNear;
      if (categoryFilter === 'on_track') return s.budget > 0 && !s.isOver && !s.isNear;
      return true;
    });
  }, [categoryStats, categoryFilter, searchCategory]);

  // Master budget save
  const handleSaveMasterBudget = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = Number(masterBudgetValue);
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateUserBudget(parsed);
      setEditingMasterBudget(false);
    }
  };

  // Category budget save
  const handleSaveCategoryBudget = (categoryId: string) => {
    const parsed = Number(categoryBudgetValue);
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateCategoryBudget(categoryId, parsed === 0 ? undefined : parsed);
    } else if (categoryBudgetValue.trim() === '') {
      onUpdateCategoryBudget(categoryId, undefined);
    }
    setEditingCategoryId(null);
    setCategoryBudgetValue('');
  };

  return (
    <div className="space-y-6 pb-16 animate-fadeIn">
      {/* Month Selector & Quick Actions */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <button
          onClick={handleJumpToCurrent}
          className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition shadow-2xs ${
            isCurrentMonth 
              ? 'bg-blue-50 text-blue-700 border border-blue-200' 
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          Current Month
        </button>

        <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 text-xs font-bold text-slate-800 min-w-[130px] text-center">
            {monthName} {selectedYear}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => onOpenAddExpense(`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95 ml-1"
        >
          <Plus className="w-4 h-4" />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Master Monthly Budget Hero Card */}
      <div className="group bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm relative overflow-hidden">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xs ${
              isMasterOverBudget 
                ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                : masterPercentage >= 75 
                ? 'bg-amber-50 text-amber-600 border border-amber-200' 
                : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            }`}>
              <Target className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {monthName} Master Budget
                </h2>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {selectedYear}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {!editingMasterBudget ? (
              <button
                onClick={() => {
                  setMasterBudgetValue(String(masterBudgetLimit));
                  setEditingMasterBudget(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition active:scale-95 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Adjust Master Limit (<span className="privacy-value">{user.currency}{masterBudgetLimit.toLocaleString('en-IN')}</span>)</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Master Budget Inline Form */}
        {editingMasterBudget && (
          <form onSubmit={handleSaveMasterBudget} className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Monthly Master Spending Limit ({user.currency})
                </label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                    {user.currency}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={masterBudgetValue}
                    onChange={(e) => setMasterBudgetValue(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-auto">
                {[25000, 50000, 75000, 100000, 150000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setMasterBudgetValue(String(amt))}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                      Number(masterBudgetValue) === amt 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {user.currency}{amt.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="submit"
                  className="flex items-center gap-1 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Limit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMasterBudget(false)}
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Big Numbers & Main Percentage Display */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Total Spending ({monthName} {selectedYear})
            </span>
            <div className="flex items-baseline gap-2.5 mt-0.5">
              <span className={`text-3xl sm:text-4xl font-black tracking-tight privacy-value ${
                isMasterOverBudget ? 'text-rose-700' : 'text-slate-900'
              }`}>
                {user.currency}{totalMonthSpending.toLocaleString('en-IN')}
              </span>
              <span className="text-sm font-semibold text-slate-500">
                / <span className="privacy-value">{user.currency}{masterBudgetLimit.toLocaleString('en-IN')}</span> limit
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border shadow-2xs ${
              isMasterOverBudget
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : masterPercentage >= 75
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {isMasterOverBudget ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              ) : masterPercentage >= 75 ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>{Math.round(masterPercentage)}% Used</span>
            </span>
          </div>
        </div>

        {/* Visual Percentage Progress Bar */}
        <div className="mt-4">
          <div className="w-full h-4 sm:h-5 bg-slate-100 rounded-full p-0.5 border border-slate-200 overflow-hidden relative shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-500 relative ${
                isMasterOverBudget
                  ? 'bg-gradient-to-r from-rose-500 to-red-600'
                  : masterPercentage >= 75
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                  : 'bg-gradient-to-r from-blue-500 to-emerald-500'
              }`}
              style={{ width: `${clampedMasterPercent}%` }}
            >
              <div className="absolute inset-0 bg-white/20 rounded-full" />
            </div>
          </div>

          {/* Progress Bar Markers */}
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 mt-1.5 px-0.5">
            <span>0% ({user.currency}0)</span>
            <span>50% (<span className="privacy-value">{user.currency}{(masterBudgetLimit / 2).toLocaleString('en-IN')}</span>)</span>
            <span>100% (<span className="privacy-value">{user.currency}{masterBudgetLimit.toLocaleString('en-IN')}</span>)</span>
          </div>
        </div>

        {/* 4 KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
          <div className={`group/item p-3.5 rounded-2xl border ${
            isMasterOverBudget 
              ? 'bg-rose-50/70 border-rose-200' 
              : 'bg-slate-50/70 border-slate-200'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              {isMasterOverBudget ? 'Budget Exceeded By' : 'Remaining Spendable'}
            </span>
            <div className={`text-lg font-extrabold mt-0.5 privacy-value ${
              isMasterOverBudget ? 'text-rose-700' : 'text-emerald-700'
            }`}>
              {isMasterOverBudget ? '-' : '+'}{user.currency}{Math.abs(remainingMasterBudget).toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {isMasterOverBudget ? 'Over limit threshold' : `${Math.max(0, 100 - Math.round(masterPercentage))}% balance remaining`}
            </p>
          </div>

          <div className="group/item p-3.5 rounded-2xl border bg-slate-50/70 border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Daily Safe Runway
            </span>
            <div className="text-lg font-extrabold text-slate-900 mt-0.5 privacy-value">
              {user.currency}{dailyRunway.toLocaleString('en-IN')}<span className="text-xs font-semibold text-slate-500"> / day</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {isCurrentMonth ? `${daysRemaining} days left this month` : `Full month summary`}
            </p>
          </div>

          <div className="group/item p-3.5 rounded-2xl border bg-slate-50/70 border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Categories Allocated
            </span>
            <div className="text-lg font-extrabold text-slate-900 mt-0.5 privacy-value">
              {user.currency}{totalAllocatedToCategories.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Across {categoryStats.filter(c => c.budget > 0).length} customized category limits
            </p>
          </div>

          <div className="group/item p-3.5 rounded-2xl border bg-slate-50/70 border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Monthly Income Inflow
            </span>
            <div className="text-lg font-extrabold text-emerald-700 mt-0.5 privacy-value">
              +{user.currency}{totalMonthIncome.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Net: <span className="privacy-value">{totalMonthIncome - totalMonthSpending >= 0 ? '+' : '-'}{user.currency}{Math.abs(totalMonthIncome - totalMonthSpending).toLocaleString('en-IN')}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Category Budgets Breakdown Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-6">
        {/* Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              Category Budget Allocations
            </h2>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              placeholder="Search category..."
              value={searchCategory}
              onChange={(e) => setSearchCategory(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  categoryFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({categoryStats.length})
              </button>
              <button
                onClick={() => setCategoryFilter('over_budget')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  categoryFilter === 'over_budget' ? 'bg-white text-rose-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Over Limit ({categoryStats.filter(c => c.isOver).length})
              </button>
              <button
                onClick={() => setCategoryFilter('near_limit')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  categoryFilter === 'near_limit' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Near Limit ({categoryStats.filter(c => c.isNear).length})
              </button>
            </div>
          </div>
        </div>

        {/* Category Budget Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategoryStats.map((item) => {
            const { category, spent, budget, percent, remaining, isOver, isNear, txCount } = item;
            const isEditingThis = editingCategoryId === category.id;
            const clampedPercent = Math.min(Math.max(percent, 0), 100);

            return (
              <div 
                key={category.id}
                className="group p-4 rounded-2xl border border-slate-200 hover:border-slate-300 bg-white transition shadow-2xs flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Icon, Name & Action */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xs"
                        style={{ backgroundColor: `${category.color}20`, color: category.color }}
                      >
                        <CategoryIcon iconName={category.icon || 'Tag'} className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-bold text-xs text-slate-900 truncate">
                          {category.name}
                        </h3>
                        <span className="text-[10px] text-slate-500">
                          {txCount} {txCount === 1 ? 'transaction' : 'transactions'}
                        </span>
                      </div>
                    </div>

                    {!isEditingThis && (
                      <button
                        onClick={() => {
                          setEditingCategoryId(category.id);
                          setCategoryBudgetValue(budget > 0 ? String(budget) : '');
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                        title="Edit category budget limit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Inline Budget Editor for Category */}
                  {isEditingThis ? (
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="text-[10px] font-bold uppercase text-slate-600 block mb-1">
                        Category Limit ({user.currency})
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="100"
                          placeholder="e.g. 5000 (0 to remove)"
                          value={categoryBudgetValue}
                          onChange={(e) => setCategoryBudgetValue(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveCategoryBudget(category.id)}
                          className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                          title="Save limit"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingCategoryId(null)}
                          className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Spend vs Budget Stats */
                    <div className="mt-4 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-600 block">Spent</span>
                          <span className={`text-base font-extrabold privacy-value ${isOver ? 'text-rose-700' : 'text-slate-900'}`}>
                            {user.currency}{spent.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase text-slate-600 block">Limit</span>
                          <span className="text-xs font-bold text-slate-600">
                            {budget > 0 ? <span className="privacy-value">{user.currency}{budget.toLocaleString('en-IN')}</span> : 'No limit set'}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {budget > 0 ? (
                        <div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isOver
                                  ? 'bg-rose-500'
                                  : isNear
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${clampedPercent}%`, backgroundColor: !isOver && !isNear ? category.color : undefined }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600 mt-1">
                            <span className={isOver ? 'text-rose-700 font-bold' : isNear ? 'text-amber-700 font-bold' : 'text-emerald-700'}>
                              {Math.round(percent)}% used
                            </span>
                            <span>
                              {isOver 
                                ? <span>Over by <span className="privacy-value">{user.currency}{Math.abs(remaining).toLocaleString('en-IN')}</span></span> 
                                : <span><span className="privacy-value">{user.currency}{remaining.toLocaleString('en-IN')}</span> left</span>}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-1">
                          <button
                            onClick={() => {
                              setEditingCategoryId(category.id);
                              setCategoryBudgetValue('5000');
                            }}
                            className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Set category budget limit</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Quick Action */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">
                    {spent === 0 ? 'No spending this month' : `${Math.round((spent / (totalMonthSpending || 1)) * 100)}% of total month spend`}
                  </span>
                  <button
                    onClick={() => onOpenAddExpense(`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`)}
                    className="font-bold text-blue-600 hover:underline"
                  >
                    + Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredCategoryStats.length === 0 && (
          <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Target className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No categories match your filter</p>
            <p className="text-xs text-slate-600 mt-1">Try resetting the search query or selecting 'All'</p>
          </div>
        )}
      </div>
    </div>
  );
};
