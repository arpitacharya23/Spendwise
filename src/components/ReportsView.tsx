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
  LineChart,
  Line,
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
  AlertCircle,
  Activity,
  Check,
  CalendarRange,
  RotateCcw,
  Clock
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

export type TimelinePreset = 'all' | 'this_month' | '1m' | '3m' | '6m' | '1y' | 'custom';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#EF4444', '#64748B', '#F97316', '#14B8A6'];

// Helper to format Date to YYYY-MM-DD
const formatDateToISO = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Helper to format readable display date
const formatReadableDate = (isoStr: string): string => {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-').map(Number);
  if (!y || !m || !d) return isoStr;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

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

  // Timeline Filter State
  const [timelinePreset, setTimelinePreset] = useState<TimelinePreset>('6m');
  
  // Initialize default date range based on 6m preset
  const defaultDates = useMemo(() => {
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    return {
      start: formatDateToISO(sixMonthsAgo),
      end: formatDateToISO(today)
    };
  }, []);

  const [startDate, setStartDate] = useState<string>(defaultDates.start);
  const [endDate, setEndDate] = useState<string>(defaultDates.end);

  // Category Line Chart state
  const [trendViewMode, setTrendViewMode] = useState<'top5' | 'all' | 'custom'>('top5');
  const [customSelectedCats, setCustomSelectedCats] = useState<string[]>([]);

  // Function to apply preset dates
  const handleApplyPreset = (preset: TimelinePreset) => {
    setTimelinePreset(preset);
    const today = new Date();
    const endStr = formatDateToISO(today);

    if (preset === '1m') {
      const past = new Date(today);
      past.setDate(today.getDate() - 30);
      setStartDate(formatDateToISO(past));
      setEndDate(endStr);
    } else if (preset === '3m') {
      const past = new Date(today);
      past.setMonth(today.getMonth() - 3);
      setStartDate(formatDateToISO(past));
      setEndDate(endStr);
    } else if (preset === '6m') {
      const past = new Date(today);
      past.setMonth(today.getMonth() - 6);
      setStartDate(formatDateToISO(past));
      setEndDate(endStr);
    } else if (preset === '1y') {
      const past = new Date(today);
      past.setFullYear(today.getFullYear() - 1);
      setStartDate(formatDateToISO(past));
      setEndDate(endStr);
    } else if (preset === 'this_month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(formatDateToISO(startOfMonth));
      setEndDate(formatDateToISO(endOfMonth));
    } else if (preset === 'all') {
      if (transactions.length > 0) {
        const sortedDates = [...transactions].map(t => t.date).sort();
        setStartDate(sortedDates[0] || '2020-01-01');
        setEndDate(sortedDates[sortedDates.length - 1] > endStr ? sortedDates[sortedDates.length - 1] : endStr);
      } else {
        setStartDate('2020-01-01');
        setEndDate(endStr);
      }
    }
  };

  // Handle manual date changes
  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    setTimelinePreset('custom');
  };

  const handleEndDateChange = (newEnd: string) => {
    setEndDate(newEnd);
    setTimelinePreset('custom');
  };

  // Reset timeline filter
  const handleResetTimeline = () => {
    handleApplyPreset('all');
  };

  // 1. Filter transactions according to active timeline
  const timelineTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (timelinePreset === 'all') return true;
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      return true;
    });
  }, [transactions, timelinePreset, startDate, endDate]);

  // Calculations on timeline-filtered transactions
  const expenseTransactions = useMemo(() => {
    return timelineTransactions.filter(t => t.type === 'expense' || t.type === 'emi_payment');
  }, [timelineTransactions]);

  const incomeTransactions = useMemo(() => {
    return timelineTransactions.filter(t => t.type === 'income');
  }, [timelineTransactions]);
  
  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const netSavings = totalIncome - totalExpenses;
  
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

  // 2. Filtered Transactions for Ledger Table (from timeline-filtered transactions)
  const filteredLedger = useMemo(() => {
    return timelineTransactions.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(txSearchTerm.toLowerCase()) ||
                            (t.notes && t.notes.toLowerCase().includes(txSearchTerm.toLowerCase()));
      if (!matchesSearch) return false;

      if (txCategoryFilter !== 'all' && t.categoryId !== txCategoryFilter) return false;
      if (txTypeFilter !== 'all' && t.type !== txTypeFilter) return false;

      return true;
    });
  }, [timelineTransactions, txSearchTerm, txCategoryFilter, txTypeFilter]);

  // 3. Dynamic Cash Flow Data derived from timeline range
  const cashFlowTrendData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Determine bounds for monthly aggregation
    let startD: Date;
    let endD: Date;

    if (timelinePreset === 'all') {
      if (transactions.length > 0) {
        const sorted = [...transactions].map(t => new Date(t.date)).sort((a, b) => a.getTime() - b.getTime());
        startD = sorted[0];
        endD = new Date();
      } else {
        startD = new Date();
        startD.setMonth(startD.getMonth() - 5);
        endD = new Date();
      }
    } else {
      startD = startDate ? new Date(startDate) : new Date();
      endD = endDate ? new Date(endDate) : new Date();
    }

    // Generate monthly bins between startD and endD
    const bins: { year: number; monthIdx: number; label: string }[] = [];
    const cur = new Date(startD.getFullYear(), startD.getMonth(), 1);
    const stop = new Date(endD.getFullYear(), endD.getMonth(), 1);

    while (cur <= stop) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      bins.push({
        year: y,
        monthIdx: m,
        label: `${monthNames[m]} '${String(y).slice(-2)}`,
      });
      cur.setMonth(cur.getMonth() + 1);
    }

    // If only 1 month in bin or empty, ensure at least current view is represented
    if (bins.length === 0) {
      const now = new Date();
      bins.push({
        year: now.getFullYear(),
        monthIdx: now.getMonth(),
        label: `${monthNames[now.getMonth()]} '${String(now.getFullYear()).slice(-2)}`,
      });
    }

    return bins.map(({ year, monthIdx, label }) => {
      const mExpenses = timelineTransactions
        .filter(t => {
          const d = new Date(t.date);
          return d.getFullYear() === year && d.getMonth() === monthIdx && (t.type === 'expense' || t.type === 'emi_payment');
        })
        .reduce((sum, t) => sum + t.amount, 0);

      const mIncome = timelineTransactions
        .filter(t => {
          const d = new Date(t.date);
          return d.getFullYear() === year && d.getMonth() === monthIdx && t.type === 'income';
        })
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        month: label,
        Income: mIncome,
        Expenses: mExpenses,
      };
    });
  }, [transactions, timelineTransactions, timelinePreset, startDate, endDate]);

  // 4. Category Spending Trends adaptively calculated over active timeline
  const categoryTrendInfo = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let startD: Date;
    let endD: Date;

    if (timelinePreset === 'all') {
      if (transactions.length > 0) {
        const sorted = [...transactions].map(t => new Date(t.date)).sort((a, b) => a.getTime() - b.getTime());
        startD = sorted[0];
        endD = new Date();
      } else {
        startD = new Date();
        startD.setMonth(startD.getMonth() - 5);
        endD = new Date();
      }
    } else {
      startD = startDate ? new Date(startDate) : new Date();
      endD = endDate ? new Date(endDate) : new Date();
    }

    const monthsList: { year: number; monthIdx: number; label: string; fullLabel: string }[] = [];
    const cur = new Date(startD.getFullYear(), startD.getMonth(), 1);
    const stop = new Date(endD.getFullYear(), endD.getMonth(), 1);

    while (cur <= stop) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      const label = `${monthNames[m]} '${String(y).slice(-2)}`;
      const fullLabel = `${cur.toLocaleString('default', { month: 'long' })} ${y}`;
      monthsList.push({ year: y, monthIdx: m, label, fullLabel });
      cur.setMonth(cur.getMonth() + 1);
    }

    if (monthsList.length === 0) {
      const now = new Date();
      monthsList.push({
        year: now.getFullYear(),
        monthIdx: now.getMonth(),
        label: `${monthNames[now.getMonth()]} '${String(now.getFullYear()).slice(-2)}`,
        fullLabel: `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`,
      });
    }

    const relevantTxs = timelineTransactions.filter(t => t.type === 'expense' || t.type === 'emi_payment');
    const categoryPeriodTotals: Record<string, number> = {};

    // Build data array for Recharts LineChart
    const data = monthsList.map(({ year, monthIdx, label, fullLabel }) => {
      const point: Record<string, any> = {
        month: label,
        fullMonth: fullLabel,
        total: 0,
      };

      // Initialize all known categories to 0
      categories.forEach(cat => {
        point[cat.name] = 0;
      });

      relevantTxs.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getFullYear() === year && txDate.getMonth() === monthIdx) {
          let catName = 'Other';
          if (tx.type === 'emi_payment') {
            catName = 'EMI & Loan Repayment';
          } else if (tx.categoryId) {
            const matchedCat = categories.find(c => c.id === tx.categoryId);
            if (matchedCat) catName = matchedCat.name;
          }

          point[catName] = (point[catName] || 0) + tx.amount;
          point.total += tx.amount;
          categoryPeriodTotals[catName] = (categoryPeriodTotals[catName] || 0) + tx.amount;
        }
      });

      return point;
    });

    // All categories sorted by spending in this period
    const sortedCategories = categories
      .map((cat, idx) => ({
        id: cat.id,
        name: cat.name,
        color: cat.color || COLORS[idx % COLORS.length],
        totalInPeriod: categoryPeriodTotals[cat.name] || 0,
      }))
      .sort((a, b) => b.totalInPeriod - a.totalInPeriod);

    const activeCategories = sortedCategories.filter(c => c.totalInPeriod > 0);
    const top5Categories = sortedCategories.slice(0, 5);

    // Total expenditure across all categories
    const grandPeriodTotal = data.reduce((sum, d) => sum + d.total, 0);
    const numMonths = Math.max(monthsList.length, 1);
    const averageMonthlySpend = Math.round(grandPeriodTotal / numMonths);
    
    // Find highest spending month
    let peakMonth = data[0];
    data.forEach(d => {
      if (d.total > (peakMonth?.total || 0)) {
        peakMonth = d;
      }
    });

    return {
      data,
      sortedCategories,
      activeCategories,
      top5Categories,
      grandPeriodTotal,
      averageMonthlySpend,
      peakMonth,
      categoryPeriodTotals,
      monthsCount: monthsList.length,
    };
  }, [timelineTransactions, categories, timelinePreset, startDate, endDate, transactions]);

  // Determine active lines to render on the LineChart
  const linesToRender = useMemo(() => {
    if (trendViewMode === 'top5') {
      return categoryTrendInfo.activeCategories.length > 0
        ? categoryTrendInfo.activeCategories.slice(0, 5)
        : categoryTrendInfo.top5Categories;
    }
    if (trendViewMode === 'all') {
      return categoryTrendInfo.activeCategories.length > 0
        ? categoryTrendInfo.activeCategories
        : categoryTrendInfo.sortedCategories.slice(0, 8);
    }
    // Custom selection
    const selected = categoryTrendInfo.sortedCategories.filter(c => customSelectedCats.includes(c.id));
    return selected.length > 0 ? selected : categoryTrendInfo.top5Categories.slice(0, 3);
  }, [trendViewMode, customSelectedCats, categoryTrendInfo]);

  // Toggle category on custom mode
  const handleToggleCategory = (catId: string) => {
    let current = customSelectedCats;
    if (trendViewMode !== 'custom') {
      current = linesToRender.map(c => c.id);
      setTrendViewMode('custom');
    }
    if (current.includes(catId)) {
      if (current.length > 1) {
        setCustomSelectedCats(current.filter(id => id !== catId));
      }
    } else {
      setCustomSelectedCats([...current, catId]);
    }
  };

  // Human readable timeline label
  const readableTimelineLabel = useMemo(() => {
    if (timelinePreset === 'all') return 'All Time';
    if (timelinePreset === 'this_month') return 'This Month';
    if (timelinePreset === '1m') return 'Last 30 Days (1 Month)';
    if (timelinePreset === '3m') return 'Last 3 Months';
    if (timelinePreset === '6m') return 'Last 6 Months';
    if (timelinePreset === '1y') return 'Last 1 Year';
    return `${formatReadableDate(startDate)} – ${formatReadableDate(endDate)}`;
  }, [timelinePreset, startDate, endDate]);

  return (
    <div className="space-y-6 pb-12">
      {/* Timeline Filter Toolbar with Presets and Manual Dates */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
              <CalendarRange className="w-3.5 h-3.5 text-slate-400" /> Timeline:
            </span>
            {[
              { id: '1m', label: '1 Month' },
              { id: '3m', label: '3 Months' },
              { id: '6m', label: '6 Months' },
              { id: '1y', label: '1 Year' },
              { id: 'this_month', label: 'This Month' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom' },
            ].map((p) => {
              const isActive = timelinePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleApplyPreset(p.id as TimelinePreset)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/20'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Active Range Summary Chip */}
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-blue-50 rounded-xl border border-blue-100 text-xs flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
              <span className="font-semibold text-blue-900">{readableTimelineLabel}</span>
              <span className="px-1.5 py-0.5 rounded-md bg-blue-200/70 text-blue-800 text-[10px] font-bold">
                {timelineTransactions.length} txs
              </span>
            </div>
            {timelinePreset !== 'all' && (
              <button
                type="button"
                onClick={handleResetTimeline}
                title="Reset to All Time"
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Manual Date Pickers Row (From / To) */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">From:</label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">To:</label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>
            </div>

            {timelinePreset === 'custom' && (
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                Manual range active
              </span>
            )}
          </div>

          <div className="text-xs text-slate-600 flex items-center gap-3">
            <span>
              Net Inflow/Outflow: <strong className={`privacy-value ${netSavings >= 0 ? 'text-emerald-600 font-extrabold' : 'text-rose-600 font-extrabold'}`}>
                {netSavings >= 0 ? '+' : '-'}{user.currency}{Math.abs(netSavings).toLocaleString('en-IN')}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <span className="text-xs font-bold uppercase text-slate-700">Timeline Outflow</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1 privacy-value">
            {user.currency}{totalExpenses.toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-600 mt-1">{expenseTransactions.length} expenses logged</p>
        </div>

        <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <span className="text-xs font-bold uppercase text-slate-700">Timeline Inflow</span>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1 privacy-value">
            {user.currency}{totalIncome.toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-600 mt-1">{incomeTransactions.length} income deposits</p>
        </div>

        <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <span className="text-xs font-bold uppercase text-slate-700">Active Monthly EMI</span>
          <div className="text-2xl font-extrabold text-rose-700 mt-1 privacy-value">
            {user.currency}{totalMonthlyEMI.toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-600 mt-1">{loans.filter(l => l.status === 'active').length} active loan obligations</p>
        </div>

        <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <span className="text-xs font-bold uppercase text-slate-700">Credit Cards & Debt Due</span>
          <div className="text-2xl font-extrabold text-orange-700 mt-1 privacy-value">
            {user.currency}{(totalCreditCardDue + totalLoanPrincipalRemaining).toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-600 mt-1">Cards: <span className="privacy-value">{user.currency}{totalCreditCardDue.toLocaleString('en-IN')}</span> • Loans: <span className="privacy-value">{user.currency}{totalLoanPrincipalRemaining.toLocaleString('en-IN')}</span></p>
        </div>
      </div>

      {/* Visual Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Pie Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-blue-600" />
              Spending by Category
            </h3>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              {readableTimelineLabel}
            </span>
          </div>
          <p className="text-xs text-slate-700 mb-4">Distribution of outgoing expenses in period</p>

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
                    formatter={(val: any) => [`${user.currency}${Number(val).toLocaleString('en-IN')}`, 'Amount']}
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-600 text-xs">
              <PieIcon className="w-8 h-8 text-slate-400 mb-2" />
              <span>No expense records available in this timeline</span>
            </div>
          )}
        </div>

        {/* Inflow vs Outflow Trend */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Cash Flow Trend
            </h3>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              {readableTimelineLabel}
            </span>
          </div>
          <p className="text-xs text-slate-700 mb-4">Comparison of deposits against total spending</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748B" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748B" />
                <Tooltip 
                  formatter={(val: any) => [`${user.currency}${Number(val).toLocaleString('en-IN')}`, '']}
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

      {/* Category Spending Trends Line Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              Category Spending Trends ({readableTimelineLabel})
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Category spending trajectory and velocity over the selected timeline
            </p>
          </div>

          {/* Quick Metrics & Mode Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setTrendViewMode('top5')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  trendViewMode === 'top5'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Top 5 Categories
              </button>
              <button
                type="button"
                onClick={() => setTrendViewMode('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                  trendViewMode === 'all'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Active ({categoryTrendInfo.activeCategories.length})
              </button>
            </div>

            {categoryTrendInfo.activeCategories[0] && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs">
                <span className="text-indigo-700 font-medium">Top Category:</span>
                <strong className="text-indigo-950 truncate max-w-[120px]">{categoryTrendInfo.activeCategories[0].name}</strong>
                <span className="text-indigo-700 font-bold privacy-value">
                  ({user.currency}{categoryTrendInfo.activeCategories[0].totalInPeriod.toLocaleString('en-IN')})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Category Filter Chips Bar */}
        <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs text-slate-500 font-semibold flex-shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3 text-slate-400" /> Filter:
          </span>
          {categoryTrendInfo.sortedCategories.map((cat) => {
            const isVisible = linesToRender.some(c => c.id === cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleToggleCategory(cat.id)}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer border ${
                  isVisible
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200 opacity-60 hover:opacity-100'
                }`}
                title={`Toggle ${cat.name} (${user.currency}${cat.totalInPeriod.toLocaleString('en-IN')})`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: isVisible ? cat.color : '#94A3B8' }}
                />
                <span className="truncate max-w-[120px]">{cat.name}</span>
                {isVisible && <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Line Chart Visualization */}
        <div className="h-72 sm:h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={categoryTrendInfo.data}
              margin={{ top: 15, right: 15, left: -5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12, fill: '#64748B' }} 
                stroke="#CBD5E1"
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#64748B' }} 
                stroke="#CBD5E1"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => val >= 1000 ? `${user.currency}${(val / 1000).toFixed(0)}k` : `${user.currency}${val}`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const sorted = [...payload].sort((a: any, b: any) => (Number(b.value) || 0) - (Number(a.value) || 0));
                    const totalMonth = sorted.reduce((sum: number, p: any) => sum + (Number(p.value) || 0), 0);
                    return (
                      <div className="bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-xl border border-slate-800 text-xs min-w-[210px] backdrop-blur-md">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                          <span className="font-bold text-slate-200">{label}</span>
                          <span className="font-extrabold text-emerald-400 privacy-value">
                            Total: {user.currency}{totalMonth.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {sorted.map((entry: any, index: number) => (
                            <div key={`entry-${index}`} className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                                <span className="text-slate-300 truncate">{entry.name}</span>
                              </div>
                              <span className="font-semibold text-white flex-shrink-0 privacy-value">
                                {user.currency}{Number(entry.value).toLocaleString('en-IN')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} 
              />
              {linesToRender.map((cat) => (
                <Line
                  key={cat.id}
                  type="monotone"
                  dataKey={cat.name}
                  name={cat.name}
                  stroke={cat.color}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: cat.color, stroke: '#FFFFFF', strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: cat.color, stroke: '#FFFFFF', strokeWidth: 2 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart Insights Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>
              Period Total: <strong className="text-slate-800 privacy-value">{user.currency}{categoryTrendInfo.grandPeriodTotal.toLocaleString('en-IN')}</strong>
            </span>
            <span>
              Monthly Average: <strong className="text-slate-800 privacy-value">{user.currency}{categoryTrendInfo.averageMonthlySpend.toLocaleString('en-IN')}</strong>
            </span>
          </div>
          {categoryTrendInfo.peakMonth && categoryTrendInfo.peakMonth.total > 0 && (
            <div className="text-slate-600">
              Peak Spending: <strong className="text-rose-600">{categoryTrendInfo.peakMonth.fullMonth}</strong> (<span className="privacy-value">{user.currency}{categoryTrendInfo.peakMonth.total.toLocaleString('en-IN')}</span>)
            </div>
          )}
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
              { id: 'transactions', label: 'Timeline Ledger', count: timelineTransactions.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTableTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
                        <td className="p-3.5 text-right font-extrabold text-slate-900">{user.currency}{cat.total.toLocaleString('en-IN')}</td>
                        <td className="p-3.5 text-right font-medium text-slate-700">{user.currency}{avg.toLocaleString('en-IN')}</td>
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
                      No category expense records found in this timeline.
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
                            <span className="text-rose-700">{acc.currency}{due.toLocaleString('en-IN')} (Due)</span>
                          ) : (
                            <span className="text-slate-900">{acc.currency}{acc.balance.toLocaleString('en-IN')}</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right font-medium text-slate-700">
                          {isCard ? `${acc.currency}${limit.toLocaleString('en-IN')}` : '-'}
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
                    const paidMonths = loan.totalMonths - loan.remainingMonths;
                    const progressPercent = Math.round((paidMonths / loan.totalMonths) * 100);

                    return (
                      <tr key={loan.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{loan.name}</span>
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] capitalize">
                              {loan.category}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 font-medium text-slate-700">{loan.lender || '-'}</td>
                        <td className="p-3.5 text-right font-extrabold text-rose-700">{user.currency}{loan.monthlyEMI.toLocaleString('en-IN')}</td>
                        <td className="p-3.5 text-right font-medium text-slate-700">{user.currency}{loan.totalPrincipal.toLocaleString('en-IN')}</td>
                        <td className="p-3.5 text-right font-extrabold text-slate-900">{user.currency}{loan.remainingPrincipal.toLocaleString('en-IN')}</td>
                        <td className="p-3.5 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[11px] font-bold text-slate-900">{paidMonths}/{loan.totalMonths} months ({progressPercent}%)</span>
                            <div className="w-20 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progressPercent}%` }}></div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-slate-700 text-[11px]">{loan.nextDueDate || '-'}</td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            loan.status === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {loan.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-600 text-xs">
                      No active loans or EMIs recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Friends Balance Ledger */}
        {activeTableTab === 'friends' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5">Friend Name</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Shared Groups</th>
                  <th className="p-3.5 text-right">Net Debt Balance</th>
                  <th className="p-3.5 text-center">Settlement Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {friends.length > 0 ? (
                  friends.map((fr) => {
                    const isOwed = fr.balance > 0;
                    const owesYou = fr.balance < 0;
                    const isSettled = fr.balance === 0;

                    return (
                      <tr key={fr.id} className="hover:bg-slate-50 transition">
                        <td className="p-3.5">
                          <div className="flex items-center space-x-2">
                            <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[10px]">
                              {fr.name.substring(0, 1).toUpperCase()}
                            </span>
                            <span className="font-bold text-slate-900">{fr.name}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-700">{fr.email}</td>
                        <td className="p-3.5 text-slate-700">
                          {fr.groups && fr.groups.length > 0 ? (
                            <span className="text-slate-900 font-medium">{fr.groups.length} groups</span>
                          ) : (
                            <span className="text-slate-600">Direct Only</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right font-extrabold">
                          {isOwed && <span className="text-emerald-700">+{user.currency}{fr.balance.toLocaleString('en-IN')} (owes you)</span>}
                          {owesYou && <span className="text-rose-700">-{user.currency}{Math.abs(fr.balance).toLocaleString('en-IN')} (you owe)</span>}
                          {isSettled && <span className="text-slate-600">Settled up ({user.currency}0)</span>}
                        </td>
                        <td className="p-3.5 text-center">
                          {isSettled ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold border border-emerald-200">
                              Cleared
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-bold border border-amber-200">
                              Pending Due
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-600 text-xs">
                      No friends added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Splitwise Groups Table */}
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
                    const grpTxs = timelineTransactions.filter(t => t.groupId === grp.id);
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
                        <td className="p-3.5 text-right font-extrabold text-slate-900">{user.currency}{totalSpend.toLocaleString('en-IN')}</td>
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

        {/* 6. Complete Timeline Ledger Table */}
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
                              {isOutflow ? '-' : '+'}{user.currency}{tx.amount.toLocaleString('en-IN')}
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

