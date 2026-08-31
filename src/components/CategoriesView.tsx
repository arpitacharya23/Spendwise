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
  Scale,
  CornerDownRight,
  ChevronDown,
  ChevronUp,
  FolderTree,
  Layers,
  FolderPlus,
  ListPlus,
  Tag,
  Info
} from 'lucide-react';
import { Category, Transaction, UserProfile } from '../types';
import { AVAILABLE_CATEGORY_ICONS, CATEGORY_PALETTES, CategoryIcon } from './CategoryIcon';
import { CategorySparkline, MonthlySpendPoint } from './CategorySparkline';

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

interface ComputedCategoryStats {
  category: Category;
  baseBudget: number;
  debitedAmount: number;
  debitCount: number;
  creditedAmount: number;
  creditCount: number;
  totalTxCount: number;
  netCategory: number;
  spendingTrend6M: MonthlySpendPoint[];
  budget: number;
  hasBudget: boolean;
  budgetPercent: number;
  budgetRemaining: number;
  isOver: boolean;
  isNear: boolean;
  isOnTrack: boolean;
  isUnbudgeted: boolean;
  shareOfTotalDebited: number;
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
  const [timeframeMode, setTimeframeMode] = useState<'monthly' | 'yearly' | 'all_time'>('monthly');

  // Filters & Search
  const [activityFilter, setActivityFilter] = useState<'all' | 'has_debits' | 'has_credits' | 'budgeted' | 'over_budget' | 'near_limit' | 'on_track' | 'unbudgeted'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'debited_desc' | 'credited_desc' | 'budget_desc' | 'over_percent_desc' | 'tx_desc' | 'name_asc'>('debited_desc');

  // Expanded Parent Categories (all expanded by default for instant visibility of subcategories)
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(() => {
    const mainIds = categories.filter(c => !c.parentId).map(c => c.id);
    return new Set(mainIds);
  });

  // Master Monthly Spending Budget Editing State
  const [editingMasterBudget, setEditingMasterBudget] = useState(false);
  const [masterBudgetValue, setMasterBudgetValue] = useState<string>(String(user.monthlyBudget || 50000));

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Form States for Add / Edit Modal
  const [formName, setFormName] = useState('');
  const [formParentId, setFormParentId] = useState<string>('');
  const [formColor, setFormColor] = useState(CATEGORY_PALETTES[0].hex);
  const [formIcon, setFormIcon] = useState('Tag');
  const [formBudgetLimit, setFormBudgetLimit] = useState<string>('');
  const [iconSearch, setIconSearch] = useState('');

  // Date navigation & calculation helpers
  const monthName = new Date(selectedYear, selectedMonth, 1).toLocaleString('default', { month: 'long' });
  const isCurrentMonth = today.getFullYear() === selectedYear && today.getMonth() === selectedMonth;
  const isCurrentYear = today.getFullYear() === selectedYear;

  const daysInSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const currentDayNum = isCurrentMonth ? today.getDate() : daysInSelectedMonth;
  const daysRemainingInMonth = isCurrentMonth ? Math.max(0, daysInSelectedMonth - currentDayNum) : 0;

  const endOfYear = new Date(selectedYear, 11, 31, 23, 59, 59);
  const daysRemainingInYear = isCurrentYear
    ? Math.max(0, Math.ceil((endOfYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const daysRemaining = timeframeMode === 'yearly' 
    ? daysRemainingInYear 
    : (timeframeMode === 'monthly' ? daysRemainingInMonth : 0);

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

  const handlePrevYear = () => {
    setSelectedYear(prev => prev - 1);
  };

  const handleNextYear = () => {
    setSelectedYear(prev => prev + 1);
  };

  const handleJumpToCurrentMonth = () => {
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth());
    setTimeframeMode('monthly');
  };

  const handleJumpToCurrentYear = () => {
    setSelectedYear(today.getFullYear());
    setTimeframeMode('yearly');
  };

  // Expand / Collapse toggles
  const toggleExpand = (catId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedCategoryIds(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const mainIds = categories.filter(c => !c.parentId).map(c => c.id);
    setExpandedCategoryIds(new Set(mainIds));
  };

  const collapseAll = () => {
    setExpandedCategoryIds(new Set());
  };

  // Filter transactions for the selected timeframe
  const activeTransactions = useMemo(() => {
    if (timeframeMode === 'all_time') {
      return transactions;
    }

    if (timeframeMode === 'yearly') {
      return transactions.filter(tx => {
        if (!tx.date || typeof tx.date !== 'string') return false;
        const parts = tx.date.split('-');
        if (parts.length >= 1) {
          const y = parseInt(parts[0], 10);
          return y === selectedYear;
        }
        const d = new Date(tx.date);
        return d.getFullYear() === selectedYear;
      });
    }

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
    return activeTransactions
      .filter(tx => tx.type === 'expense' || tx.type === 'emi_payment' || (tx.type === 'settlement' && tx.notes?.includes('Paid to')))
      .length;
  }, [activeTransactions]);

  const totalPeriodCreditCount = useMemo(() => {
    return activeTransactions
      .filter(tx => tx.type === 'income' || (tx.type === 'settlement' && tx.notes?.includes('Received from')))
      .length;
  }, [activeTransactions]);

  // Master Monthly Spending Budget
  const baseMonthlyBudget = user.monthlyBudget || 50000;
  const masterBudgetLimit = timeframeMode === 'yearly' ? baseMonthlyBudget * 12 : baseMonthlyBudget;
  const masterPercentage = masterBudgetLimit > 0 ? (totalPeriodDebited / masterBudgetLimit) * 100 : 0;
  const clampedMasterPercent = Math.min(Math.max(masterPercentage, 0), 100);
  const remainingMasterBudget = masterBudgetLimit - totalPeriodDebited;
  const isMasterOverBudget = masterPercentage > 100;

  // Daily spending runway
  const dailyRunway = useMemo(() => {
    if (daysRemaining <= 0) return 0;
    const remaining = Math.max(0, remainingMasterBudget);
    return Math.round(remaining / daysRemaining);
  }, [remainingMasterBudget, daysRemaining]);

  // Compute 6-Month Range for Sparkline Data Points
  const last6Months = useMemo(() => {
    const months: { monthKey: string; shortLabel: string; fullLabel: string }[] = [];
    const baseDate = new Date(selectedYear, selectedMonth, 1);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const monthKey = `${y}-${String(m).padStart(2, '0')}`;
      const shortLabel = d.toLocaleString('default', { month: 'short' });
      const fullLabel = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      months.push({ monthKey, shortLabel, fullLabel });
    }
    return months;
  }, [selectedYear, selectedMonth]);

  // Helper to compute stats for any single category ID
  const computeStatsForCategory = (cat: Category): ComputedCategoryStats => {
    const catTxs = activeTransactions.filter(tx => tx.categoryId === cat.id);

    const debitTxs = catTxs.filter(tx => tx.type === 'expense' || tx.type === 'emi_payment' || (tx.type === 'settlement' && tx.notes?.includes('Paid to')));
    const debitedAmount = debitTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const debitCount = debitTxs.length;

    const creditTxs = catTxs.filter(tx => tx.type === 'income' || (tx.type === 'settlement' && tx.notes?.includes('Received from')));
    const creditedAmount = creditTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const creditCount = creditTxs.length;

    const netCategory = creditedAmount - debitedAmount;

    // 6-Month Historical Spending Trend
    const spendingTrend6M: MonthlySpendPoint[] = last6Months.map(m => {
      const [mYear, mMon] = (m.monthKey || '').split('-').map(Number);
      const mDebit = transactions
        .filter(tx => {
          if (tx.categoryId !== cat.id) return false;
          const isDebit = tx.type === 'expense' || tx.type === 'emi_payment' || (tx.type === 'settlement' && tx.notes?.includes('Paid to'));
          if (!isDebit) return false;
          if (!tx.date || typeof tx.date !== 'string') return false;
          const parts = tx.date.split('-');
          if (parts.length >= 2) {
            const y = parseInt(parts[0], 10);
            const mon = parseInt(parts[1], 10);
            return y === mYear && mon === mMon;
          }
          const d = new Date(tx.date);
          return d.getFullYear() === mYear && (d.getMonth() + 1) === mMon;
        })
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);

      return {
        monthKey: m.monthKey,
        shortLabel: m.shortLabel,
        fullLabel: m.fullLabel,
        amount: mDebit,
      };
    });

    const baseBudget = cat.budgetLimit || 0;
    const budget = timeframeMode === 'yearly' ? baseBudget * 12 : baseBudget;
    const hasBudget = baseBudget > 0;
    const budgetPercent = hasBudget && budget > 0 ? (debitedAmount / budget) * 100 : 0;
    const budgetRemaining = hasBudget ? budget - debitedAmount : 0;
    const isOver = hasBudget && debitedAmount > budget;
    const isNear = hasBudget && budgetPercent >= 75 && budgetPercent <= 100;
    const isOnTrack = hasBudget && budgetPercent < 75;
    const isUnbudgeted = !hasBudget;

    const shareOfTotalDebited = totalPeriodDebited > 0
      ? (debitedAmount / totalPeriodDebited) * 100
      : 0;

    return {
      category: cat,
      baseBudget,
      debitedAmount,
      debitCount,
      creditedAmount,
      creditCount,
      totalTxCount: catTxs.length,
      netCategory,
      spendingTrend6M,
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
  };

  // Map of all computed stats by category ID
  const allCategoryStatsMap = useMemo(() => {
    const map = new Map<string, ComputedCategoryStats>();
    categories.forEach(cat => {
      map.set(cat.id, computeStatsForCategory(cat));
    });
    return map;
  }, [categories, activeTransactions, transactions, totalPeriodDebited, timeframeMode, last6Months]);

  // Top level categories and their subcategories hierarchy structure
  const hierarchicalCategories = useMemo(() => {
    const topLevel = categories.filter(c => !c.parentId);
    const orphanSubs = categories.filter(c => c.parentId && !categories.some(p => p.id === c.parentId));

    return [...topLevel, ...orphanSubs].map(parent => {
      const parentStats = allCategoryStatsMap.get(parent.id) || computeStatsForCategory(parent);
      const subcategories = categories.filter(c => c.parentId === parent.id);
      const subStatsList = subcategories.map(sub => allCategoryStatsMap.get(sub.id) || computeStatsForCategory(sub));

      // Roll up total debits, credits, and transaction counts across parent + subcategories
      const totalCombinedDebited = parentStats.debitedAmount + subStatsList.reduce((sum, s) => sum + s.debitedAmount, 0);
      const totalCombinedCredited = parentStats.creditedAmount + subStatsList.reduce((sum, s) => sum + s.creditedAmount, 0);
      const totalCombinedDebitCount = parentStats.debitCount + subStatsList.reduce((sum, s) => sum + s.debitCount, 0);
      const totalCombinedCreditCount = parentStats.creditCount + subStatsList.reduce((sum, s) => sum + s.creditCount, 0);
      const totalCombinedTxCount = parentStats.totalTxCount + subStatsList.reduce((sum, s) => sum + s.totalTxCount, 0);

      // Combined 6M sparkline
      const combinedSpendingTrend6M: MonthlySpendPoint[] = last6Months.map((m, idx) => {
        const parentAmount = parentStats.spendingTrend6M[idx]?.amount || 0;
        const subAmounts = subStatsList.reduce((sum, s) => sum + (s.spendingTrend6M[idx]?.amount || 0), 0);
        return {
          monthKey: m.monthKey,
          shortLabel: m.shortLabel,
          fullLabel: m.fullLabel,
          amount: parentAmount + subAmounts,
        };
      });

      // Budget calculation
      const combinedBudget = parentStats.budget + subStatsList.reduce((sum, s) => sum + s.budget, 0);
      const hasCombinedBudget = parentStats.hasBudget || subStatsList.some(s => s.hasBudget);
      const combinedBudgetPercent = hasCombinedBudget && combinedBudget > 0 ? (totalCombinedDebited / combinedBudget) * 100 : 0;
      const combinedBudgetRemaining = hasCombinedBudget ? combinedBudget - totalCombinedDebited : 0;
      const isCombinedOver = hasCombinedBudget && totalCombinedDebited > combinedBudget;
      const isCombinedNear = hasCombinedBudget && combinedBudgetPercent >= 75 && combinedBudgetPercent <= 100;
      const isCombinedOnTrack = hasCombinedBudget && combinedBudgetPercent < 75;
      const isCombinedUnbudgeted = !hasCombinedBudget;

      const combinedShareOfTotal = totalPeriodDebited > 0
        ? (totalCombinedDebited / totalPeriodDebited) * 100
        : 0;

      return {
        parent,
        parentStats,
        subcategories,
        subStatsList,
        totalCombinedDebited,
        totalCombinedCredited,
        totalCombinedDebitCount,
        totalCombinedCreditCount,
        totalCombinedTxCount,
        combinedSpendingTrend6M,
        combinedBudget,
        hasCombinedBudget,
        combinedBudgetPercent,
        combinedBudgetRemaining,
        isCombinedOver,
        isCombinedNear,
        isCombinedOnTrack,
        isCombinedUnbudgeted,
        combinedShareOfTotal,
      };
    });
  }, [categories, allCategoryStatsMap, totalPeriodDebited, last6Months]);

  // Master allocation metrics
  const totalAllocatedBudget = useMemo(() => {
    return Array.from(allCategoryStatsMap.values()).reduce((sum: number, s: ComputedCategoryStats) => sum + s.budget, 0);
  }, [allCategoryStatsMap]);

  const unallocatedBudget = masterBudgetLimit - totalAllocatedBudget;

  // Filter Counts
  const allStatsList = useMemo(() => Array.from(allCategoryStatsMap.values()), [allCategoryStatsMap]);
  const hasDebitsCount = allStatsList.filter(s => s.debitedAmount > 0).length;
  const hasCreditsCount = allStatsList.filter(s => s.creditedAmount > 0).length;
  const budgetedCategoriesCount = allStatsList.filter(s => s.hasBudget).length;
  const overBudgetCount = allStatsList.filter(s => s.isOver).length;
  const nearLimitCount = allStatsList.filter(s => s.isNear).length;
  const onTrackCount = allStatsList.filter(s => s.isOnTrack).length;
  const unbudgetedCount = allStatsList.filter(s => s.isUnbudgeted).length;

  // Filtered and Sorted Hierarchical Categories
  const filteredAndSortedGroups = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();

    let groups = hierarchicalCategories.filter(group => {
      // Search Matching: matches parent name OR any child subcategory name
      let searchMatched = true;
      if (q) {
        const parentMatch = group.parent.name.toLowerCase().includes(q);
        const subMatch = group.subcategories.some(sub => sub.name.toLowerCase().includes(q));
        searchMatched = parentMatch || subMatch;
      }
      if (!searchMatched) return false;

      // Activity Filter
      if (activityFilter === 'has_debits' && group.totalCombinedDebited <= 0) return false;
      if (activityFilter === 'has_credits' && group.totalCombinedCredited <= 0) return false;
      if (activityFilter === 'budgeted' && !group.hasCombinedBudget) return false;
      if (activityFilter === 'over_budget' && !group.isCombinedOver) return false;
      if (activityFilter === 'near_limit' && !group.isCombinedNear) return false;
      if (activityFilter === 'on_track' && !group.isCombinedOnTrack) return false;
      if (activityFilter === 'unbudgeted' && !group.isCombinedUnbudgeted) return false;

      return true;
    });

    // Sorting
    groups.sort((a, b) => {
      if (sortBy === 'debited_desc') {
        return b.totalCombinedDebited - a.totalCombinedDebited;
      }
      if (sortBy === 'credited_desc') {
        return b.totalCombinedCredited - a.totalCombinedCredited;
      }
      if (sortBy === 'budget_desc') {
        return b.combinedBudget - a.combinedBudget;
      }
      if (sortBy === 'over_percent_desc') {
        return b.combinedBudgetPercent - a.combinedBudgetPercent;
      }
      if (sortBy === 'tx_desc') {
        return b.totalCombinedTxCount - a.totalCombinedTxCount;
      }
      if (sortBy === 'name_asc') {
        return a.parent.name.localeCompare(b.parent.name);
      }
      return 0;
    });

    return groups;
  }, [hierarchicalCategories, activityFilter, searchQuery, sortBy]);

  // Open Add Modal
  const handleOpenAddModal = (parentId?: string) => {
    setFormName('');
    setFormParentId(parentId || '');

    if (parentId) {
      const parentCat = categories.find(c => c.id === parentId);
      if (parentCat) {
        setFormColor(parentCat.color);
      }
    } else {
      const usedColors = new Set(categories.map(c => c.color.toUpperCase()));
      const availableColor = CATEGORY_PALETTES.find(p => !usedColors.has(p.hex.toUpperCase())) || CATEGORY_PALETTES[0];
      setFormColor(availableColor.hex);
    }

    setFormIcon('Tag');
    setFormBudgetLimit('');
    setIconSearch('');
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (cat: Category, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormParentId(cat.parentId || '');
    setFormColor(cat.color);
    setFormIcon(cat.icon || 'Tag');
    setFormBudgetLimit(cat.budgetLimit ? String(cat.budgetLimit) : '');
    setIconSearch('');
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (cat: Category, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const stats = allCategoryStatsMap.get(cat.id);
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
      type: 'expense',
      parentId: formParentId ? formParentId : undefined,
      budgetLimit: parsedBudget && parsedBudget > 0 ? parsedBudget : undefined
    };

    onAddCategory(newCategory);

    // Auto expand parent if adding a subcategory
    if (formParentId) {
      setExpandedCategoryIds(prev => new Set(prev).add(formParentId));
    }

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
      parentId: formParentId ? formParentId : undefined,
      budgetLimit: parsedBudget && parsedBudget > 0 ? parsedBudget : undefined
    });

    if (formParentId) {
      setExpandedCategoryIds(prev => new Set(prev).add(formParentId));
    }

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

  // Filtered icon list for modal
  const filteredIcons = useMemo(() => {
    const q = (iconSearch || '').trim().toLowerCase();
    if (!q) return AVAILABLE_CATEGORY_ICONS;
    return AVAILABLE_CATEGORY_ICONS.filter(i => 
      (i.name || '').toLowerCase().includes(q) || 
      (i.label || '').toLowerCase().includes(q)
    );
  }, [iconSearch]);

  // Main top level categories available for parent dropdown
  const topLevelCategoryOptions = useMemo(() => {
    return categories.filter(c => !c.parentId && (!editingCategory || c.id !== editingCategory.id));
  }, [categories, editingCategory]);

  return (
    <div className="space-y-6 pb-16 animate-fadeIn">
      {/* Top Bar: Timeframe Navigation & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-wrap">
        {/* Left: Timeframe / Month / Year Navigation */}
        <div className="flex items-center gap-2 flex-wrap">
          {timeframeMode === 'monthly' && (
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-bold text-slate-800 min-w-[130px] text-center">
                {monthName} {selectedYear}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {timeframeMode === 'yearly' && (
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
              <button
                onClick={handlePrevYear}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Previous Year"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-bold text-slate-800 min-w-[90px] text-center">
                Year {selectedYear}
              </span>
              <button
                onClick={handleNextYear}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                title="Next Year"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Quick Jump Buttons */}
          {timeframeMode === 'monthly' && !isCurrentMonth && (
            <button
              onClick={handleJumpToCurrentMonth}
              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold transition border border-blue-200 cursor-pointer"
            >
              Current Month
            </button>
          )}

          {timeframeMode === 'yearly' && !isCurrentYear && (
            <button
              onClick={handleJumpToCurrentYear}
              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold transition border border-blue-200 cursor-pointer"
            >
              Current Year
            </button>
          )}

          {/* Timeframe Scope Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setTimeframeMode('monthly')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                timeframeMode === 'monthly'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setTimeframeMode('yearly')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                timeframeMode === 'yearly'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Yearly
            </button>
            <button
              onClick={() => setTimeframeMode('all_time')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                timeframeMode === 'all_time'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Right Actions: Add Category, Reset, Expand All */}
        <div className="flex items-center gap-2">
          {onResetCategories && (
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-semibold transition border border-slate-200 flex items-center gap-1.5 cursor-pointer"
              title="Reset to default categories"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Defaults</span>
            </button>
          )}

          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={expandAll}
              className="px-2 py-1.5 text-[11px] font-bold text-slate-700 hover:text-slate-900 hover:bg-white rounded-lg transition cursor-pointer"
              title="Expand all subcategory groups"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-2 py-1.5 text-[11px] font-bold text-slate-700 hover:text-slate-900 hover:bg-white rounded-lg transition cursor-pointer"
              title="Collapse all subcategory groups"
            >
              Collapse All
            </button>
          </div>

          <button
            onClick={() => handleOpenAddModal()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Category</span>
          </button>
        </div>
      </div>

      {/* Monthly Budget Allocation Strip & Summary Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
        {/* Header & Budget Setting */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {timeframeMode === 'monthly' ? 'Monthly Master Budget' : (timeframeMode === 'yearly' ? 'Yearly Master Budget' : 'All-Time Spending Target')}
              </span>
              {!editingMasterBudget && (
                <button
                  onClick={() => {
                    setMasterBudgetValue(String(user.monthlyBudget || 50000));
                    setEditingMasterBudget(true);
                  }}
                  className="p-1 text-slate-400 hover:text-blue-600 rounded-lg transition cursor-pointer"
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
                  className="p-1.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition cursor-pointer"
                  title="Save Monthly Limit"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMasterBudget(false)}
                  className="p-1.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition cursor-pointer"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight privacy-value">
                  {user.currency}{masterBudgetLimit.toLocaleString('en-IN')}
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  {timeframeMode === 'monthly' && `limit for ${monthName} ${selectedYear}`}
                  {timeframeMode === 'yearly' && `limit for ${selectedYear} (${user.currency}${baseMonthlyBudget.toLocaleString('en-IN')}/mo × 12)`}
                  {timeframeMode === 'all_time' && 'all-time spending aggregate'}
                </span>
              </div>
            )}
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
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
                {daysRemaining > 0 
                  ? `for ${daysRemaining} days left in ${timeframeMode === 'yearly' ? selectedYear : monthName}` 
                  : (timeframeMode === 'all_time' ? 'All-time aggregate' : 'Period ended')}
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
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-slate-600 flex-wrap">
            <span className="font-semibold">
              Category Budgets: <strong className="text-slate-900">{user.currency}{totalAllocatedBudget.toLocaleString('en-IN')}</strong> allocated
            </span>
            <span className="text-slate-300">•</span>
            <span className={`font-semibold ${unallocatedBudget < 0 ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
              {unallocatedBudget >= 0 
                ? `${user.currency}${unallocatedBudget.toLocaleString('en-IN')} unallocated` 
                : `${user.currency}${Math.abs(unallocatedBudget).toLocaleString('en-IN')} over-allocated`}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {overBudgetCount > 0 && (
              <button
                onClick={() => setActivityFilter('over_budget')}
                className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:bg-rose-100 transition"
              >
                <AlertTriangle className="w-3 h-3" />
                <span>{overBudgetCount} over budget</span>
              </button>
            )}
            {nearLimitCount > 0 && (
              <button
                onClick={() => setActivityFilter('near_limit')}
                className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:bg-amber-100 transition"
              >
                <AlertCircle className="w-3 h-3" />
                <span>{nearLimitCount} near limit (75%+)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
        {/* Row 1: Search & Sorting */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search category or subcategory name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="debited_desc">Debited (Spent: High to Low)</option>
              <option value="credited_desc">Credited (Income: High to Low)</option>
              <option value="budget_desc">Budget Limit (High to Low)</option>
              <option value="over_percent_desc">Budget Usage (% High to Low)</option>
              <option value="tx_desc">Activity (Most Transactions)</option>
              <option value="name_asc">Alphabetical (A - Z)</option>
            </select>
          </div>
        </div>

        {/* Row 2: Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setActivityFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
              activityFilter === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({categories.length})
          </button>

          <button
            onClick={() => setActivityFilter('has_debits')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
              activityFilter === 'has_debits'
                ? 'bg-rose-600 text-white font-bold shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            With Debits ({hasDebitsCount})
          </button>

          <button
            onClick={() => setActivityFilter('has_credits')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
              activityFilter === 'has_credits'
                ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            With Income ({hasCreditsCount})
          </button>

          <button
            onClick={() => setActivityFilter('budgeted')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
              activityFilter === 'budgeted'
                ? 'bg-blue-600 text-white font-bold shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Budgeted ({budgetedCategoriesCount})
          </button>

          <button
            onClick={() => setActivityFilter('over_budget')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
              activityFilter === 'over_budget'
                ? 'bg-rose-700 text-white font-bold shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Over Budget ({overBudgetCount})
          </button>

          <button
            onClick={() => setActivityFilter('near_limit')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
              activityFilter === 'near_limit'
                ? 'bg-amber-600 text-white font-bold shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Near Limit ({nearLimitCount})
          </button>

          <button
            onClick={() => setActivityFilter('on_track')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
              activityFilter === 'on_track'
                ? 'bg-emerald-700 text-white font-bold shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            On Track ({onTrackCount})
          </button>

          <button
            onClick={() => setActivityFilter('unbudgeted')}
            className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition cursor-pointer ${
              activityFilter === 'unbudgeted'
                ? 'bg-slate-700 text-white font-bold shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            No Limit ({unbudgetedCount})
          </button>
        </div>
      </div>

      {/* Categories & Subcategories Hierarchical List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Desktop Table Header */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-6 py-3.5 bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
          <div className="col-span-4">Category & Subcategories</div>
          <div className="col-span-3 text-right">Debited & 6M Trend</div>
          <div className="col-span-2 text-right">Credited (Inflow)</div>
          <div className="col-span-3">Expense Budget & Progress</div>
        </div>

        {/* Group Rows */}
        {filteredAndSortedGroups.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredAndSortedGroups.map((group) => {
              const {
                parent,
                parentStats,
                subcategories,
                subStatsList,
                totalCombinedDebited,
                totalCombinedCredited,
                totalCombinedDebitCount,
                totalCombinedCreditCount,
                totalCombinedTxCount,
                combinedSpendingTrend6M,
                combinedBudget,
                hasCombinedBudget,
                combinedBudgetPercent,
                combinedBudgetRemaining,
                isCombinedOver,
                isCombinedNear,
                combinedShareOfTotal
              } = group;

              const isExpanded = expandedCategoryIds.has(parent.id);
              const clampedPercent = Math.min(Math.max(combinedBudgetPercent, 0), 100);

              return (
                <div key={parent.id} className="p-3 sm:p-4 hover:bg-slate-50/60 transition-colors space-y-2">
                  {/* MAIN CATEGORY ROW */}
                  <div 
                    onClick={() => handleOpenEditModal(parent)}
                    className="p-3 sm:p-4 rounded-2xl bg-white hover:bg-blue-50/50 border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all flex flex-col lg:grid lg:grid-cols-12 gap-3.5 lg:gap-4 items-stretch lg:items-center relative group cursor-pointer"
                  >
                    {/* Col 1: Expand Button, Icon, Name & Subcategory Count Badge */}
                    <div className="lg:col-span-4 flex items-center gap-3 min-w-0">
                      {/* Expand / Collapse Chevron */}
                      {subcategories.length > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => toggleExpand(parent.id, e)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer flex-shrink-0"
                          title={isExpanded ? 'Collapse subcategories' : 'Expand subcategories'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-blue-600 stroke-[2.5]" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-500 stroke-[2.5]" />
                          )}
                        </button>
                      ) : (
                        <div className="w-6 h-6 flex-shrink-0" />
                      )}

                      {/* Main Category Icon */}
                      <div 
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-2xs flex-shrink-0 group-hover:scale-105 transition-transform"
                        style={{ backgroundColor: parent.color }}
                      >
                        <CategoryIcon iconName={parent.icon || 'Tag'} className="w-5 h-5" />
                      </div>

                      {/* Name & Hierarchy Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                            {parent.name}
                          </span>

                          {subcategories.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                              {subcategories.length} {subcategories.length === 1 ? 'sub-category' : 'sub-categories'}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {totalCombinedTxCount > 0 ? (
                            <span>{totalCombinedTxCount} total {totalCombinedTxCount === 1 ? 'txn' : 'txns'}</span>
                          ) : (
                            <span>No transactions</span>
                          )}
                          {totalCombinedDebited > 0 && combinedShareOfTotal > 0 && (
                            <span className="text-slate-600 ml-1.5 font-medium">({combinedShareOfTotal.toFixed(1)}% of total spend)</span>
                          )}
                        </p>
                      </div>

                      {/* Quick Add Subcategory Trigger inside parent row */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddModal(parent.id);
                        }}
                        className="hidden sm:flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition opacity-80 group-hover:opacity-100 flex-shrink-0 cursor-pointer"
                        title={`Add subcategory under ${parent.name}`}
                      >
                        <Plus className="w-3 h-3 stroke-[2.5]" />
                        <span>Sub</span>
                      </button>
                    </div>

                    {/* Col 2: Debited & 6M Sparkline */}
                    <div className="lg:col-span-3 flex lg:flex-row items-center justify-between lg:justify-end gap-3 text-xs">
                      <span className="lg:hidden text-slate-600 font-medium">Debited & Trend:</span>
                      <div className="flex items-center gap-3">
                        <CategorySparkline 
                          data={combinedSpendingTrend6M} 
                          color={parent.color || '#3B82F6'} 
                          currency={user.currency}
                          width={64}
                          height={24}
                        />

                        <div className="text-right">
                          <span className="text-sm font-extrabold text-slate-900 block privacy-value">
                            {totalCombinedDebited > 0 ? `${user.currency}${totalCombinedDebited.toLocaleString('en-IN')}` : `${user.currency}0`}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold block">
                            {totalCombinedDebitCount} {totalCombinedDebitCount === 1 ? 'debit txn' : 'debit txns'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Col 3: Credited */}
                    <div className="lg:col-span-2 flex lg:flex-col items-center lg:items-end justify-between text-xs">
                      <span className="lg:hidden text-slate-600 font-medium">Credited:</span>
                      <div className="text-right">
                        <span className={`text-sm font-extrabold block privacy-value ${
                          totalCombinedCredited > 0 ? 'text-emerald-700' : 'text-slate-500'
                        }`}>
                          {totalCombinedCredited > 0 ? `+${user.currency}${totalCombinedCredited.toLocaleString('en-IN')}` : `${user.currency}0`}
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold block">
                          {totalCombinedCreditCount} {totalCombinedCreditCount === 1 ? 'credit txn' : 'credit txns'}
                        </span>
                      </div>
                    </div>

                    {/* Col 4: Budget Progress */}
                    <div className="lg:col-span-3 space-y-1.5">
                      {hasCombinedBudget ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-baseline gap-1 flex-wrap">
                              <span className="font-extrabold text-slate-900 privacy-value">
                                {user.currency}{totalCombinedDebited.toLocaleString('en-IN')}
                              </span>
                              <span className="text-slate-500 text-[11px] privacy-value">
                                / {user.currency}{combinedBudget.toLocaleString('en-IN')}
                              </span>
                            </div>

                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              isCombinedOver 
                                ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                : isCombinedNear 
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {isCombinedOver ? (
                                <>
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>{combinedBudgetPercent.toFixed(0)}% (Over by {user.currency}{Math.abs(combinedBudgetRemaining).toLocaleString('en-IN')})</span>
                                </>
                              ) : (
                                <span>{combinedBudgetPercent.toFixed(0)}% ({user.currency}{combinedBudgetRemaining.toLocaleString('en-IN')} left)</span>
                              )}
                            </span>
                          </div>

                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isCombinedOver 
                                  ? 'bg-rose-500' 
                                  : isCombinedNear 
                                    ? 'bg-amber-500' 
                                    : 'bg-emerald-500'
                              }`}
                              style={{ width: `${clampedPercent}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs py-1">
                          <span className="text-[11px] text-slate-500 font-medium">No budget limit set</span>
                          <span className="text-[11px] font-semibold text-blue-600 group-hover:text-blue-700 flex items-center gap-0.5">
                            <span>Set limit</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* INDENTED SUB-CATEGORIES SECTION */}
                  {isExpanded && subcategories.length > 0 && (
                    <div className="ml-6 sm:ml-12 border-l-2 border-slate-200/90 pl-3 sm:pl-5 space-y-2 py-1">
                      {subStatsList.map((subStat) => {
                        const {
                          category: subCat,
                          debitedAmount: subDebited,
                          debitCount: subDebitCount,
                          creditedAmount: subCredited,
                          creditCount: subCreditCount,
                          totalTxCount: subTxCount,
                          spendingTrend6M: subTrend,
                          budget: subBudget,
                          hasBudget: subHasBudget,
                          budgetPercent: subBudgetPercent,
                          budgetRemaining: subBudgetRemaining,
                          isOver: subIsOver,
                          isNear: subIsNear,
                        } = subStat;

                        const subClampedPercent = Math.min(Math.max(subBudgetPercent, 0), 100);

                        return (
                          <div
                            key={subCat.id}
                            onClick={() => handleOpenEditModal(subCat)}
                            className="p-3 rounded-2xl bg-slate-50/80 hover:bg-blue-50/60 border border-slate-200/70 transition-all flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:gap-4 items-stretch lg:items-center relative group/sub cursor-pointer shadow-2xs"
                          >
                            {/* Col 1: Branch Connector, Subcategory Icon, Name */}
                            <div className="lg:col-span-4 flex items-center gap-2.5 min-w-0">
                              <CornerDownRight className="w-4 h-4 text-slate-400 flex-shrink-0 stroke-[2]" />

                              {/* Subcategory Icon (slightly smaller) */}
                              <div 
                                className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-2xs flex-shrink-0 group-hover/sub:scale-105 transition-transform"
                                style={{ backgroundColor: subCat.color || parent.color }}
                              >
                                <CategoryIcon iconName={subCat.icon || 'Tag'} className="w-4 h-4" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-800 group-hover/sub:text-blue-700 transition-colors truncate">
                                    {subCat.name}
                                  </span>
                                  <span className="text-[10px] font-semibold text-slate-600 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                                    sub
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-500 block">
                                  {subTxCount} {subTxCount === 1 ? 'transaction' : 'transactions'}
                                </span>
                              </div>
                            </div>

                            {/* Col 2: Subcategory Debited & Sparkline */}
                            <div className="lg:col-span-3 flex lg:flex-row items-center justify-between lg:justify-end gap-2.5 text-xs">
                              <span className="lg:hidden text-slate-500 font-medium text-[11px]">Debited:</span>
                              <div className="flex items-center gap-2.5">
                                <CategorySparkline 
                                  data={subTrend} 
                                  color={subCat.color || parent.color || '#3B82F6'} 
                                  currency={user.currency}
                                  width={52}
                                  height={20}
                                />

                                <div className="text-right">
                                  <span className="text-xs font-bold text-slate-900 block privacy-value">
                                    {subDebited > 0 ? `${user.currency}${subDebited.toLocaleString('en-IN')}` : `${user.currency}0`}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-medium block">
                                    {subDebitCount} debits
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Col 3: Subcategory Credited */}
                            <div className="lg:col-span-2 flex lg:flex-col items-center lg:items-end justify-between text-xs">
                              <span className="lg:hidden text-slate-500 font-medium text-[11px]">Credited:</span>
                              <div className="text-right">
                                <span className={`text-xs font-bold block privacy-value ${
                                  subCredited > 0 ? 'text-emerald-700' : 'text-slate-500'
                                }`}>
                                  {subCredited > 0 ? `+${user.currency}${subCredited.toLocaleString('en-IN')}` : `${user.currency}0`}
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium block">
                                  {subCreditCount} credits
                                </span>
                              </div>
                            </div>

                            {/* Col 4: Subcategory Budget Progress */}
                            <div className="lg:col-span-3">
                              {subHasBudget ? (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-bold text-slate-800 privacy-value">
                                      {user.currency}{subDebited.toLocaleString('en-IN')} / {user.currency}{subBudget.toLocaleString('en-IN')}
                                    </span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                                      subIsOver 
                                        ? 'bg-rose-50 text-rose-700' 
                                        : subIsNear 
                                          ? 'bg-amber-50 text-amber-800' 
                                          : 'bg-emerald-50 text-emerald-700'
                                    }`}>
                                      {subBudgetPercent.toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        subIsOver 
                                          ? 'bg-rose-500' 
                                          : subIsNear 
                                            ? 'bg-amber-500' 
                                            : 'bg-emerald-500'
                                      }`}
                                      style={{ width: `${subClampedPercent}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                                  <span>Part of parent budget</span>
                                  <span className="text-blue-600 text-[10px] font-semibold hover:underline">
                                    Set limit
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Direct button to add subcategory under this parent */}
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal(parent.id)}
                        className="w-full py-2 px-3 border border-dashed border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50/50 rounded-xl text-xs font-semibold text-slate-600 hover:text-blue-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-blue-600" />
                        <span>Add Sub-category under {parent.name}</span>
                      </button>
                    </div>
                  )}
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
              onClick={() => handleOpenAddModal()}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 transition cursor-pointer"
            >
              Add New Category
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Category Details Modal */}
      {(isAddModalOpen || editingCategory) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-2xs transition-colors"
                  style={{ backgroundColor: formColor }}
                >
                  <CategoryIcon iconName={formIcon} className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingCategory ? `Category Details: ${editingCategory.name}` : (formParentId ? 'Create New Sub-category' : 'Create New Category')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingCategory ? 'Edit name, parent hierarchy, budget limit or appearance' : 'Universal category for debits (expenses) and credits (income)'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingCategory(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Performance Overview Banner (when editing an existing category) */}
            {editingCategory && (() => {
              const activeStats = allCategoryStatsMap.get(editingCategory.id);
              if (!activeStats) return null;
              return (
                <div className="bg-slate-50/90 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <span>
                      {timeframeMode === 'monthly' ? `${monthName} ${selectedYear}` : (timeframeMode === 'yearly' ? `Year ${selectedYear}` : 'All-Time')} Overview
                    </span>
                    <span className="text-slate-500 font-semibold lowercase">
                      {activeStats.totalTxCount} {activeStats.totalTxCount === 1 ? 'transaction' : 'transactions'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-500 block font-semibold">Debited (Spent)</span>
                      <span className="text-sm font-extrabold text-slate-900 block mt-0.5">
                        {user.currency}{activeStats.debitedAmount.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {activeStats.debitCount} debit txns
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-500 block font-semibold">Credited (Income)</span>
                      <span className="text-sm font-extrabold text-emerald-700 block mt-0.5">
                        +{user.currency}{activeStats.creditedAmount.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {activeStats.creditCount} credit txns
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 block font-semibold">6-Mo Trend</span>
                        <span className="text-[11px] font-extrabold text-slate-700 block mt-0.5">
                          {activeStats.netCategory >= 0 ? `+${user.currency}${activeStats.netCategory.toLocaleString('en-IN')}` : `-${user.currency}${Math.abs(activeStats.netCategory).toLocaleString('en-IN')}`}
                        </span>
                      </div>
                      <div className="mt-1">
                        <CategorySparkline 
                          data={activeStats.spendingTrend6M} 
                          color={formColor} 
                          currency={user.currency}
                          width={68}
                          height={20}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

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
                  placeholder="e.g. Groceries, Restaurants, Rent, Fuel"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              {/* Hierarchy: Parent Category Selector */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Category Hierarchy
                </label>
                <select
                  value={formParentId}
                  onChange={(e) => {
                    const newParentId = e.target.value;
                    setFormParentId(newParentId);
                    if (newParentId) {
                      const parent = categories.find(c => c.id === newParentId);
                      if (parent) setFormColor(parent.color);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Top-Level Category (Main / Parent)</option>
                  {topLevelCategoryOptions.map(p => (
                    <option key={p.id} value={p.id}>
                      Sub-category of: {p.name}
                    </option>
                  ))}
                </select>
                {formParentId && (
                  <p className="text-[11px] text-blue-600 font-medium mt-1 flex items-center gap-1">
                    <CornerDownRight className="w-3.5 h-3.5 text-blue-500" />
                    <span>Will be displayed indented under <strong>{categories.find(c => c.id === formParentId)?.name}</strong></span>
                  </p>
                )}
              </div>

              {/* Monthly Spending Budget Limit */}
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
                    placeholder="e.g. 10000 (leave blank for unbudgeted)"
                    className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Quick Budget Limit Presets */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Presets:</span>
                  <button
                    type="button"
                    onClick={() => setFormBudgetLimit('')}
                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      !formBudgetLimit ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    No Limit
                  </button>
                  {[2000, 5000, 10000, 20000, 50000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFormBudgetLimit(String(val))}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                        formBudgetLimit === String(val) 
                          ? 'bg-blue-600 text-white shadow-2xs' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {user.currency}{val.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>

                {formBudgetLimit && Number(formBudgetLimit) > 0 && (
                  <p className="text-[11px] text-blue-600 font-medium mt-1.5 flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    <span>Annual spending limit: {user.currency}{(Number(formBudgetLimit) * 12).toLocaleString('en-IN')}/year</span>
                  </p>
                )}
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
                      className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 flex items-center justify-center cursor-pointer ${
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
                      className={`p-2 rounded-xl flex items-center justify-center transition cursor-pointer ${
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

              {/* Action Buttons & Delete Button */}
              <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-slate-100">
                {editingCategory ? (
                  <button
                    type="button"
                    onClick={() => {
                      const catToDelete = editingCategory;
                      setEditingCategory(null);
                      handleOpenDeleteModal(catToDelete);
                    }}
                    className="px-3.5 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    title="Delete this category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setEditingCategory(null);
                    }}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingCategory ? 'Save Changes' : (formParentId ? 'Create Sub-category' : 'Create Category')}</span>
                  </button>
                </div>
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

            {/* If has subcategories */}
            {categories.some(c => c.parentId === deletingCategory.id) && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  Contains child subcategories:
                </span>
                <p className="text-[11px] text-rose-700">
                  {categories.filter(c => c.parentId === deletingCategory.id).map(c => c.name).join(', ')}
                </p>
              </div>
            )}

            {/* If transactions exist, show reassignment selector */}
            {allCategoryStatsMap.get(deletingCategory.id)?.totalTxCount ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <span>
                    {allCategoryStatsMap.get(deletingCategory.id)?.totalTxCount} existing transactions in this category
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
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
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
                This will restore the standard hierarchical set of default categories and sub-categories.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onResetCategories) onResetCategories();
                  setIsResetModalOpen(false);
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
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
