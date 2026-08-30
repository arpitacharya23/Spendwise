import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Palette, 
  ArrowUpRight, 
  ArrowDownLeft, 
  X, 
  Check, 
  RotateCcw, 
  AlertCircle,
  Calendar as CalendarIcon,
  Target,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  ArrowUpDown,
  Zap,
  Scale
} from 'lucide-react';
import { Category, Transaction, UserProfile } from '../types';
import { AVAILABLE_CATEGORY_ICONS, CATEGORY_PALETTES, CategoryIcon } from './CategoryIcon';

interface CategoriesViewProps {
  user: UserProfile;
  categories: Category[];
  transactions: Transaction[];
  onAddCategory: (category: Category) => void;
  onEditCategory: (categoryId: string, updatedData: Partial<Category>) => void;
  onDeleteCategory: (categoryId: string, reassignCategoryId?: string) => void;
  onResetCategories?: () => void;
  onUpdateUserBudget?: (newBudget: number) => void;
  onUpdateCategoryBudget?: (categoryId: string, budgetLimit?: number) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  user,
  categories,
  transactions,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onResetCategories,
  onUpdateUserBudget,
  onUpdateCategoryBudget,
}) => {
  const today = new Date();
  
  // Date & Month Navigation
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth()); // 0-indexed
  const [timeframeMode, setTimeframeMode] = useState<'monthly' | 'all_time'>('monthly');

  // Filters & Search
  const [activityFilter, setActivityFilter] = useState<'all' | 'has_debits' | 'has_credits' | 'budgeted' | 'over_budget' | 'near_limit' | 'on_track' | 'unbudgeted'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'debited_desc' | 'credited_desc' | 'budget_desc' | 'over_percent_desc' | 'tx_desc' | 'name_asc'>('debited_desc');

  // Master Monthly Spending Budget Editing State
  const [editingMasterBudget, setEditingMasterBudget] = useState(false);
  const [masterBudgetValue, setMasterBudgetValue] = useState<string>(String(user.monthlyBudget || 50000));

  // Quick Inline Category Budget Editing State
  const [inlineBudgetEditCatId, setInlineBudgetEditCatId] = useState<string | null>(null);
  const [inlineBudgetValue, setInlineBudgetValue] = useState<string>('');

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Form States for Add / Edit Modal (Universal - no income/expense constraint)
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(CATEGORY_PALETTES[0].hex);
  const [formIcon, setFormIcon] = useState('Tag');
  const [formBudgetLimit, setFormBudgetLimit] = useState<string>('');
  const [iconSearch, setIconSearch] = useState('');

  // Quick Color Picker Popover State
  const [quickColorCategoryId, setQuickColorCategoryId] = useState<string | null>(null);

  // Month navigation helpers
  const monthName = new Date(selectedYear, selectedMonth, 1).toLocaleString('default', { month: 'long' });
  const isCurrentMonth = today.getFullYear() === selectedYear && today.getMonth() === selectedMonth;
  const daysInSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const currentDayNum = isCurrentMonth ? today.getDate() : daysInSelectedMonth;
  const daysRemaining = isCurrentMonth ? Math.max(0, daysInSelectedMonth - currentDayNum) : 0;

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
    setTimeframeMode('monthly');
  };

  // Filter transactions for the selected timeframe
  const activeTransactions = useMemo(() => {
    if (timeframeMode === 'all_time') {
      return transactions;
    }

    return transactions.filter(tx => {
      if (!tx.date) return false;
      const parts = tx.date.split('-');
      if (parts.length >= 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        return y === selectedYear && m === selectedMonth;
      }
      const d = new Date(tx.date);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });
  }, [transactions, timeframeMode, selectedYear, selectedMonth]);

  // Total Debited (Spending/Outflows) & Total Credited (Income/Inflows) across all transactions
  const totalPeriodDebited = useMemo(() => {
    return activeTransactions
      .filter(tx => tx.type === 'expense' || tx.type === 'emi_payment' || (tx.type === 'settlement' && tx.notes?.includes('Paid to')))
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
  }, [activeTransactions]);

  const totalPeriodCredited = useMemo(() => {
    return activeTransactions
      .filter(tx => tx.type === 'income' || (tx.type === 'settlement' && tx.notes?.includes('Received from')))
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);
  }, [activeTransactions]);

  const totalPeriodDebitCount = useMemo(() => {
    return activeTransactions.filter(tx => tx.type === 'expense' || tx.type === 'emi_payment' || (tx.type === 'settlement' && tx.notes?.includes('Paid to'))).length;
  }, [activeTransactions]);

  const totalPeriodCreditCount = useMemo(() => {
    return activeTransactions.filter(tx => tx.type === 'income' || (tx.type === 'settlement' && tx.notes?.includes('Received from'))).length;
  }, [activeTransactions]);

  const netPeriodBalance = totalPeriodCredited - totalPeriodDebited;

  // Master Monthly Spending Budget Calculation
  const masterBudgetLimit = user.monthlyBudget || 50000;
  const masterPercentage = masterBudgetLimit > 0 ? (totalPeriodDebited / masterBudgetLimit) * 100 : 0;
  const clampedMasterPercent = Math.min(Math.max(masterPercentage, 0), 100);
  const remainingMasterBudget = masterBudgetLimit - totalPeriodDebited;
  const isMasterOverBudget = remainingMasterBudget < 0;
  const dailyRunway = daysRemaining > 0 && remainingMasterBudget > 0 
    ? Math.round(remainingMasterBudget / daysRemaining) 
    : 0;

  // Calculate detailed stats per category (Universal: Debits, Credits, Budget Progress)
  const categoryStatsList = useMemo(() => {
    return categories.map(cat => {
      const catTxs = activeTransactions.filter(tx => tx.categoryId === cat.id);

      // Debits (Expenses/Outflows) in this category
      const debitTxs = catTxs.filter(tx => tx.type === 'expense' || tx.type === 'emi_payment' || (tx.type === 'settlement' && tx.notes?.includes('Paid to')));
      const debitedAmount = debitTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const debitCount = debitTxs.length;

      // Credits (Income/Inflows) in this category
      const creditTxs = catTxs.filter(tx => tx.type === 'income' || (tx.type === 'settlement' && tx.notes?.includes('Received from')));
      const creditedAmount = creditTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
      const creditCount = creditTxs.length;

      // Net for category (Credits - Debits)
      const netCategory = creditedAmount - debitedAmount;

      // Expense Spending Budget
      const budget = cat.budgetLimit || 0;
      const hasBudget = budget > 0;
      const budgetPercent = hasBudget ? (debitedAmount / budget) * 100 : 0;
      const budgetRemaining = hasBudget ? budget - debitedAmount : 0;
      const isOver = hasBudget && debitedAmount > budget;
      const isNear = hasBudget && budgetPercent >= 75 && budgetPercent <= 100;
      const isOnTrack = hasBudget && budgetPercent < 75;
      const isUnbudgeted = !hasBudget;

      // Share of total debited spending
      const shareOfTotalDebited = totalPeriodDebited > 0
        ? (debitedAmount / totalPeriodDebited) * 100
        : 0;

      return {
        category: cat,
        debitedAmount,
        debitCount,
        creditedAmount,
        creditCount,
        totalTxCount: catTxs.length,
        netCategory,
        budget,
        hasBudget,
        budgetPercent,
        budgetRemaining,
        isOver,
        isNear,
        isOnTrack,
        isUnbudgeted,
        shareOfTotalDebited,
      };
    });
  }, [categories, activeTransactions, totalPeriodDebited]);

  // Master allocation metrics
  const totalAllocatedBudget = useMemo(() => {
    return categoryStatsList.reduce((sum, s) => sum + s.budget, 0);
  }, [categoryStatsList]);

  const unallocatedBudget = masterBudgetLimit - totalAllocatedBudget;

  // Filter Counts
  const hasDebitsCount = categoryStatsList.filter(s => s.debitedAmount > 0).length;
  const hasCreditsCount = categoryStatsList.filter(s => s.creditedAmount > 0).length;
  const budgetedCategoriesCount = categoryStatsList.filter(s => s.hasBudget).length;
  const overBudgetCount = categoryStatsList.filter(s => s.isOver).length;
  const nearLimitCount = categoryStatsList.filter(s => s.isNear).length;
  const onTrackCount = categoryStatsList.filter(s => s.isOnTrack).length;
  const unbudgetedCount = categoryStatsList.filter(s => s.isUnbudgeted).length;

  // Filtered and Sorted Categories for List View
  const filteredAndSortedStats = useMemo(() => {
    let result = categoryStatsList.filter(item => {
      // Activity Filter
      if (activityFilter === 'has_debits' && item.debitedAmount <= 0) return false;
      if (activityFilter === 'has_credits' && item.creditedAmount <= 0) return false;
      if (activityFilter === 'budgeted' && !item.hasBudget) return false;
      if (activityFilter === 'over_budget' && !item.isOver) return false;
      if (activityFilter === 'near_limit' && !item.isNear) return false;
      if (activityFilter === 'on_track' && !item.isOnTrack) return false;
      if (activityFilter === 'unbudgeted' && !item.isUnbudgeted) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.category.name.toLowerCase().includes(q);
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'debited_desc') {
        return b.debitedAmount - a.debitedAmount;
      }
      if (sortBy === 'credited_desc') {
        return b.creditedAmount - a.creditedAmount;
      }
      if (sortBy === 'budget_desc') {
        return b.budget - a.budget;
      }
      if (sortBy === 'over_percent_desc') {
        return b.budgetPercent - a.budgetPercent;
      }
      if (sortBy === 'tx_desc') {
        return b.totalTxCount - a.totalTxCount;
      }
      if (sortBy === 'name_asc') {
        return a.category.name.localeCompare(b.category.name);
      }
      return 0;
    });

    return result;
  }, [categoryStatsList, activityFilter, searchQuery, sortBy]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setFormName('');
    const usedColors = new Set(categories.map(c => c.color.toUpperCase()));
    const availableColor = CATEGORY_PALETTES.find(p => !usedColors.has(p.hex.toUpperCase())) || CATEGORY_PALETTES[0];
    setFormColor(availableColor.hex);
    setFormIcon('Tag');
    setFormBudgetLimit('');
    setIconSearch('');
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormColor(cat.color);
    setFormIcon(cat.icon || 'Tag');
    setFormBudgetLimit(cat.budgetLimit ? String(cat.budgetLimit) : '');
    setIconSearch('');
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (cat: Category) => {
    const stats = categoryStatsList.find(s => s.category.id === cat.id);
    const txCount = stats?.totalTxCount || 0;
    setDeletingCategory(cat);
    if (txCount > 0) {
      const otherCat = categories.find(c => c.id !== cat.id);
      setReassignTargetId(otherCat?.id || '');
    } else {
      setReassignTargetId('');
    }
  };

  // Save Add Category
  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const parsedBudget = formBudgetLimit ? Number(formBudgetLimit) : undefined;

    const newCategory: Category = {
      id: `cat-${Date.now()}`,
      name: formName.trim(),
      color: formColor,
      icon: formIcon,
      budgetLimit: parsedBudget && parsedBudget > 0 ? parsedBudget : undefined
    };

    onAddCategory(newCategory);
    setIsAddModalOpen(false);
  };

  // Save Edit Category
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !formName.trim()) return;

    const parsedBudget = formBudgetLimit ? Number(formBudgetLimit) : undefined;

    onEditCategory(editingCategory.id, {
      name: formName.trim(),
      color: formColor,
      icon: formIcon,
      budgetLimit: parsedBudget && parsedBudget > 0 ? parsedBudget : undefined
    });

    setEditingCategory(null);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!deletingCategory) return;
    onDeleteCategory(deletingCategory.id, reassignTargetId || undefined);
    setDeletingCategory(null);
  };

  // Save Master Spending Budget
  const handleSaveMasterBudget = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = Number(masterBudgetValue);
    if (!isNaN(parsed) && parsed >= 0 && onUpdateUserBudget) {
      onUpdateUserBudget(parsed);
      setEditingMasterBudget(false);
    }
  };

  // Quick inline category budget save
  const handleSaveInlineBudget = (categoryId: string) => {
    const parsed = Number(inlineBudgetValue);
    if (onUpdateCategoryBudget) {
      if (!isNaN(parsed) && parsed > 0) {
        onUpdateCategoryBudget(categoryId, parsed);
      } else if (inlineBudgetValue.trim() === '' || parsed === 0) {
        onUpdateCategoryBudget(categoryId, undefined);
      }
    } else {
      onEditCategory(categoryId, {
        budgetLimit: !isNaN(parsed) && parsed > 0 ? parsed : undefined
      });
    }
    setInlineBudgetEditCatId(null);
    setInlineBudgetValue('');
  };

  // Quick Change Color directly from avatar popover
  const handleQuickColorChange = (categoryId: string, newColor: string) => {
    onEditCategory(categoryId, { color: newColor });
    setQuickColorCategoryId(null);
  };

  // Filtered icon list for modal
  const filteredIcons = useMemo(() => {
    if (!iconSearch.trim()) return AVAILABLE_CATEGORY_ICONS;
    return AVAILABLE_CATEGORY_ICONS.filter(i => 
      i.name.toLowerCase().includes(iconSearch.toLowerCase()) || 
      i.label.toLowerCase().includes(iconSearch.toLowerCase())
    );
  }, [iconSearch]);

  return (
    <div className="space-y-6 pb-16 animate-fadeIn">
      {/* Top Bar: Timeframe Navigation & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-wrap">
        {/* Left: Timeframe / Month Navigation */}
        <div className="flex items-center gap-2 flex-wrap">
          {timeframeMode === 'monthly' ? (
            <>
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
                onClick={handleJumpToCurrent}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition shadow-2xs ${
                  isCurrentMonth 
                    ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Current Month
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200">
              <CalendarIcon className="w-4 h-4 text-blue-600" />
              <span>All-Time Aggregate</span>
            </div>
          )}

          <button
            onClick={() => setTimeframeMode(timeframeMode === 'monthly' ? 'all_time' : 'monthly')}
            className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition border border-slate-200 bg-white"
          >
            {timeframeMode === 'monthly' ? 'View All Time' : 'Switch to Monthly'}
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 justify-end">
          {onResetCategories && (
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              title="Reset default categories"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Defaults</span>
            </button>
          )}

          <button
            onClick={handleOpenAddModal}
            id="btn-add-category-main"
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Category</span>
          </button>
        </div>
      </div>

      {/* Master Overview Card: Total Debits, Total Credits, Master Budget, Runway */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Master Budget Info */}
          <div className="space-y-1.5 max-w-sm">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Monthly Spending Budget
              </span>
              {!editingMasterBudget && (
                <button
                  onClick={() => {
                    setMasterBudgetValue(String(user.monthlyBudget || 50000));
                    setEditingMasterBudget(true);
                  }}
                  className="p-1 text-slate-400 hover:text-blue-600 rounded-lg transition"
                  title="Edit Master Budget"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {editingMasterBudget ? (
              <form onSubmit={handleSaveMasterBudget} className="flex items-center gap-2 pt-1">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                    {user.currency}
                  </span>
                  <input
                    type="number"
                    value={masterBudgetValue}
                    onChange={(e) => setMasterBudgetValue(e.target.value)}
                    className="w-36 pl-7 pr-2 py-1 bg-slate-50 border border-blue-400 rounded-xl text-lg font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    placeholder="50000"
                  />
                </div>
                <button
                  type="submit"
                  className="p-1.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
                  title="Save"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMasterBudget(false)}
                  className="p-1.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight privacy-value">
                  {user.currency}{masterBudgetLimit.toLocaleString('en-IN')}
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  limit for {timeframeMode === 'monthly' ? `${monthName}` : 'all time'}
                </span>
              </div>
            )}
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto">
            {/* Total Debited (Spent) */}
            <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 min-w-[125px]">
              <span className="text-[10px] font-bold uppercase text-slate-600 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-rose-600" />
                <span>Total Debited</span>
              </span>
              <span className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5 block privacy-value">
                {user.currency}{totalPeriodDebited.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] font-semibold text-slate-600">
                {totalPeriodDebitCount} debits • {masterPercentage.toFixed(1)}% budget
              </span>
            </div>

            {/* Total Credited (Income) */}
            <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 min-w-[125px]">
              <span className="text-[10px] font-bold uppercase text-slate-600 flex items-center gap-1">
                <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                <span>Total Credited</span>
              </span>
              <span className="text-base sm:text-lg font-extrabold text-emerald-700 mt-0.5 block privacy-value">
                +{user.currency}{totalPeriodCredited.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] font-semibold text-slate-600">
                {totalPeriodCreditCount} deposits
              </span>
            </div>

            {/* Remaining Spending Budget */}
            <div className={`rounded-2xl p-3 border min-w-[125px] ${
              isMasterOverBudget 
                ? 'bg-rose-50/80 border-rose-200 text-rose-800' 
                : 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
            }`}>
              <span className="text-[10px] font-bold uppercase block opacity-80">
                {isMasterOverBudget ? 'Over Budget' : 'Remaining Limit'}
              </span>
              <span className="text-base sm:text-lg font-extrabold mt-0.5 block privacy-value">
                {isMasterOverBudget ? '-' : ''}{user.currency}{Math.abs(remainingMasterBudget).toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] font-semibold opacity-80">
                {isMasterOverBudget ? 'Exceeded limit' : 'Safe to spend'}
              </span>
            </div>

            {/* Daily Runway */}
            <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 min-w-[125px]">
              <span className="text-[10px] font-bold uppercase text-slate-600 block">Daily Runway</span>
              <span className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5 block privacy-value">
                {user.currency}{dailyRunway.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] font-semibold text-slate-600">
                {daysRemaining > 0 ? `for ${daysRemaining} days left` : 'Month ended'}
              </span>
            </div>
          </div>
        </div>

        {/* Master Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <span>Overall Spending Progress</span>
            <span className={isMasterOverBudget ? 'text-rose-700 font-extrabold' : 'text-slate-700'}>
              {masterPercentage.toFixed(1)}% ({user.currency}{totalPeriodDebited.toLocaleString('en-IN')} / {user.currency}{masterBudgetLimit.toLocaleString('en-IN')})
            </span>
          </div>

          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60 flex">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                isMasterOverBudget 
                  ? 'bg-rose-500 shadow-sm' 
                  : masterPercentage >= 75 
                    ? 'bg-amber-500' 
                    : 'bg-emerald-500'
              }`}
              style={{ width: `${clampedMasterPercent}%` }}
            />
          </div>
        </div>

        {/* Category Budget Allocation Strip & Quick Health Filters */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Allocation Info */}
          <div className="flex items-center gap-3 text-slate-600 flex-wrap">
            <span className="font-semibold">
              Category Budgets: <strong className="text-slate-900">{user.currency}{totalAllocatedBudget.toLocaleString('en-IN')}</strong> allocated
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold">
              Unallocated: <strong className={unallocatedBudget < 0 ? 'text-rose-600' : 'text-slate-900'}>
                {user.currency}{unallocatedBudget.toLocaleString('en-IN')}
              </strong>
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold">
              Net Balance: <strong className={netPeriodBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                {netPeriodBalance >= 0 ? '+' : ''}{user.currency}{netPeriodBalance.toLocaleString('en-IN')}
              </strong>
            </span>
          </div>

          {/* Quick Health & Activity Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActivityFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                activityFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              All ({categories.length})
            </button>
            <button
              onClick={() => setActivityFilter('has_debits')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                activityFilter === 'has_debits'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/50'
              }`}
            >
              Debits ({hasDebitsCount})
            </button>
            <button
              onClick={() => setActivityFilter('has_credits')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                activityFilter === 'has_credits'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/50'
              }`}
            >
              Credits ({hasCreditsCount})
            </button>
            <button
              onClick={() => setActivityFilter('budgeted')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                activityFilter === 'budgeted'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/50'
              }`}
            >
              Budgeted ({budgetedCategoriesCount})
            </button>
            {overBudgetCount > 0 && (
              <button
                onClick={() => setActivityFilter('over_budget')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 ${
                  activityFilter === 'over_budget'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/50'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Over Limit ({overBudgetCount})</span>
              </button>
            )}
            {nearLimitCount > 0 && (
              <button
                onClick={() => setActivityFilter('near_limit')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 ${
                  activityFilter === 'near_limit'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/50'
                }`}
              >
                <span>Near Limit ({nearLimitCount})</span>
              </button>
            )}
            <button
              onClick={() => setActivityFilter('on_track')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                activityFilter === 'on_track'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/50'
              }`}
            >
              On Track ({onTrackCount})
            </button>
            <button
              onClick={() => setActivityFilter('unbudgeted')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                activityFilter === 'unbudgeted'
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Unbudgeted ({unbudgetedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Sort, Stats */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left: Summary text */}
        <div className="text-xs font-bold text-slate-700">
          Showing <span className="text-blue-600">{filteredAndSortedStats.length}</span> of {categories.length} categories
        </div>

        {/* Right: Sort & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="debited_desc">Highest Debited (Spend)</option>
              <option value="credited_desc">Highest Credited (Income)</option>
              <option value="budget_desc">Highest Budget Limit</option>
              <option value="over_percent_desc">Highest Budget % Used</option>
              <option value="tx_desc">Most Transactions</option>
              <option value="name_asc">Name (A-Z)</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search category name..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Categories List View */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* List Header on Desktop */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-6 py-3.5 bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
          <div className="col-span-3">Category</div>
          <div className="col-span-2 text-right">Debited (Outflow)</div>
          <div className="col-span-2 text-right">Credited (Inflow)</div>
          <div className="col-span-3">Expense Budget & Progress</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Category Rows */}
        {filteredAndSortedStats.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredAndSortedStats.map((item) => {
              const { 
                category, 
                debitedAmount, 
                debitCount, 
                creditedAmount, 
                creditCount, 
                totalTxCount, 
                netCategory, 
                budget, 
                hasBudget, 
                budgetPercent, 
                budgetRemaining, 
                isOver, 
                isNear, 
                isOnTrack, 
                shareOfTotalDebited 
              } = item;

              const clampedPercent = Math.min(Math.max(budgetPercent, 0), 100);
              const isInlineEditing = inlineBudgetEditCatId === category.id;
              const isQuickColorOpen = quickColorCategoryId === category.id;

              return (
                <div 
                  key={category.id} 
                  className="px-5 sm:px-6 py-4 hover:bg-slate-50/80 transition flex flex-col lg:grid lg:grid-cols-12 gap-3.5 lg:gap-4 items-stretch lg:items-center relative group"
                >
                  {/* Col 1: Category Icon & Name */}
                  <div className="lg:col-span-3 flex items-center gap-3.5 min-w-0">
                    {/* Icon Avatar with Quick Color Popover */}
                    <div className="relative flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setQuickColorCategoryId(isQuickColorOpen ? null : category.id)}
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-2xs hover:scale-105 transition cursor-pointer relative group/icon"
                        style={{ backgroundColor: category.color }}
                        title="Click to quickly change color"
                      >
                        <CategoryIcon iconName={category.icon || 'Tag'} className="w-5 h-5" />
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-white border border-slate-200 flex items-center justify-center opacity-0 group-hover/icon:opacity-100 transition shadow-xs">
                          <Palette className="w-2.5 h-2.5 text-slate-700" />
                        </div>
                      </button>

                      {/* Quick Color Palette Popover */}
                      {isQuickColorOpen && (
                        <div className="absolute top-12 left-0 z-50 p-2.5 bg-white rounded-2xl border border-slate-200 shadow-xl w-56 animate-in fade-in zoom-in-95 duration-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase text-slate-500">Pick Color</span>
                            <button 
                              onClick={() => setQuickColorCategoryId(null)}
                              className="text-slate-400 hover:text-slate-600 p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="grid grid-cols-6 gap-1.5">
                            {CATEGORY_PALETTES.map((p) => (
                              <button
                                key={p.hex}
                                type="button"
                                onClick={() => handleQuickColorChange(category.id, p.hex)}
                                className={`w-6 h-6 rounded-lg transition-transform hover:scale-110 flex items-center justify-center ${
                                  category.color.toUpperCase() === p.hex.toUpperCase() ? 'ring-2 ring-blue-500 ring-offset-1 scale-105' : ''
                                }`}
                                style={{ backgroundColor: p.hex }}
                                title={p.name}
                              >
                                {category.color.toUpperCase() === p.hex.toUpperCase() && (
                                  <Check className="w-3 h-3 text-white stroke-[3]" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Name & Total Count */}
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-bold text-slate-900 truncate block">
                        {category.name}
                      </span>
                      <p className="text-[11px] text-slate-600 truncate mt-0.5">
                        {totalTxCount > 0 ? (
                          <span>{totalTxCount} total {totalTxCount === 1 ? 'transaction' : 'transactions'}</span>
                        ) : (
                          <span>No transactions in period</span>
                        )}
                        {debitedAmount > 0 && shareOfTotalDebited > 0 && (
                          <span className="text-slate-600 ml-1.5 font-medium">({shareOfTotalDebited.toFixed(1)}% of spending)</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Col 2: Debited (Outflow) Amount & Count */}
                  <div className="lg:col-span-2 flex lg:flex-col items-center lg:items-end justify-between text-xs">
                    <span className="lg:hidden text-slate-600 font-medium">Debited:</span>
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-slate-900 block privacy-value">
                        {debitedAmount > 0 ? `${user.currency}${debitedAmount.toLocaleString('en-IN')}` : `${user.currency}0`}
                      </span>
                      <span className="text-[10px] text-slate-600 font-semibold block">
                        {debitCount} {debitCount === 1 ? 'debit txn' : 'debit txns'}
                      </span>
                    </div>
                  </div>

                  {/* Col 3: Credited (Inflow) Amount & Count */}
                  <div className="lg:col-span-2 flex lg:flex-col items-center lg:items-end justify-between text-xs">
                    <span className="lg:hidden text-slate-600 font-medium">Credited:</span>
                    <div className="text-right">
                      <span className={`text-sm font-extrabold block privacy-value ${
                        creditedAmount > 0 ? 'text-emerald-700' : 'text-slate-600'
                      }`}>
                        {creditedAmount > 0 ? `+${user.currency}${creditedAmount.toLocaleString('en-IN')}` : `${user.currency}0`}
                      </span>
                      <span className="text-[10px] text-slate-600 font-semibold block">
                        {creditCount} {creditCount === 1 ? 'credit txn' : 'credit txns'}
                      </span>
                    </div>
                  </div>

                  {/* Col 4: Expense Budget & Progress Bar */}
                  <div className="lg:col-span-3 space-y-1.5">
                    {isInlineEditing ? (
                      /* Inline Budget Editor Form */
                      <div className="flex items-center gap-2 p-2 bg-blue-50/80 rounded-xl border border-blue-200">
                        <span className="text-xs font-bold text-blue-900 whitespace-nowrap">Expense Budget:</span>
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                            {user.currency}
                          </span>
                          <input
                            type="number"
                            value={inlineBudgetValue}
                            onChange={(e) => setInlineBudgetValue(e.target.value)}
                            placeholder="e.g. 5000"
                            className="w-full pl-6 pr-2 py-1 text-xs font-bold bg-white border border-blue-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveInlineBudget(category.id)}
                          className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                          title="Save Budget"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInlineBudgetEditCatId(null);
                            setInlineBudgetValue('');
                          }}
                          className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : hasBudget ? (
                      /* Category has an Expense Budget Limit set */
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-baseline gap-1">
                            <span className="font-extrabold text-slate-900 privacy-value">
                              {user.currency}{debitedAmount.toLocaleString('en-IN')}
                            </span>
                            <span className="text-slate-600 text-[11px] privacy-value">
                              / {user.currency}{budget.toLocaleString('en-IN')}
                            </span>
                          </div>

                          {/* Budget Status Badge */}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            isOver 
                              ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                              : isNear 
                                ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {isOver ? (
                              <>
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>{budgetPercent.toFixed(0)}% (Over by {user.currency}{Math.abs(budgetRemaining).toLocaleString('en-IN')})</span>
                              </>
                            ) : (
                              <span>{budgetPercent.toFixed(0)}% ({user.currency}{budgetRemaining.toLocaleString('en-IN')} left)</span>
                            )}
                          </span>
                        </div>

                        {/* Progress Bar showing percentage */}
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isOver 
                                ? 'bg-rose-500' 
                                : isNear 
                                  ? 'bg-amber-500' 
                                  : 'bg-emerald-500'
                            }`}
                            style={{ width: `${clampedPercent}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      /* No Expense Budget Limit Set */
                      <div className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-[11px] text-slate-600">No expense budget set</span>
                        <button
                          type="button"
                          onClick={() => {
                            setInlineBudgetEditCatId(category.id);
                            setInlineBudgetValue('');
                          }}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Set Budget</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Col 5: Actions */}
                  <div className="lg:col-span-2 flex items-center justify-end gap-1.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    {/* Inline Budget Quick Button */}
                    {!isInlineEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setInlineBudgetEditCatId(category.id);
                          setInlineBudgetValue(category.budgetLimit ? String(category.budgetLimit) : '');
                        }}
                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                        title={hasBudget ? "Change expense budget limit" : "Set expense budget limit"}
                      >
                        <Target className="w-4 h-4" />
                      </button>
                    )}

                    {/* Edit Category Details */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(category)}
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
                      title="Edit Category Details"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Delete Category */}
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteModal(category)}
                      className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                      title="Delete Category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No categories found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || activityFilter !== 'all' 
                ? 'Try adjusting your search terms or active filters.'
                : 'Get started by creating your first category.'}
            </p>
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 transition"
            >
              Add New Category
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Category Modal */}
      {(isAddModalOpen || editingCategory) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-2xs"
                  style={{ backgroundColor: formColor }}
                >
                  <CategoryIcon iconName={formIcon} className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingCategory ? 'Edit Category' : 'Create New Category'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Universal category for debits (expenses) and credits (income)
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingCategory(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingCategory ? handleSaveEdit : handleSaveAdd} className="space-y-4">
              {/* Category Name */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Salary, Utilities, Consulting, Marketing"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              {/* Monthly Spending Budget Limit (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Monthly Expense Budget Limit ({user.currency})
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold">Optional</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    {user.currency}
                  </span>
                  <input
                    type="number"
                    value={formBudgetLimit}
                    onChange={(e) => setFormBudgetLimit(e.target.value)}
                    placeholder="e.g. 10000 (leave blank if unbudgeted)"
                    className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Set a spending threshold to track linear progress and get over-budget warnings.
                </p>
              </div>

              {/* Color Palette */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-2">
                  Theme Color
                </label>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
                  {CATEGORY_PALETTES.map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => setFormColor(p.hex)}
                      className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 flex items-center justify-center ${
                        formColor.toUpperCase() === p.hex.toUpperCase() ? 'ring-2 ring-blue-500 ring-offset-2 scale-105' : ''
                      }`}
                      style={{ backgroundColor: p.hex }}
                      title={p.name}
                    >
                      {formColor.toUpperCase() === p.hex.toUpperCase() && (
                        <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Selector with live search */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Select Icon
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Current: <strong>{formIcon}</strong>
                  </span>
                </div>

                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                    placeholder="Search icons (e.g. food, car, cash, tech)..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-36 overflow-y-auto p-1.5 border border-slate-200 rounded-xl bg-slate-50/50 scrollbar-thin">
                  {filteredIcons.map((i) => (
                    <button
                      key={i.name}
                      type="button"
                      onClick={() => setFormIcon(i.name)}
                      className={`p-2 rounded-xl flex items-center justify-center transition ${
                        formIcon === i.name 
                          ? 'bg-blue-600 text-white shadow-xs' 
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                      }`}
                      title={i.label}
                    >
                      <CategoryIcon iconName={i.name} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingCategory(null);
                  }}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingCategory ? 'Save Changes' : 'Create Category'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Modal with Safe Reassignment */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Delete Category "{deletingCategory.name}"?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete this category?
              </p>
            </div>

            {/* If transactions exist, show reassignment selector */}
            {categoryStatsList.find(s => s.category.id === deletingCategory.id)?.totalTxCount ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <span>
                    {categoryStatsList.find(s => s.category.id === deletingCategory.id)?.totalTxCount} existing transactions in this category
                  </span>
                </div>
                <label className="block text-[11px] font-bold text-amber-900 uppercase">
                  Reassign transactions to:
                </label>
                <select
                  value={reassignTargetId}
                  onChange={(e) => setReassignTargetId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  {categories
                    .filter(c => c.id !== deletingCategory.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Categories Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Restore Default Categories?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                This will restore the standard set of default categories with their icons and colors.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onResetCategories) onResetCategories();
                  setIsResetModalOpen(false);
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95"
              >
                Restore Defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
