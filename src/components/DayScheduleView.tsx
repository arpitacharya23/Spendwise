import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Clock, 
  CreditCard, 
  Landmark, 
  Users2, 
  Edit3, 
  Trash2, 
  LayoutList, 
  CalendarDays, 
  ArrowLeft,
  Filter,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { Account, Category, Group, LoanEMI, Transaction, UserProfile } from '../types';
import { CategoryIcon } from './CategoryIcon';

interface DayScheduleViewProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  onBackToMonth: () => void;
  user: UserProfile;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  loans: LoanEMI[];
  groups: Group[];
  onOpenAddExpense: (prefillDate?: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (txId: string) => void;
}

// Standard timeline hours for Google Calendar day schedule (7 AM to 11 PM)
const TIMELINE_HOURS = [
  { hour: 7, label: '07:00 AM' },
  { hour: 8, label: '08:00 AM' },
  { hour: 9, label: '09:00 AM' },
  { hour: 10, label: '10:00 AM' },
  { hour: 11, label: '11:00 AM' },
  { hour: 12, label: '12:00 PM' },
  { hour: 13, label: '01:00 PM' },
  { hour: 14, label: '02:00 PM' },
  { hour: 15, label: '03:00 PM' },
  { hour: 16, label: '04:00 PM' },
  { hour: 17, label: '05:00 PM' },
  { hour: 18, label: '06:00 PM' },
  { hour: 19, label: '07:00 PM' },
  { hour: 20, label: '08:00 PM' },
  { hour: 21, label: '09:00 PM' },
  { hour: 22, label: '10:00 PM' },
  { hour: 23, label: '11:00 PM' },
];

export const DayScheduleView: React.FC<DayScheduleViewProps> = ({
  selectedDate,
  onSelectDate,
  onBackToMonth,
  user,
  transactions,
  accounts,
  categories,
  loans,
  groups,
  onOpenAddExpense,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const [scheduleViewMode, setScheduleViewMode] = useState<'timeline' | 'agenda'>('timeline');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const isSelectedToday = selectedDate === todayStr;

  // Format the selected date
  const dateObj = useMemo(() => {
    const parts = (selectedDate || '').split('-').map(Number);
    const y = parts[0] || today.getFullYear();
    const m = parts[1] || today.getMonth() + 1;
    const d = parts[2] || today.getDate();
    return new Date(y, m - 1, d);
  }, [selectedDate]);

  const formattedDateTitle = useMemo(() => {
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [dateObj]);

  const relativeDayLabel = useMemo(() => {
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const selDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const diffDays = Math.round((selDate.getTime() - todayDate.getTime()) / (1000 * 3600 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    return dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  }, [dateObj, today]);

  // Navigate to prev/next day
  const handlePrevDay = () => {
    const prev = new Date(dateObj);
    prev.setDate(prev.getDate() - 1);
    const prevStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
    onSelectDate(prevStr);
  };

  const handleNextDay = () => {
    const next = new Date(dateObj);
    next.setDate(next.getDate() + 1);
    const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
    onSelectDate(nextStr);
  };

  const handleJumpToToday = () => {
    onSelectDate(todayStr);
  };

  // Mini 7-day week selector around selectedDate (Sun to Sat)
  const weekDays = useMemo(() => {
    const curr = new Date(dateObj);
    const dayOfWeek = curr.getDay(); // 0 (Sun) to 6 (Sat)
    const sunday = new Date(curr);
    sunday.setDate(curr.getDate() - dayOfWeek);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      // Calculate micro categories for this day
      const dayTxs = transactions.filter(t => (t.date ? t.date.split('T')[0] : '') === dStr);
      const uniqueCatIds = Array.from(new Set(dayTxs.map(t => t.categoryId).filter(Boolean)));
      const dayCats = uniqueCatIds.map(id => categories.find(c => c.id === id)).filter(Boolean) as Category[];

      days.push({
        dateStr: dStr,
        dayNumber: d.getDate(),
        dayShort: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isSelected: dStr === selectedDate,
        isToday: dStr === todayStr,
        categories: dayCats,
        txCount: dayTxs.length,
      });
    }
    return days;
  }, [dateObj, selectedDate, todayStr, transactions, categories]);

  // Fast Category Map
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(c => map.set(c.id, c));
    return map;
  }, [categories]);

  // Fast Account Map
  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach(a => map.set(a.id, a));
    return map;
  }, [accounts]);

  // Filter and parse day transactions
  const dayTransactions = useMemo(() => {
    return transactions
      .filter(tx => {
        const txDateStr = tx.date ? tx.date.split('T')[0] : '';
        if (txDateStr !== selectedDate) return false;
        if (filterAccount !== 'all' && tx.accountId !== filterAccount) return false;
        if (filterCategory !== 'all' && tx.categoryId !== filterCategory) return false;
        return true;
      })
      .map((tx, index, arr) => {
        const cat = categoryMap.get(tx.categoryId);
        const acc = accountMap.get(tx.accountId);
        const grp = groups.find(g => g.id === tx.groupId);
        const emi = loans.find(l => l.id === tx.emiId);
        const isExpense = tx.type === 'expense' || tx.type === 'emi_payment' || (tx.type === 'settlement' && tx.notes?.includes('Paid to'));

        // Extract or synthesize schedule time
        let hour = 9;
        let timeLabel = '09:00 AM';

        if (tx.time && tx.time.includes(':')) {
          const [hStr, mStr] = tx.time.split(':');
          const h = parseInt(hStr, 10);
          const m = parseInt(mStr, 10) || 0;
          if (!isNaN(h)) {
            hour = h;
            const ampm = h >= 12 ? 'PM' : 'AM';
            const displayH = h % 12 === 0 ? 12 : h % 12;
            timeLabel = `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
          }
        } else if (tx.date && tx.date.includes('T')) {
          const timePart = tx.date.split('T')[1] || '';
          const [hStr, mStr] = timePart.includes(':') ? timePart.split(':') : ['9', '0'];
          const h = parseInt(hStr, 10);
          const m = parseInt(mStr, 10) || 0;
          if (!isNaN(h)) {
            hour = h;
            const ampm = h >= 12 ? 'PM' : 'AM';
            const displayH = h % 12 === 0 ? 12 : h % 12;
            timeLabel = `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
          }
        } else {
          // If no specific hour in timestamp, map smoothly across working hours (e.g. 9 AM, 11 AM, 2 PM, 4 PM, 7 PM)
          const naturalHours = [9, 11, 14, 16, 18, 20, 10, 13, 15, 17, 19];
          hour = naturalHours[index % naturalHours.length];
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const displayH = hour % 12 === 0 ? 12 : hour % 12;
          timeLabel = `${String(displayH).padStart(2, '0')}:00 ${ampm}`;
        }

        return {
          ...tx,
          category: cat,
          account: acc,
          group: grp,
          loan: emi,
          isExpense,
          hour,
          timeLabel,
        };
      });
  }, [transactions, selectedDate, filterAccount, filterCategory, categoryMap, accountMap, groups, loans]);

  // Calculate day totals
  const daySummary = useMemo(() => {
    let income = 0;
    let expense = 0;

    dayTransactions.forEach(tx => {
      if (!tx.isExpense) {
        income += tx.amount;
      } else {
        expense += tx.amount;
      }
    });

    const net = income - expense;
    return { income, expense, net, count: dayTransactions.length };
  }, [dayTransactions]);

  // Group transactions by hour for the Google Calendar timeline
  const transactionsByHour = useMemo(() => {
    const map: Record<number, typeof dayTransactions> = {};
    dayTransactions.forEach(tx => {
      if (!map[tx.hour]) {
        map[tx.hour] = [];
      }
      map[tx.hour].push(tx);
    });
    return map;
  }, [dayTransactions]);

  // Current live time for red indicator line (only if today)
  const currentHourDecimal = useMemo(() => {
    if (!isSelectedToday) return null;
    return today.getHours() + today.getMinutes() / 60;
  }, [isSelectedToday, today]);

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Header Bar: Back Button, Title, Day Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMonth}
            className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-2xl text-slate-700 transition shadow-xs flex items-center gap-1.5 text-xs font-bold"
            title="Back to Month Grid"
          >
            <ArrowLeft className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Month Grid</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {formattedDateTitle}
              </h1>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                isSelectedToday 
                  ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}>
                {relativeDayLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Day Stepper */}
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-xs">
            <button
              onClick={handlePrevDay}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleJumpToToday}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                isSelectedToday 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              Today
            </button>
            <button
              onClick={handleNextDay}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* View Mode Toggle (Timeline vs Agenda) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setScheduleViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                scheduleViewMode === 'timeline'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>
            <button
              onClick={() => setScheduleViewMode('agenda')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                scheduleViewMode === 'agenda'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Agenda</span>
            </button>
          </div>

          {/* Quick Add Button */}
          <button
            onClick={() => onOpenAddExpense(selectedDate)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-semibold shadow-sm transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Entry</span>
          </button>
        </div>
      </div>

      {/* Mini 7-Day Week Strip Selector (Google Calendar Mobile/Web style) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-2.5 shadow-xs">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {weekDays.map((d) => (
            <button
              key={d.dateStr}
              type="button"
              onClick={() => onSelectDate(d.dateStr)}
              className={`p-2 rounded-2xl flex flex-col items-center justify-between transition cursor-pointer relative select-none ${
                d.isSelected
                  ? 'bg-blue-600 text-white shadow-md scale-[1.02]'
                  : d.isToday
                  ? 'bg-blue-50/70 border border-blue-200 text-blue-900 hover:bg-blue-100/60'
                  : 'hover:bg-slate-50 border border-slate-100 text-slate-700'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase ${d.isSelected ? 'text-blue-100' : 'text-slate-600'}`}>
                {d.dayName}
              </span>
              <span className={`text-base sm:text-lg font-extrabold my-0.5 ${d.isSelected ? 'text-white' : 'text-slate-900'}`}>
                {d.dayNumber}
              </span>

              {/* Micro category indicator dots */}
              <div className="flex items-center justify-center gap-0.5 h-2">
                {d.categories.slice(0, 3).map((c) => (
                  <span
                    key={c.id}
                    className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ backgroundColor: d.isSelected ? '#FFFFFF' : c.color }}
                  />
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Top All-Day Summary KPI Strip (Google Calendar Top Header) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-600">Total Income</span>
          <div className="text-lg sm:text-xl font-extrabold text-emerald-700 mt-0.5">
            +{user.currency}{daySummary.income.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-600">Total Expense</span>
          <div className="text-lg sm:text-xl font-extrabold text-rose-700 mt-0.5">
            -{user.currency}{daySummary.expense.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-600">Net Day Cashflow</span>
          <div className={`text-lg sm:text-xl font-extrabold mt-0.5 ${daySummary.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {daySummary.net >= 0 ? '+' : ''}{user.currency}{daySummary.net.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-600">Day Transactions</span>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
            {daySummary.count} <span className="text-xs font-normal text-slate-600">events</span>
          </div>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-600" />
          <span className="text-xs font-bold uppercase text-slate-600">Filter Day Schedule:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
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
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.type})
              </option>
            ))}
          </select>

          {(filterAccount !== 'all' || filterCategory !== 'all') && (
            <button
              onClick={() => { setFilterAccount('all'); setFilterCategory('all'); }}
              className="text-xs text-rose-600 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* MAIN VIEW: GOOGLE CALENDAR SCHEDULE TIMELINE */}
      {scheduleViewMode === 'timeline' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Schedule Canvas Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                Google Calendar Hourly Schedule
              </span>
            </div>
            <span className="text-xs text-slate-600 font-semibold">
              {dayTransactions.length} scheduled {dayTransactions.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          {/* Timeline Hour Grid */}
          <div className="p-4 sm:p-6 relative divide-y divide-slate-100">
            {TIMELINE_HOURS.map((slot) => {
              const txsInHour = transactionsByHour[slot.hour] || [];
              const isCurrentHourSlot = currentHourDecimal !== null && Math.floor(currentHourDecimal) === slot.hour;

              return (
                <div key={slot.hour} className="py-3 sm:py-4 grid grid-cols-12 gap-3 sm:gap-6 items-start relative group">
                  {/* Left Column: Hour Timestamp */}
                  <div className="col-span-3 sm:col-span-2 text-right pr-2 select-none">
                    <span className="text-xs font-bold text-slate-600 block">
                      {slot.label}
                    </span>
                    <span className="text-[10px] text-slate-600 font-semibold">
                      {slot.hour}:00
                    </span>
                  </div>

                  {/* Right Column: Google Calendar Event Blocks */}
                  <div className="col-span-9 sm:col-span-10 min-h-[46px] border-l-2 border-slate-100 pl-4 sm:pl-6 relative">
                    {/* Live time indicator if current time falls in this hour */}
                    {isCurrentHourSlot && (
                      <div 
                        className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                        style={{ top: `${((currentHourDecimal! % 1) * 100).toFixed(0)}%` }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.5 ring-4 ring-rose-200 animate-pulse" />
                        <div className="h-[2px] bg-rose-500 flex-1 ml-1 opacity-80" />
                        <span className="bg-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ml-1">
                          LIVE
                        </span>
                      </div>
                    )}

                    {txsInHour.length > 0 ? (
                      <div className="space-y-2.5">
                        {txsInHour.map((tx) => {
                          const catColor = tx.category?.color || '#3B82F6';
                          const catName = tx.category?.name || 'General';

                          return (
                            <div
                              key={tx.id}
                              style={{
                                background: `${catColor}12`,
                                borderColor: `${catColor}35`,
                              }}
                              className="p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 hover:shadow-md relative overflow-hidden group/card"
                            >
                              {/* Solid Google Calendar Left Accent Stripe */}
                              <div
                                className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
                                style={{ backgroundColor: catColor }}
                              />

                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pl-1.5">
                                {/* Left Side: Category Icon, Title, Overview Metadata */}
                                <div className="min-w-0 flex-1">
                                  {/* Top line: Icon, Title, and Category Tag */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div
                                      className="w-7 h-7 rounded-xl flex items-center justify-center shadow-2xs flex-shrink-0"
                                      style={{ backgroundColor: `${catColor}25`, color: catColor }}
                                    >
                                      <CategoryIcon iconName={tx.category?.icon || 'Tag'} className="w-3.5 h-3.5" />
                                    </div>

                                    <h4 className="text-sm font-extrabold text-slate-900 truncate">
                                      {tx.title}
                                    </h4>

                                    {/* Category Pill */}
                                    <span
                                      className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                                      style={{ backgroundColor: `${catColor}25`, color: catColor }}
                                    >
                                      {catName}
                                    </span>
                                  </div>

                                  {/* Bottom Line: Overview info chips (Account, Time, Group, EMI) */}
                                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-600">
                                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-white/80 border border-slate-200/80 px-2 py-0.5 rounded-lg shadow-2xs">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      <span>{tx.timeLabel}</span>
                                    </span>

                                    {tx.account && (
                                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-white/80 border border-slate-200/80 px-2 py-0.5 rounded-lg shadow-2xs">
                                        <CreditCard className="w-3 h-3 text-slate-400" />
                                        <span>{tx.account.name}</span>
                                      </span>
                                    )}

                                    {tx.group && (
                                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-lg">
                                        <Users2 className="w-3 h-3 text-emerald-600" />
                                        <span>{tx.group.name}</span>
                                      </span>
                                    )}

                                    {tx.loan && (
                                      <span className="inline-flex items-center gap-1 font-semibold text-indigo-800 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-lg">
                                        <Landmark className="w-3 h-3 text-indigo-600" />
                                        <span>{tx.loan.name}</span>
                                      </span>
                                    )}

                                    {tx.notes && (
                                      <span className="text-[11px] text-slate-600 italic max-w-xs truncate hidden md:inline">
                                        "{tx.notes}"
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Right Side: Amount & Quick Action Buttons */}
                                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                                  {/* Color Graded Amount Chip */}
                                  <div
                                    className={`px-3 py-1.5 rounded-xl font-extrabold text-sm shadow-2xs flex items-center gap-1 ${
                                      tx.isExpense
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200/70'
                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                                    }`}
                                  >
                                    {tx.isExpense ? (
                                      <ArrowDownLeft className="w-3.5 h-3.5 text-rose-600" />
                                    ) : (
                                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                                    )}
                                    <span>
                                      {tx.isExpense ? '-' : '+'}{user.currency}{tx.amount.toLocaleString('en-IN')}
                                    </span>
                                  </div>

                                  {/* Quick Action Buttons */}
                                  <div className="flex items-center space-x-1 opacity-80 group-hover/card:opacity-100 transition">
                                    <button
                                      onClick={() => onEditTransaction(tx)}
                                      className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-white rounded-xl transition shadow-2xs"
                                      title="Edit Event"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => onDeleteTransaction(tx.id)}
                                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-white rounded-xl transition shadow-2xs"
                                      title="Delete Event"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Empty Hour Slot Hover Affordance */
                      <div
                        onClick={() => {
                          const formattedTimeStr = `${selectedDate}T${String(slot.hour).padStart(2, '0')}:00`;
                          onOpenAddExpense(formattedTimeStr);
                        }}
                        className="h-10 rounded-xl border border-dashed border-transparent hover:border-slate-300 hover:bg-slate-50/80 transition flex items-center justify-center cursor-pointer group/empty"
                      >
                        <span className="text-xs font-semibold text-slate-600 group-hover/empty:text-blue-600 flex items-center gap-1 transition">
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add transaction at {slot.label}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AGENDA STREAM VIEW */}
      {scheduleViewMode === 'agenda' && (
        <div className="space-y-4">
          {dayTransactions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dayTransactions.map((tx) => {
                const catColor = tx.category?.color || '#3B82F6';
                const catName = tx.category?.name || 'General';

                return (
                  <div
                    key={tx.id}
                    style={{
                      background: `${catColor}12`,
                      borderColor: `${catColor}35`,
                    }}
                    className="p-4 rounded-3xl border transition shadow-xs hover:shadow-md relative overflow-hidden flex flex-col justify-between"
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-2 rounded-l-3xl"
                      style={{ backgroundColor: catColor }}
                    />

                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2 pl-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-2xs"
                            style={{ backgroundColor: `${catColor}25`, color: catColor }}
                          >
                            <CategoryIcon iconName={tx.category?.icon || 'Tag'} className="w-4 h-4" />
                          </div>

                          <div>
                            <h4 className="text-sm font-extrabold text-slate-900 leading-tight">
                              {tx.title}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span
                                className="text-[10px] font-bold px-2 py-0.2 rounded-full uppercase"
                                style={{ backgroundColor: `${catColor}25`, color: catColor }}
                              >
                                {catName}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-600">
                                • {tx.timeLabel}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Amount */}
                        <div
                          className={`px-3 py-1 rounded-xl font-extrabold text-xs shadow-2xs ${
                            tx.isExpense
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {tx.isExpense ? '-' : '+'}{user.currency}{tx.amount.toLocaleString('en-IN')}
                        </div>
                      </div>

                      {/* Overview Metadata */}
                      <div className="pl-2 mt-3 pt-3 border-t border-slate-200/60 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        {tx.account && (
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-white/80 border border-slate-200/80 px-2 py-0.5 rounded-lg">
                            <CreditCard className="w-3 h-3 text-slate-400" />
                            <span>{tx.account.name}</span>
                          </span>
                        )}
                        {tx.group && (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-lg">
                            <Users2 className="w-3 h-3 text-emerald-600" />
                            <span>{tx.group.name}</span>
                          </span>
                        )}
                        {tx.loan && (
                          <span className="inline-flex items-center gap-1 font-semibold text-indigo-800 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-lg">
                            <Landmark className="w-3 h-3 text-indigo-600" />
                            <span>{tx.loan.name}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pl-2 mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-600">
                        {tx.type.toUpperCase()}
                      </span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => onEditTransaction(tx)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 transition"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
              <CalendarIcon className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No scheduled transactions</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                There are no transaction records for {formattedDateTitle}.
              </p>
              <button
                onClick={() => onOpenAddExpense(selectedDate)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-blue-700 transition"
              >
                + Schedule Transaction
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
