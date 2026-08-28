import React, { useState, useMemo } from 'react';
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
  Coins,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wallet,
  X,
  Check,
  ShieldCheck,
  Percent,
  SlidersHorizontal,
  LayoutDashboard,
  Zap,
  Sparkles,
  PieChart,
  ArrowRightLeft
} from 'lucide-react';
import { Account, Friend, Group, LoanEMI, Transaction, UserProfile, DashboardCardConfig, DashboardCardId, Category } from '../types';
import { CategoryIcon } from './CategoryIcon';

interface DashboardViewProps {
  user: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  loans: LoanEMI[];
  groups: Group[];
  friends: Friend[];
  categories?: Category[];
  cardsConfig?: DashboardCardConfig[];
  onOpenAddExpense: () => void;
  onOpenAddAccount: () => void;
  onOpenPayEMI: (emi: LoanEMI) => void;
  onOpenShareAccount: (account: Account) => void;
  onOpenPayCreditCard?: (account: Account) => void;
  onPayCreditCardDue?: (cardId: string, fromBankId: string, amount: number) => void;
  onSelectGroup: (groupId: string) => void;
  onSelectFriend: (friendId: string) => void;
  onNavigateTab: (tab: string) => void;
  onOpenManageDashboard: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  accounts,
  transactions,
  loans,
  groups,
  friends,
  categories = [],
  cardsConfig = [],
  onOpenAddExpense,
  onOpenAddAccount,
  onOpenPayEMI,
  onOpenShareAccount,
  onOpenPayCreditCard,
  onPayCreditCardDue,
  onSelectGroup,
  onSelectFriend,
  onNavigateTab,
  onOpenManageDashboard,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Credit Card Payment Modal State
  const [payingCard, setPayingCard] = useState<Account | null>(null);
  const [payFromBank, setPayFromBank] = useState<string>('');
  const [payAmount, setPayAmount] = useState<string>('');
  const [paymentSuccessToast, setPaymentSuccessToast] = useState<string | null>(null);

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

  // Active cards with dues
  const cardsWithDue = creditCards.filter(c => (c.dueAmount || 0) > 0);

  // Open Direct Pay Modal
  const handleOpenPayModal = (card: Account) => {
    setPayingCard(card);
    setPayAmount(String(card.dueAmount || 0));
    const defaultBank = bankAccounts.find(b => b.balance >= (card.dueAmount || 0)) || bankAccounts[0];
    setPayFromBank(defaultBank ? defaultBank.id : '');
  };

  // Submit Credit Card Payment
  const handleExecutePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCard || !payFromBank || !payAmount) return;
    const amountNum = Number(payAmount);
    if (amountNum <= 0) return;

    if (onPayCreditCardDue) {
      onPayCreditCardDue(payingCard.id, payFromBank, amountNum);
    }

    const cardName = payingCard.name;
    setPayingCard(null);
    setPayAmount('');
    setPaymentSuccessToast(`Payment of ${user.currency}${amountNum.toLocaleString()} for ${cardName} completed successfully!`);
    setTimeout(() => {
      setPaymentSuccessToast(null);
    }, 4000);
  };

  // Filtered transactions (latest on top)
  const filteredTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.date).getTime() || new Date(a.date).getTime() || 0;
        const timeB = new Date(b.updatedAt || b.date).getTime() || new Date(b.date).getTime() || 0;
        if (timeB !== timeA) return timeB - timeA;
        return (b.id || '').localeCompare(a.id || '');
      })
      .filter(tx => {
        const matchesSearch = tx.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (tx.notes && tx.notes.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!matchesSearch) return false;
        if (filterType === 'all') return true;
        return tx.type === filterType;
      }).slice(0, 8);
  }, [transactions, searchTerm, filterType]);

  // Top spending categories calculation
  const topCategories = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
    const catMap: Record<string, number> = {};

    expenses.forEach(t => {
      const catId = t.categoryId || 'cat-1';
      catMap[catId] = (catMap[catId] || 0) + t.amount;
    });

    return Object.entries(catMap)
      .map(([catId, amount]) => {
        const cat = categories.find(c => c.id === catId);
        const percent = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
        return {
          id: catId,
          name: cat?.name || 'Other',
          icon: cat?.icon || 'Tag',
          color: cat?.color || '#3B82F6',
          amount,
          percent,
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);
  }, [transactions, categories]);

  // Helper for due date badge
  const getDueDateInfo = (dueDate?: string) => {
    if (!dueDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: `Overdue by ${Math.abs(diffDays)}d`,
        colorClass: 'bg-rose-100 text-rose-800 border-rose-200',
        isUrgent: true,
      };
    }
    if (diffDays === 0) {
      return {
        label: 'Due Today',
        colorClass: 'bg-rose-50 text-rose-700 border-rose-300 font-bold',
        isUrgent: true,
      };
    }
    if (diffDays <= 3) {
      return {
        label: `Due in ${diffDays}d`,
        colorClass: 'bg-amber-50 text-amber-800 border-amber-300 font-bold',
        isUrgent: true,
      };
    }
    return {
      label: `Due in ${diffDays}d`,
      colorClass: 'bg-slate-100 text-slate-700 border-slate-200',
      isUrgent: false,
    };
  };

  // Enabled cards in display order
  const activeCards = useMemo(() => {
    const list = Array.isArray(cardsConfig) ? cardsConfig : [];
    return [...list]
      .filter(c => c.isEnabled)
      .sort((a, b) => a.order - b.order);
  }, [cardsConfig]);

  // ==========================================
  // CARD RENDERERS
  // ==========================================

  // 1. KPI Cards
  const renderKpiMetricsCard = () => (
    <div key="kpi_metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Net Worth */}
      <div 
        onClick={() => onNavigateTab('reports')} 
        className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Total Net Worth</span>
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className={`text-2xl font-extrabold tracking-tight privacy-value ${netWorth >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {user.currency}{netWorth.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium flex items-center gap-1">
            <span>Liquid Cash & Assets minus all debts</span>
          </p>
        </div>
      </div>

      {/* 2. Total Liquid Cash / Bank Balance */}
      <div 
        onClick={() => onNavigateTab('accounts')} 
        className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Bank Balance</span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Landmark className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-extrabold tracking-tight text-emerald-700 privacy-value">
            {user.currency}{totalBankBalance.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium flex items-center gap-1">
            <span>Across {bankAccounts.length} savings/checking accounts</span>
          </p>
        </div>
      </div>

      {/* 3. Debts & Dues */}
      <div 
        onClick={() => onNavigateTab(totalCreditCardDue > 0 ? 'accounts' : 'loans')} 
        className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-rose-600 tracking-wider">Debts & Dues</span>
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <CreditCard className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-extrabold tracking-tight text-rose-600 privacy-value">
            {user.currency}{totalDebts.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
            <span>CC: <strong className="text-rose-700 privacy-value">{user.currency}{totalCreditCardDue.toLocaleString()}</strong></span>
            <span>•</span>
            <span>Loans: <strong className="text-rose-700 privacy-value">{user.currency}{totalLoanPrincipal.toLocaleString()}</strong></span>
          </div>
        </div>
      </div>

      {/* 4. Splitwise Net Balance */}
      <div 
        onClick={() => onNavigateTab('friends')} 
        className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Splitwise Balance</span>
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className={`text-2xl font-extrabold tracking-tight privacy-value ${
            netSplitwiseBalance > 0 
              ? 'text-emerald-600' 
              : netSplitwiseBalance < 0 
                ? 'text-rose-600' 
                : 'text-slate-700'
          }`}>
            {netSplitwiseBalance > 0 ? `+${user.currency}${netSplitwiseBalance.toLocaleString()}` : `${user.currency}${netSplitwiseBalance.toLocaleString()}`}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            {netSplitwiseBalance > 0 
              ? `You are owed ${user.currency}${totalOwedToMe.toLocaleString()} total` 
              : netSplitwiseBalance < 0 
                ? `You owe ${user.currency}${totalIOwe.toLocaleString()} total` 
                : 'All settled up with friends'}
          </p>
        </div>
      </div>
    </div>
  );

  // 2. Account & Card Pills (Rendered seamlessly without container card)
  const renderAccountPillsCard = () => (
    <div key="account_pills" className="flex items-center gap-3 overflow-x-auto pb-1.5 scrollbar-thin py-1">
      {accounts.map(acc => {
        const isCard = acc.type === 'credit_card';
        const isCash = acc.type === 'cash';
        const accountColor = acc.color || (isCard ? '#991B1B' : '#1E40AF');

        return (
          <div
            key={acc.id}
            onClick={() => onNavigateTab('accounts')}
            style={{ backgroundColor: accountColor }}
            className="flex-shrink-0 px-4 py-3 rounded-2xl text-white shadow-xs hover:shadow-md transition cursor-pointer flex items-center gap-3 min-w-[130px] sm:min-w-[145px] active:scale-98 relative overflow-hidden group select-none"
          >
            {/* Subtle background shine effect on hover */}
            <div className="absolute top-0 right-0 -mt-2 -mr-2 w-12 h-12 rounded-full bg-white/10 pointer-events-none group-hover:scale-125 transition duration-300" />

            <div className="flex-shrink-0 text-white drop-shadow-2xs">
              {isCard ? (
                <CreditCard className="w-5 h-5 text-white stroke-[2.2]" />
              ) : isCash ? (
                <Wallet className="w-5 h-5 text-white stroke-[2.2]" />
              ) : (
                <PiggyBank className="w-5 h-5 text-white stroke-[2.2]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold truncate text-white leading-tight drop-shadow-2xs">
                {acc.name}
              </div>
              <div className="text-sm font-extrabold text-white tracking-tight mt-0.5 leading-tight privacy-value drop-shadow-2xs">
                {isCard 
                  ? `${(acc.dueAmount || 0) > 0 ? '-' : ''}${acc.currency}${(acc.dueAmount || 0).toLocaleString()}` 
                  : `${acc.balance < 0 ? '-' : ''}${acc.currency}${Math.abs(acc.balance).toLocaleString()}`}
              </div>
            </div>
          </div>
        );
      })}

      {/* Add Account Dashed Button */}
      <button
        onClick={onOpenAddAccount}
        id="btn-dash-add-account"
        className="flex-shrink-0 px-4 py-3 h-[50px] rounded-2xl border-2 border-dashed border-slate-300 hover:border-slate-400 bg-white/40 hover:bg-white text-slate-600 hover:text-slate-900 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 min-w-[130px] sm:min-w-[145px] shadow-2xs group"
        title="Add a new bank account or credit card"
      >
        <Plus className="w-4 h-4 text-slate-500 group-hover:text-slate-800 transition stroke-[2.5]" />
        <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 whitespace-nowrap">
          +Add Account
        </span>
      </button>
    </div>
  );

  // 4. Credit Card Dues & Direct Bill Pay
  const renderCreditCardDuesCard = () => (
    <div key="credit_card_dues" className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Credit Card Dues & Direct Bill Pay
            </h2>
            <p className="text-[11px] text-slate-500">
              Clear pending statement balances directly using your linked bank accounts.
            </p>
          </div>
        </div>

        <button 
          onClick={() => onNavigateTab('accounts')}
          className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>View Cards</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {cardsWithDue.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cardsWithDue.map(card => {
            const dueInfo = getDueDateInfo(card.paymentDueDate);
            const utilization = card.creditLimit ? Math.round(((card.dueAmount || 0) / card.creditLimit) * 100) : 0;

            return (
              <div 
                key={card.id}
                className="bg-slate-50/90 hover:bg-white p-4 rounded-2xl border border-slate-200/90 hover:border-slate-300 hover:shadow-xs transition flex flex-col justify-between relative group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 truncate">{card.name}</span>
                    {dueInfo && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dueInfo.colorClass}`}>
                        {dueInfo.label}
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Statement Due</span>
                    <div className="text-xl font-extrabold text-rose-600 mt-0.5 privacy-value">
                      {card.currency}{card.dueAmount?.toLocaleString()}
                    </div>
                  </div>

                  {/* Credit Utilization Bar */}
                  {card.creditLimit && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span>Limit: <strong className="text-slate-700 privacy-value">{card.currency}{card.creditLimit.toLocaleString()}</strong></span>
                        <span className={`font-bold ${utilization > 50 ? 'text-rose-600' : 'text-slate-700'}`}>
                          {utilization}% used
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${utilization > 50 ? 'bg-rose-500' : 'bg-blue-600'}`}
                          style={{ width: `${Math.min(100, utilization)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onOpenShareAccount(card)}
                    className="text-slate-500 hover:text-slate-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    Details
                  </button>

                  <button
                    onClick={() => handleOpenPayModal(card)}
                    id={`btn-pay-cc-${card.id}`}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Pay Bill</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-xs text-slate-700 font-bold">All credit card bills are fully paid!</p>
          <p className="text-[11px] text-slate-500 mt-0.5">No outstanding statement dues detected.</p>
        </div>
      )}
    </div>
  );

  // 5. Active Loans & EMI Schedule
  const renderLoansEmiCard = () => (
    <div key="loans_emi" className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Active Loans & Monthly EMI Schedule
            </h2>
            <p className="text-[11px] text-slate-500">
              Track remaining loan balances, monthly installments, and upcoming dues.
            </p>
          </div>
        </div>

        <button 
          onClick={() => onNavigateTab('loans')}
          className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>View All Loans</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {loans.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loans.map(loan => {
            const repaidPercent = Math.round(((loan.principalAmount - loan.remainingPrincipal) / loan.principalAmount) * 100);

            return (
              <div 
                key={loan.id}
                className="bg-slate-50/90 hover:bg-white p-4 rounded-2xl border border-slate-200/90 hover:border-slate-300 hover:shadow-xs transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 truncate">{loan.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Day {loan.dueDay} of month
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Monthly EMI</span>
                      <div className="text-lg font-extrabold text-slate-900 mt-0.5 privacy-value">
                        {user.currency}{loan.monthlyEMI.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-semibold text-slate-500 block">Remaining</span>
                      <span className="text-xs font-bold text-slate-700 privacy-value">
                        {user.currency}{loan.remainingPrincipal.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                      <span>Tenure: {loan.tenureMonths - loan.remainingTenureMonths}/{loan.tenureMonths} mo</span>
                      <span className="font-bold text-indigo-600">{repaidPercent}% paid</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                        style={{ width: `${repaidPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-end">
                  <button
                    onClick={() => onOpenPayEMI(loan)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-xs font-bold border border-indigo-200 transition flex items-center gap-1 cursor-pointer active:scale-95"
                  >
                    <span>Record Installment</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <Landmark className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-700 font-bold">No active loans or EMI schedules</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Click Loans in the sidebar to add home, auto, or personal loans.</p>
        </div>
      )}
    </div>
  );

  // 6. Splitwise Shared Groups
  const renderSplitwiseGroupsCard = () => (
    <div key="splitwise_groups" className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Users2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Splitwise Shared Groups
            </h2>
            <p className="text-[11px] text-slate-500">
              Shared trip, flatmate, and project expenses with real-time balance calculations.
            </p>
          </div>
        </div>

        <button 
          onClick={() => onNavigateTab('groups')}
          className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>All Groups</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {groups.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groups.map(group => (
            <div 
              key={group.id}
              onClick={() => onSelectGroup(group.id)}
              className="bg-slate-50/90 hover:bg-white p-4 rounded-2xl border border-slate-200/90 hover:border-slate-300 hover:shadow-xs transition flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  <Users2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-700 transition">
                    {group.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate">
                    {group.members.length} members • {group.simplifyDebts ? 'Optimized Debts' : 'Standard'}
                  </p>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 flex-shrink-0 transition" />
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <Users2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-700 font-bold">No Splitwise groups created yet</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Create a group to easily split bills with friends or flatmates.</p>
        </div>
      )}
    </div>
  );

  // 7. Friends & Direct Balances
  const renderFriendsBalancesCard = () => (
    <div key="friends_balances" className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Friends & Direct Balances
            </h2>
            <p className="text-[11px] text-slate-500">
              Direct peer balances across all shared expenses and settlements.
            </p>
          </div>
        </div>

        <button 
          onClick={() => onNavigateTab('friends')}
          className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>All Friends</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {friends.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {friends.map(friend => (
            <div 
              key={friend.id}
              onClick={() => onSelectFriend(friend.id)}
              className="bg-slate-50/90 hover:bg-white p-3.5 rounded-2xl border border-slate-200/90 hover:border-slate-300 hover:shadow-xs transition flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div 
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                  style={{ backgroundColor: friend.avatarColor || '#3B82F6' }}
                >
                  {friend.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-600 transition">
                    {friend.name}
                  </h4>
                  <span className="text-[10px] text-slate-500 truncate block">
                    {friend.email}
                  </span>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <span className={`text-xs font-extrabold privacy-value ${
                  friend.netBalance > 0 
                    ? 'text-emerald-600' 
                    : friend.netBalance < 0 
                      ? 'text-rose-600' 
                      : 'text-slate-500'
                }`}>
                  {friend.netBalance > 0 
                    ? `+${user.currency}${friend.netBalance.toLocaleString()}` 
                    : friend.netBalance < 0 
                      ? `${user.currency}${friend.netBalance.toLocaleString()}` 
                      : 'Settled'}
                </span>
                <span className="text-[9px] block text-slate-400 font-semibold">
                  {friend.netBalance > 0 ? 'Owes you' : friend.netBalance < 0 ? 'You owe' : 'Even'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <UserCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-700 font-bold">No friends added yet</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Add friends in the Friends tab to track individual splits.</p>
        </div>
      )}
    </div>
  );

  // 8. Category Breakdown Card
  const renderCategoryBreakdownCard = () => (
    <div key="category_breakdown" className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Top Spending by Category
            </h2>
            <p className="text-[11px] text-slate-500">
              Overview of where your monthly expense budget is allocated.
            </p>
          </div>
        </div>

        <button 
          onClick={() => onNavigateTab('categories')}
          className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>Category Manager</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {topCategories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {topCategories.map(cat => (
            <div 
              key={cat.id}
              className="p-3.5 rounded-2xl border flex flex-col justify-between"
              style={{
                backgroundColor: `${cat.color}08`,
                borderColor: `${cat.color}25`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div 
                    className="w-7 h-7 rounded-xl flex items-center justify-center shadow-2xs"
                    style={{ backgroundColor: cat.color, color: '#FFFFFF' }}
                  >
                    <CategoryIcon iconName={cat.icon} className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 truncate">{cat.name}</span>
                </div>
                <span className="text-xs font-extrabold" style={{ color: cat.color }}>
                  {cat.percent}%
                </span>
              </div>

              <div className="mt-3">
                <div className="text-base font-extrabold text-slate-900 privacy-value">
                  {user.currency}{cat.amount.toLocaleString()}
                </div>
                <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden mt-1.5">
                  <div 
                    className="h-full rounded-full"
                    style={{ width: `${cat.percent}%`, backgroundColor: cat.color }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <PieChart className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-700 font-bold">No expenses recorded yet</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Record transactions to see your visual spending distribution.</p>
        </div>
      )}
    </div>
  );

  // 9. Recent Transactions Card
  const renderRecentTransactionsCard = () => (
    <div key="recent_transactions" className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Recent Transactions Activity
            </h2>
            <p className="text-[11px] text-slate-500">
              Live chronological activity stream across all accounts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Type Filter */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('expense')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterType === 'expense' ? 'bg-white text-rose-600 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Expenses
            </button>
            <button
              onClick={() => setFilterType('income')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterType === 'income' ? 'bg-white text-emerald-600 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Income
            </button>
          </div>

          <button
            onClick={() => onNavigateTab('transactions')}
            className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 ml-2 cursor-pointer"
          >
            <span>All ({transactions.length})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {filteredTransactions.length > 0 ? (
        <div className="space-y-2">
          {filteredTransactions.map(tx => {
            const acc = accounts.find(a => a.id === tx.accountId);
            const cat = categories.find(c => c.id === tx.categoryId);

            return (
              <div 
                key={tx.id}
                className="p-3 rounded-2xl bg-slate-50/80 hover:bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-2xs transition flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div 
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: cat ? `${cat.color}15` : '#3B82F615',
                      color: cat ? cat.color : '#3B82F6',
                    }}
                  >
                    <CategoryIcon iconName={cat?.icon || (tx.type === 'income' ? 'TrendingUp' : 'Receipt')} className="w-4 h-4" />
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {tx.title}
                    </h4>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                      <span>{tx.date}</span>
                      {acc && <span>• {acc.name}</span>}
                      {cat && <span>• {cat.name}</span>}
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className={`text-xs font-extrabold privacy-value ${
                    tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {tx.type === 'income' ? '+' : '-'}{user.currency}{tx.amount.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <Receipt className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-700 font-bold">No transactions found</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Click Record Expense to start logging your finances.</p>
        </div>
      )}
    </div>
  );

  // Dispatcher function for card rendering
  const renderCardById = (cardId: DashboardCardId) => {
    switch (cardId) {
      case 'kpi_metrics':
        return renderKpiMetricsCard();
      case 'account_pills':
        return renderAccountPillsCard();
      case 'credit_card_dues':
        return renderCreditCardDuesCard();
      case 'loans_emi':
        return renderLoansEmiCard();
      case 'splitwise_groups':
        return renderSplitwiseGroupsCard();
      case 'friends_balances':
        return renderFriendsBalancesCard();
      case 'category_breakdown':
        return renderCategoryBreakdownCard();
      case 'recent_transactions':
        return renderRecentTransactionsCard();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Toast Notification */}
      {paymentSuccessToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{paymentSuccessToast}</span>
          <button 
            onClick={() => setPaymentSuccessToast(null)}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Render Dynamic User Ordered Cards */}
      {activeCards.length > 0 ? (
        <div className="space-y-6">
          {activeCards.map(card => renderCardById(card.id))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
          <LayoutDashboard className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">All dashboard cards are currently hidden</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Click "Manage Dashboard" to enable cards and customize your overview.
          </p>
          <button
            onClick={onOpenManageDashboard}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 transition cursor-pointer"
          >
            Manage Dashboard Cards
          </button>
        </div>
      )}

      {/* DIRECT CREDIT CARD PAYMENT MODAL */}
      {payingCard && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Direct Bill Payment</h2>
                  <span className="text-xs text-slate-500">{payingCard.name}</span>
                </div>
              </div>

              <button 
                onClick={() => setPayingCard(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Card Overview Banner */}
            <div className="my-4 p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Credit Card Bill</span>
                <CreditCard className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Outstanding Statement</span>
                  <span className="text-xl font-extrabold text-rose-400 privacy-value">
                    {payingCard.currency}{payingCard.dueAmount?.toLocaleString() || 0}
                  </span>
                </div>
                {payingCard.creditLimit && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase">Limit</span>
                    <span className="text-xs font-semibold text-slate-200 privacy-value">
                      {payingCard.currency}{payingCard.creditLimit.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleExecutePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Pay From Bank Account</label>
                <select
                  required
                  value={payFromBank}
                  onChange={(e) => setPayFromBank(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                >
                  <option value="">Select funding bank account</option>
                  {bankAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Balance: {a.currency}{a.balance.toLocaleString()})
                    </option>
                  ))}
                </select>

                {payFromBank && (() => {
                  const selBank = bankAccounts.find(b => b.id === payFromBank);
                  if (!selBank) return null;
                  const amtNum = Number(payAmount) || 0;
                  const remaining = selBank.balance - amtNum;
                  const isInsufficient = remaining < 0;

                  return (
                    <div className={`mt-1.5 text-xs flex items-center justify-between px-1 ${
                      isInsufficient ? 'text-rose-600 font-bold' : 'text-slate-600'
                    }`}>
                      <span>Available: <strong>{selBank.currency}{selBank.balance.toLocaleString()}</strong></span>
                      {amtNum > 0 && (
                        <span>
                          {isInsufficient ? (
                            <span className="text-rose-600 font-bold flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" /> Insufficient
                            </span>
                          ) : (
                            <span>After Pay: <strong className="text-emerald-700">{selBank.currency}{remaining.toLocaleString()}</strong></span>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase text-slate-700">Payment Amount ({user.currency})</label>
                  {payingCard.dueAmount && payingCard.dueAmount > 0 && (
                    <span className="text-[11px] text-slate-500">
                      Statement Due: <strong>{payingCard.currency}{payingCard.dueAmount.toLocaleString()}</strong>
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="e.g. 5000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />

                {payingCard.dueAmount && payingCard.dueAmount > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setPayAmount(String(payingCard.dueAmount || 0))}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition cursor-pointer ${
                        Number(payAmount) === payingCard.dueAmount
                          ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Total ({payingCard.currency}{payingCard.dueAmount.toLocaleString()})
                    </button>
                    {payingCard.dueAmount > 500 && (
                      <button
                        type="button"
                        onClick={() => setPayAmount(String(Math.round(payingCard.dueAmount! * 0.5)))}
                        className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 font-semibold transition cursor-pointer"
                      >
                        50%
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPayingCard(null)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!payFromBank || !payAmount || Number(payAmount) <= 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm cursor-pointer flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirm Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
