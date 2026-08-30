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
  Sparkles, 
  Filter, 
  RotateCcw, 
  Layers,
  AlertCircle,
  Calendar,
  Clock
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
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  user,
  categories,
  transactions,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onResetCategories,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Period / Date Range Filter state
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');

  // Form States for Add / Edit
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'expense' | 'income'>('expense');
  const [formColor, setFormColor] = useState(CATEGORY_PALETTES[0].hex);
  const [formIcon, setFormIcon] = useState('Tag');
  const [iconSearch, setIconSearch] = useState('');

  // Quick Color Picker popover state (categoryId -> open)
  const [quickColorCategoryId, setQuickColorCategoryId] = useState<string | null>(null);

  // Period-filtered transactions
  const periodTransactions = useMemo(() => {
    if (selectedPeriod === 'all') return transactions;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    return transactions.filter(tx => {
      if (!tx.date) return false;
      const txDate = new Date(tx.date);

      if (selectedPeriod === 'this_month') {
        return txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth;
      }

      if (selectedPeriod === 'last_month') {
        const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
        const lastMonthYear = lastMonthDate.getFullYear();
        const lastMonth = lastMonthDate.getMonth();
        return txDate.getFullYear() === lastMonthYear && txDate.getMonth() === lastMonth;
      }

      if (selectedPeriod === 'last_30_days') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return txDate >= thirtyDaysAgo && txDate <= now;
      }

      if (selectedPeriod === 'last_90_days') {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return txDate >= ninetyDaysAgo && txDate <= now;
      }

      if (selectedPeriod === 'this_year') {
        return txDate.getFullYear() === currentYear;
      }

      if (selectedPeriod === 'custom') {
        if (customStartDate && tx.date < customStartDate) return false;
        if (customEndDate && tx.date > customEndDate) return false;
        return true;
      }

      return true;
    });
  }, [transactions, selectedPeriod, customStartDate, customEndDate]);

  // Period summary totals
  const periodTotalVolume = useMemo(() => {
    return periodTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  }, [periodTransactions]);

  // Category usage metrics for the chosen period
  const categoryStats = useMemo(() => {
    const statsMap: Record<string, { count: number; totalAmount: number }> = {};

    categories.forEach(cat => {
      statsMap[cat.id] = { count: 0, totalAmount: 0 };
    });

    periodTransactions.forEach(tx => {
      if (tx.categoryId && statsMap[tx.categoryId]) {
        statsMap[tx.categoryId].count += 1;
        statsMap[tx.categoryId].totalAmount += tx.amount;
      }
    });

    return statsMap;
  }, [categories, periodTransactions]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter(cat => {
      const matchesType = filterType === 'all' || cat.type === filterType;
      const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [categories, filterType, searchQuery]);

  // Overall metrics
  const totalExpenseCats = categories.filter(c => c.type === 'expense').length;
  const totalIncomeCats = categories.filter(c => c.type === 'income').length;
  
  // Find top used category in the selected period
  const topUsedCategory = useMemo(() => {
    let topCat: Category | null = null;
    let maxTx = -1;
    categories.forEach(cat => {
      const stats = categoryStats[cat.id];
      if (stats && stats.count > maxTx && stats.count > 0) {
        maxTx = stats.count;
        topCat = cat;
      }
    });
    return topCat;
  }, [categories, categoryStats]);

  // Human readable period label
  const periodLabelText = useMemo(() => {
    switch (selectedPeriod) {
      case 'this_month':
        return 'This Month';
      case 'last_month':
        return 'Last Month';
      case 'last_30_days':
        return 'Last 30 Days';
      case 'last_90_days':
        return 'Last 90 Days';
      case 'this_year':
        return 'This Year';
      case 'custom':
        if (customStartDate && customEndDate) return `${customStartDate} to ${customEndDate}`;
        if (customStartDate) return `From ${customStartDate}`;
        if (customEndDate) return `Until ${customEndDate}`;
        return 'Custom Date Range';
      default:
        return 'All Time';
    }
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Open Add Modal
  const handleOpenAddModal = (defaultType?: 'expense' | 'income') => {
    setFormName('');
    setFormType(defaultType || (filterType === 'income' ? 'income' : 'expense'));
    // Pick an unused or first palette color
    const usedColors = new Set(categories.map(c => c.color.toUpperCase()));
    const availableColor = CATEGORY_PALETTES.find(p => !usedColors.has(p.hex.toUpperCase())) || CATEGORY_PALETTES[0];
    setFormColor(availableColor.hex);
    setFormIcon('Tag');
    setIconSearch('');
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormType(cat.type);
    setFormColor(cat.color);
    setFormIcon(cat.icon || 'Tag');
    setIconSearch('');
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (cat: Category) => {
    const txCount = categoryStats[cat.id]?.count || 0;
    setDeletingCategory(cat);
    if (txCount > 0) {
      const otherCat = categories.find(c => c.id !== cat.id && c.type === cat.type) || categories.find(c => c.id !== cat.id);
      setReassignTargetId(otherCat?.id || '');
    } else {
      setReassignTargetId('');
    }
  };

  // Save Add Category
  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const newCategory: Category = {
      id: `cat-${Date.now()}`,
      name: formName.trim(),
      type: formType,
      color: formColor,
      icon: formIcon,
    };

    onAddCategory(newCategory);
    setIsAddModalOpen(false);
  };

  // Save Edit Category
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !formName.trim()) return;

    onEditCategory(editingCategory.id, {
      name: formName.trim(),
      type: formType,
      color: formColor,
      icon: formIcon,
    });

    setEditingCategory(null);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!deletingCategory) return;
    onDeleteCategory(deletingCategory.id, reassignTargetId || undefined);
    setDeletingCategory(null);
  };

  // Quick Change Color directly
  const handleQuickColorChange = (categoryId: string, newColor: string) => {
    onEditCategory(categoryId, { color: newColor });
    setQuickColorCategoryId(null);
  };

  // Filtered icon list for picker
  const filteredIcons = useMemo(() => {
    if (!iconSearch.trim()) return AVAILABLE_CATEGORY_ICONS;
    return AVAILABLE_CATEGORY_ICONS.filter(i => 
      i.name.toLowerCase().includes(iconSearch.toLowerCase()) || 
      i.label.toLowerCase().includes(iconSearch.toLowerCase())
    );
  }, [iconSearch]);

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Action Toolbar */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        {onResetCategories && (
          <button
            onClick={onResetCategories}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
            title="Reset default categories"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Defaults</span>
          </button>
        )}

        <button
          onClick={() => handleOpenAddModal()}
          id="btn-add-category-main"
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-600">Total Categories</span>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">
            {categories.length}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-rose-700">Expense Categories</span>
          <div className="text-xl font-extrabold text-rose-700 mt-0.5">
            {totalExpenseCats}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-emerald-700">Income Categories</span>
          <div className="text-xl font-extrabold text-emerald-700 mt-0.5">
            {totalIncomeCats}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-600">Most Active</span>
          <div className="text-sm font-extrabold text-slate-900 mt-1 truncate flex items-center gap-1.5">
            {topUsedCategory ? (
              <>
                <span 
                  className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                  style={{ backgroundColor: topUsedCategory.color }}
                />
                <span className="truncate">{topUsedCategory.name}</span>
              </>
            ) : (
              'None'
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Left: Type Filter Pills */}
          <div className="flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 w-full sm:w-auto">
            <button
              onClick={() => setFilterType('all')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                filterType === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({categories.length})
            </button>
            <button
              onClick={() => setFilterType('expense')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                filterType === 'expense'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200/50 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Expenses ({totalExpenseCats})
            </button>
            <button
              onClick={() => setFilterType('income')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                filterType === 'income'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Income ({totalIncomeCats})
            </button>
          </div>

          {/* Right: Period Filter Dropdown & Search Input */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Period Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Period:</span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                title="Filter category transaction statistics by timeframe"
              >
                <option value="all">All Time</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="last_90_days">Last 90 Days</option>
                <option value="this_year">This Year</option>
                <option value="custom">Custom Range...</option>
              </select>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search categories..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Custom Date Range Row when 'custom' is active */}
        {selectedPeriod === 'custom' && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs animate-fadeIn">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              Custom Date Range:
            </span>
            <div className="flex items-center gap-2">
              <label className="text-slate-700">From:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-700">To:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                className="text-xs text-rose-600 hover:underline font-semibold"
              >
                Clear Range
              </button>
            )}
          </div>
        )}

        {/* Active Period Status Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100/80 text-[11px] text-slate-700 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
            <span>
              Category metrics calculated for: <strong className="text-slate-900">{periodLabelText}</strong>
            </span>
          </div>
          <div className="text-slate-700 font-semibold">
            {periodTransactions.length} transactions recorded • Total Volume: <span className="text-slate-900 font-bold">{user.currency}{periodTotalVolume.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Categories Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCategories.map((cat) => {
          const stats = categoryStats[cat.id] || { count: 0, totalAmount: 0 };
          const isQuickColorOpen = quickColorCategoryId === cat.id;

          return (
            <div
              key={cat.id}
              className="bg-white rounded-3xl border border-slate-200/90 p-4 shadow-xs hover:border-slate-300 hover:shadow-sm transition flex flex-col justify-between relative group"
            >
              {/* Top Row: Icon, Color, Type Badge, and Actions */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {/* Category Icon with Custom Color */}
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs transition-transform group-hover:scale-105"
                      style={{ 
                        backgroundColor: `${cat.color}18`, 
                        color: cat.color,
                        border: `1.5px solid ${cat.color}35`
                      }}
                    >
                      <CategoryIcon iconName={cat.icon || 'Tag'} className="w-5 h-5" />
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{cat.name}</span>
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            cat.type === 'income'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          }`}
                        >
                          {cat.type}
                        </span>

                        {/* Hex swatch badge with quick color picker click */}
                        <div className="relative">
                          <button
                            onClick={() => setQuickColorCategoryId(isQuickColorOpen ? null : cat.id)}
                            className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded-md flex items-center gap-1 transition"
                            title="Click to quickly change category color"
                          >
                            <span 
                              className="w-2.5 h-2.5 rounded-full border border-black/10 inline-block" 
                              style={{ backgroundColor: cat.color }} 
                            />
                            <span>{cat.color.toUpperCase()}</span>
                          </button>

                          {/* Quick Color Picker Popover */}
                          {isQuickColorOpen && (
                            <div className="absolute left-0 top-full mt-2 z-30 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 w-56 animate-fadeIn">
                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                                <span className="text-[11px] font-bold text-slate-700">Pick Category Color</span>
                                <button 
                                  onClick={() => setQuickColorCategoryId(null)}
                                  className="text-slate-400 hover:text-slate-600 p-0.5"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="grid grid-cols-5 gap-1.5">
                                {CATEGORY_PALETTES.map((p) => (
                                  <button
                                    key={p.hex}
                                    type="button"
                                    onClick={() => handleQuickColorChange(cat.id, p.hex)}
                                    className={`w-7 h-7 rounded-xl flex items-center justify-center transition border ${
                                      cat.color.toUpperCase() === p.hex.toUpperCase()
                                        ? 'ring-2 ring-blue-600 scale-110 shadow-xs border-white'
                                        : 'border-black/10 hover:scale-105'
                                    }`}
                                    style={{ backgroundColor: p.hex }}
                                    title={p.name}
                                  >
                                    {cat.color.toUpperCase() === p.hex.toUpperCase() && (
                                      <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                    )}
                                  </button>
                                ))}
                              </div>
                              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] text-slate-600 font-semibold">Custom</span>
                                <input
                                  type="color"
                                  value={cat.color}
                                  onChange={(e) => handleQuickColorChange(cat.id, e.target.value)}
                                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenEditModal(cat)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                      title="Edit Category"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenDeleteModal(cat)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                      title="Delete Category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Calendar Preview Sample Banner */}
                <div 
                  className="mt-3.5 p-2.5 rounded-xl border flex items-center justify-between text-xs"
                  style={{ 
                    backgroundColor: `${cat.color}10`, 
                    borderColor: `${cat.color}25`
                  }}
                >
                  <span className="text-[11px] font-semibold text-slate-700">Calendar Cell Tint:</span>
                  <div className="flex items-center gap-1 font-bold" style={{ color: cat.color }}>
                    <CategoryIcon iconName={cat.icon || 'Tag'} className="w-3.5 h-3.5" />
                    <span className="text-[11px]">{cat.name}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Transaction Count and Volume */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-medium">
                    {stats.count} {stats.count === 1 ? 'transaction' : 'transactions'}
                  </span>
                  {selectedPeriod !== 'all' && (
                    <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-1.5 py-0.2 rounded border border-blue-200/60">
                      {periodLabelText}
                    </span>
                  )}
                </div>
                <span className="font-extrabold text-slate-900">
                  {user.currency}{stats.totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCategories.length === 0 && (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
          <Layers className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No categories found</h3>
          <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
            {searchQuery ? `No categories match "${searchQuery}".` : 'Try adding your first custom category.'}
          </p>
          <button
            onClick={() => handleOpenAddModal()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-blue-700 transition"
          >
            + Add New Category
          </button>
        </div>
      )}

      {/* ADD CATEGORY MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Add New Category
              </h2>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="mt-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Groceries, Fitness & Gym, Freelance"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Type Toggle */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Category Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormType('expense')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      formType === 'expense'
                        ? 'bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-500/20 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4 text-rose-600" />
                    <span>Expense</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('income')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      formType === 'income'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                    <span>Income</span>
                  </button>
                </div>
              </div>

              {/* Color Palette Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase text-slate-600">
                    Allot Unique Color
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold" style={{ color: formColor }}>
                      {formColor.toUpperCase()}
                    </span>
                    <input
                      type="color"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                      title="Custom color"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-2xl">
                  {CATEGORY_PALETTES.map((p) => {
                    const isSelected = formColor.toUpperCase() === p.hex.toUpperCase();
                    return (
                      <button
                        key={p.hex}
                        type="button"
                        onClick={() => setFormColor(p.hex)}
                        className={`w-7 h-7 rounded-xl flex items-center justify-center transition border ${
                          isSelected
                            ? 'ring-2 ring-blue-600 scale-110 shadow-xs border-white'
                            : 'border-black/10 hover:scale-105'
                        }`}
                        style={{ backgroundColor: p.hex }}
                        title={p.name}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Icon Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase text-slate-600">
                    Category Icon
                  </label>
                  <input
                    type="text"
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                    placeholder="Search icons..."
                    className="text-xs px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg w-32 focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-2xl max-h-36 overflow-y-auto">
                  {filteredIcons.map((item) => {
                    const isSelected = formIcon === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setFormIcon(item.name)}
                        className={`p-2 rounded-xl flex flex-col items-center justify-center transition ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
                        }`}
                        title={item.label}
                      >
                        <CategoryIcon iconName={item.name} className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
                <span className="text-[10px] font-bold uppercase text-slate-600 block mb-2">Live Preview</span>
                <div 
                  className="p-3 rounded-2xl border flex items-center justify-between shadow-xs transition"
                  style={{ 
                    backgroundColor: `${formColor}15`, 
                    borderColor: `${formColor}40`
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="w-8 h-8 rounded-xl flex items-center justify-center shadow-xs"
                      style={{ backgroundColor: formColor, color: '#FFFFFF' }}
                    >
                      <CategoryIcon iconName={formIcon} className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{formName || 'Category Name'}</div>
                      <div className="text-[10px] font-semibold text-slate-600">Soft calendar day wash preview</div>
                    </div>
                  </div>

                  <span 
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                    style={{ backgroundColor: `${formColor}25`, color: formColor }}
                  >
                    {formType}
                  </span>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-3 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CATEGORY MODAL */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                Edit Category
              </h2>
              <button 
                onClick={() => setEditingCategory(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Category Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormType('expense')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      formType === 'expense'
                        ? 'bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-500/20 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4 text-rose-600" />
                    <span>Expense</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('income')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      formType === 'income'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                    <span>Income</span>
                  </button>
                </div>
              </div>

              {/* Color Palette */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase text-slate-600">
                    Category Color
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold" style={{ color: formColor }}>
                      {formColor.toUpperCase()}
                    </span>
                    <input
                      type="color"
                      value={formColor}
                      onChange={(e) => setFormColor(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                      title="Custom color"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-2xl">
                  {CATEGORY_PALETTES.map((p) => {
                    const isSelected = formColor.toUpperCase() === p.hex.toUpperCase();
                    return (
                      <button
                        key={p.hex}
                        type="button"
                        onClick={() => setFormColor(p.hex)}
                        className={`w-7 h-7 rounded-xl flex items-center justify-center transition border ${
                          isSelected
                            ? 'ring-2 ring-blue-600 scale-110 shadow-xs border-white'
                            : 'border-black/10 hover:scale-105'
                        }`}
                        style={{ backgroundColor: p.hex }}
                        title={p.name}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Icon Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase text-slate-600">
                    Category Icon
                  </label>
                  <input
                    type="text"
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                    placeholder="Search icons..."
                    className="text-xs px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg w-32 focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-2xl max-h-36 overflow-y-auto">
                  {filteredIcons.map((item) => {
                    const isSelected = formIcon === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setFormIcon(item.name)}
                        className={`p-2 rounded-xl flex flex-col items-center justify-center transition ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
                        }`}
                        title={item.label}
                      >
                        <CategoryIcon iconName={item.name} className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
                <span className="text-[10px] font-bold uppercase text-slate-600 block mb-2">Live Preview</span>
                <div 
                  className="p-3 rounded-2xl border flex items-center justify-between shadow-xs transition"
                  style={{ 
                    backgroundColor: `${formColor}15`, 
                    borderColor: `${formColor}40`
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="w-8 h-8 rounded-xl flex items-center justify-center shadow-xs"
                      style={{ backgroundColor: formColor, color: '#FFFFFF' }}
                    >
                      <CategoryIcon iconName={formIcon} className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{formName || 'Category Name'}</div>
                      <div className="text-[10px] font-semibold text-slate-600">Soft calendar day wash preview</div>
                    </div>
                  </div>

                  <span 
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                    style={{ backgroundColor: `${formColor}25`, color: formColor }}
                  >
                    {formType}
                  </span>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  Update Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION & REASSIGNMENT MODAL */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                Delete Category
              </h2>
              <button 
                onClick={() => setDeletingCategory(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-700">
                Are you sure you want to delete category <strong className="text-slate-900">"{deletingCategory.name}"</strong>?
              </p>

              {(categoryStats[deletingCategory.id]?.count || 0) > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                  <span className="text-xs font-bold text-amber-900 block">
                    ⚠️ {categoryStats[deletingCategory.id]?.count} transactions linked to this category
                  </span>
                  <p className="text-[11px] text-amber-800">
                    Select a replacement category to safely reassign existing transactions:
                  </p>
                  <select
                    value={reassignTargetId}
                    onChange={(e) => setReassignTargetId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    {categories
                      .filter(c => c.id !== deletingCategory.id)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.type})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
