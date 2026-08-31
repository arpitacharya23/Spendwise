import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  RotateCcw, 
  Check, 
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  Sparkles,
  DollarSign,
  Eye,
  EyeOff,
  Lock,
  User,
  ShieldCheck,
  ArrowUp
} from 'lucide-react';
import { Account, Category, Group, LoanEMI, SplitMemberShare, Transaction, UserProfile } from '../types';
import { getBankForAccount } from '../data/indianBanks';
import { getAccountAccess, canUserTransactAccount, isSharedOrJointAccount } from '../lib/accountPermissions';

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
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedLoan, setSelectedLoan] = useState<string>('all');
  
  // Shared & Permission Filter State
  const [showPersonalAccounts, setShowPersonalAccounts] = useState<boolean>(true);
  const [showSharedEditAccounts, setShowSharedEditAccounts] = useState<boolean>(true);
  const [showSharedViewAccounts, setShowSharedViewAccounts] = useState<boolean>(true);
  const [accountSharingFilter, setAccountSharingFilter] = useState<'all' | 'personal' | 'shared_all' | 'shared_edit' | 'shared_view'>('all');

  // Date Filters
  const [datePreset, setDatePreset] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Amount Filters
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  // Sort State
  const [sortBy, setSortBy] = useState<string>('date-desc');

  // Pagination / Infinite Scroll State (50 initially, +20 on scroll down)
  const INITIAL_COUNT = 50;
  const LOAD_INCREMENT = 20;
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_COUNT);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  // UI state
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [selectedTxDetail, setSelectedTxDetail] = useState<Transaction | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);

  // Helper to categorize account sharing type for a transaction
  const getTxSharingCategory = (tx: Transaction): 'personal' | 'shared_edit' | 'shared_view' => {
    const acc = accounts.find(a => a.id === tx.accountId);
    if (!acc) return 'personal';
    const isShared = isSharedOrJointAccount(acc, user.email);
    if (!isShared) return 'personal';
    const access = getAccountAccess(acc, user.email);
    if (access.role === 'view') {
      return 'shared_view';
    }
    return 'shared_edit';
  };

  // Counts of transactions across personal vs shared permissions
  const sharingCategoryCounts = useMemo(() => {
    let personal = 0;
    let sharedEdit = 0;
    let sharedView = 0;

    transactions.forEach(tx => {
      const cat = getTxSharingCategory(tx);
      if (cat === 'personal') personal++;
      else if (cat === 'shared_edit') sharedEdit++;
      else if (cat === 'shared_view') sharedView++;
    });

    return {
      personal,
      sharedEdit,
      sharedView,
      sharedTotal: sharedEdit + sharedView,
      total: transactions.length
    };
  }, [transactions, accounts, user.email]);

  // Apply sharing presets
  const handleApplySharingPreset = (preset: 'all' | 'personal' | 'shared_all' | 'shared_edit' | 'shared_view') => {
    setAccountSharingFilter(preset);
    if (preset === 'all') {
      setShowPersonalAccounts(true);
      setShowSharedEditAccounts(true);
      setShowSharedViewAccounts(true);
    } else if (preset === 'personal') {
      setShowPersonalAccounts(true);
      setShowSharedEditAccounts(false);
      setShowSharedViewAccounts(false);
    } else if (preset === 'shared_all') {
      setShowPersonalAccounts(false);
      setShowSharedEditAccounts(true);
      setShowSharedViewAccounts(true);
    } else if (preset === 'shared_edit') {
      setShowPersonalAccounts(false);
      setShowSharedEditAccounts(true);
      setShowSharedViewAccounts(false);
    } else if (preset === 'shared_view') {
      setShowPersonalAccounts(false);
      setShowSharedEditAccounts(false);
      setShowSharedViewAccounts(true);
    }
  };

  const handleTogglePersonal = () => {
    const next = !showPersonalAccounts;
    setShowPersonalAccounts(next);
    if (next && showSharedEditAccounts && showSharedViewAccounts) {
      setAccountSharingFilter('all');
    } else if (next && !showSharedEditAccounts && !showSharedViewAccounts) {
      setAccountSharingFilter('personal');
    } else if (!next && showSharedEditAccounts && showSharedViewAccounts) {
      setAccountSharingFilter('shared_all');
    } else if (!next && showSharedEditAccounts && !showSharedViewAccounts) {
      setAccountSharingFilter('shared_edit');
    } else if (!next && !showSharedEditAccounts && showSharedViewAccounts) {
      setAccountSharingFilter('shared_view');
    }
  };

  const handleToggleSharedEdit = () => {
    const next = !showSharedEditAccounts;
    setShowSharedEditAccounts(next);
    if (showPersonalAccounts && next && showSharedViewAccounts) {
      setAccountSharingFilter('all');
    } else if (showPersonalAccounts && !next && !showSharedViewAccounts) {
      setAccountSharingFilter('personal');
    } else if (!showPersonalAccounts && next && showSharedViewAccounts) {
      setAccountSharingFilter('shared_all');
    } else if (!showPersonalAccounts && next && !showSharedViewAccounts) {
      setAccountSharingFilter('shared_edit');
    } else if (!showPersonalAccounts && !next && showSharedViewAccounts) {
      setAccountSharingFilter('shared_view');
    }
  };

  const handleToggleSharedView = () => {
    const next = !showSharedViewAccounts;
    setShowSharedViewAccounts(next);
    if (showPersonalAccounts && showSharedEditAccounts && next) {
      setAccountSharingFilter('all');
    } else if (showPersonalAccounts && !showSharedEditAccounts && !next) {
      setAccountSharingFilter('personal');
    } else if (!showPersonalAccounts && showSharedEditAccounts && next) {
      setAccountSharingFilter('shared_all');
    } else if (!showPersonalAccounts && showSharedEditAccounts && !next) {
      setAccountSharingFilter('shared_edit');
    } else if (!showPersonalAccounts && !showSharedEditAccounts && next) {
      setAccountSharingFilter('shared_view');
    }
  };

  const handleToggleAllShared = () => {
    const areSharedActive = showSharedEditAccounts || showSharedViewAccounts;
    if (areSharedActive) {
      setShowSharedEditAccounts(false);
      setShowSharedViewAccounts(false);
      setShowPersonalAccounts(true);
      setAccountSharingFilter('personal');
    } else {
      setShowSharedEditAccounts(true);
      setShowSharedViewAccounts(true);
      if (showPersonalAccounts) {
        setAccountSharingFilter('all');
      } else {
        setAccountSharingFilter('shared_all');
      }
    }
  };

  // Account Sharing / Scope Dropdown state & ref
  const [isSharingScopeOpen, setIsSharingScopeOpen] = useState(false);
  const sharingScopeDropdownRef = useRef<HTMLDivElement>(null);

  // Close sharing dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sharingScopeDropdownRef.current &&
        !sharingScopeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSharingScopeOpen(false);
      }
    };
    if (isSharingScopeOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSharingScopeOpen]);

  // Derived label for the dropdown button
  const sharingScopeSummaryLabel = useMemo(() => {
    const count = (showPersonalAccounts ? 1 : 0) + (showSharedEditAccounts ? 1 : 0) + (showSharedViewAccounts ? 1 : 0);
    if (count === 3) return 'All Accounts (3)';
    if (count === 0) return 'None selected (0)';
    if (showPersonalAccounts && !showSharedEditAccounts && !showSharedViewAccounts) return 'Personal account';
    if (!showPersonalAccounts && showSharedEditAccounts && !showSharedViewAccounts) return 'Shared accounts Edit only';
    if (!showPersonalAccounts && !showSharedEditAccounts && showSharedViewAccounts) return 'Shared accounts view only';
    if (showPersonalAccounts && showSharedEditAccounts && !showSharedViewAccounts) return 'Personal + Shared (Edit)';
    if (showPersonalAccounts && !showSharedEditAccounts && showSharedViewAccounts) return 'Personal + Shared (View)';
    if (!showPersonalAccounts && showSharedEditAccounts && showSharedViewAccounts) return 'All Shared accounts (2)';
    return `${count} selected`;
  }, [showPersonalAccounts, showSharedEditAccounts, showSharedViewAccounts]);

  // Floating "Go to top" Button State
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isScrollTopDimmed, setIsScrollTopDimmed] = useState(false);
  const scrollTopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transactionsViewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollParent = transactionsViewRef.current?.closest('.overflow-y-auto') || window;

    const handleScroll = () => {
      const scrollY = scrollParent === window 
        ? window.scrollY 
        : (scrollParent as HTMLElement).scrollTop;

      if (scrollY > 200) {
        setShowScrollTop(true);
        setIsScrollTopDimmed(false);

        if (scrollTopTimerRef.current) {
          clearTimeout(scrollTopTimerRef.current);
        }

        // Dim button to 20% opacity after 2 seconds of inactivity
        scrollTopTimerRef.current = setTimeout(() => {
          setIsScrollTopDimmed(true);
        }, 2000);
      } else {
        setShowScrollTop(false);
        setIsScrollTopDimmed(false);
        if (scrollTopTimerRef.current) {
          clearTimeout(scrollTopTimerRef.current);
        }
      }
    };

    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollParent.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
      if (scrollTopTimerRef.current) {
        clearTimeout(scrollTopTimerRef.current);
      }
    };
  }, []);

  const handleScrollToTop = () => {
    const scrollParent = transactionsViewRef.current?.closest('.overflow-y-auto') || window;
    if (scrollParent === window) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      (scrollParent as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Edit Modal Form State
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editType, setEditType] = useState<Transaction['type']>('expense');
  const [editAccountId, setEditAccountId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Format display time helper (e.g. "14:30" -> "02:30 PM", or extracting from date/updatedAt)
  const formatTxTime = (tx: Transaction) => {
    if (tx.time && typeof tx.time === 'string' && tx.time.includes(':')) {
      const parts = tx.time.split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) || 0;
      if (!isNaN(h)) {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 === 0 ? 12 : h % 12;
        return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
      }
      return tx.time;
    }
    if (tx.date && typeof tx.date === 'string' && tx.date.includes('T')) {
      const timePart = tx.date.split('T')[1]?.substring(0, 5) || '';
      if (timePart && timePart.includes(':')) {
        const [hStr, mStr] = timePart.split(':');
        const h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10) || 0;
        if (!isNaN(h)) {
          const ampm = h >= 12 ? 'PM' : 'AM';
          const displayH = h % 12 === 0 ? 12 : h % 12;
          return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
        }
      }
    }
    if (tx.updatedAt && typeof tx.updatedAt === 'string' && tx.updatedAt.includes('T')) {
      try {
        const dateObj = new Date(tx.updatedAt);
        if (!isNaN(dateObj.getTime())) {
          return dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        }
      } catch {
        // fallback
      }
    }
    return '12:00 PM';
  };

  // Open Edit Modal (or Details if View-Only)
  const handleOpenEdit = (tx: Transaction) => {
    const acc = accounts.find(a => a.id === tx.accountId);
    if (acc && !canUserTransactAccount(acc, user.email)) {
      // User has view-only access to this account -> open details modal instead
      setSelectedTxDetail(tx);
      return;
    }
    setEditingTx(tx);
    setEditTitle(tx.title);
    setEditAmount(String(tx.amount));
    const txDateStr = tx.date || new Date().toISOString().split('T')[0];
    setEditDate(txDateStr.includes('T') ? txDateStr.split('T')[0] : txDateStr);
    let initialTime = tx.time || '';
    if (!initialTime && tx.date && typeof tx.date === 'string' && tx.date.includes('T')) {
      initialTime = tx.date.split('T')[1]?.substring(0, 5) || '';
    }
    setEditTime(initialTime);
    setEditType(tx.type);
    setEditAccountId(tx.accountId);
    setEditCategoryId(tx.categoryId || 'cat-1');
    setEditNotes(tx.notes || '');
  };

  // Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !editTitle || !editAmount) return;

    // Verify account permissions
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
      time: editTime || undefined,
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

  // Search Handlers
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchTerm(searchInput.trim());
    setVisibleCount(INITIAL_COUNT);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchTerm('');
    setVisibleCount(INITIAL_COUNT);
  };

  // Clear All Filters
  const handleClearAllFilters = () => {
    setSearchInput('');
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
    setShowPersonalAccounts(true);
    setShowSharedEditAccounts(true);
    setShowSharedViewAccounts(true);
    setAccountSharingFilter('all');
    setVisibleCount(INITIAL_COUNT);
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
    if (!showPersonalAccounts || !showSharedEditAccounts || !showSharedViewAccounts) count++;
    return count;
  }, [
    searchTerm, 
    selectedType, 
    selectedCategory, 
    selectedAccount, 
    selectedGroup, 
    selectedLoan, 
    datePreset, 
    startDate, 
    endDate, 
    minAmount, 
    maxAmount, 
    sortBy, 
    showPersonalAccounts, 
    showSharedEditAccounts, 
    showSharedViewAccounts
  ]);

  // Main Filtering Logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // 1. Search text
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const acc = accounts.find(a => a.id === tx.accountId);
        const cat = categories.find(c => c.id === tx.categoryId);
        const grp = groups.find(g => g.id === tx.groupId);

        const matchTitle = (tx.title || '').toLowerCase().includes(query);
        const matchNotes = tx.notes ? tx.notes.toLowerCase().includes(query) : false;
        const matchAcc = acc ? (acc.name || '').toLowerCase().includes(query) || (acc.bankName && acc.bankName.toLowerCase().includes(query)) : false;
        const matchCat = cat ? (cat.name || '').toLowerCase().includes(query) : false;
        const matchGrp = grp ? (grp.name || '').toLowerCase().includes(query) : false;
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

      // 5. Account Sharing & Permission Scope Filter (Personal vs Shared Edit vs Shared View-Only)
      const sharingCat = getTxSharingCategory(tx);
      if (sharingCat === 'personal' && !showPersonalAccounts) return false;
      if (sharingCat === 'shared_edit' && !showSharedEditAccounts) return false;
      if (sharingCat === 'shared_view' && !showSharedViewAccounts) return false;

      // 6. Group filter
      if (selectedGroup !== 'all') {
        if (selectedGroup === 'only_groups') {
          if (!tx.groupId) return false;
        } else if (selectedGroup === 'no_groups') {
          if (tx.groupId) return false;
        } else {
          if (tx.groupId !== selectedGroup) return false;
        }
      }

      // 7. Loan / EMI filter
      if (selectedLoan !== 'all') {
        if (selectedLoan === 'only_emi') {
          if (!tx.emiId && tx.type !== 'emi_payment') return false;
        } else if (selectedLoan === 'no_emi') {
          if (tx.emiId || tx.type === 'emi_payment') return false;
        } else {
          if (tx.emiId !== selectedLoan) return false;
        }
      }

      // 8. Date range filter
      if (startDate) {
        if (tx.date < startDate) return false;
      }
      if (endDate) {
        if (tx.date > endDate) return false;
      }

      // 9. Amount range filter
      if (minAmount && !isNaN(Number(minAmount))) {
        if (tx.amount < Number(minAmount)) return false;
      }
      if (maxAmount && !isNaN(Number(maxAmount))) {
        if (tx.amount > Number(maxAmount)) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'date-desc') {
        const timeA = new Date(a.updatedAt || a.date).getTime() || new Date(a.date).getTime() || 0;
        const timeB = new Date(b.updatedAt || b.date).getTime() || new Date(b.date).getTime() || 0;
        if (timeB !== timeA) return timeB - timeA;
        return (b.id || '').localeCompare(a.id || '');
      }
      if (sortBy === 'date-asc') {
        const timeA = new Date(a.date).getTime() || 0;
        const timeB = new Date(b.date).getTime() || 0;
        if (timeA !== timeB) return timeA - timeB;
        return (a.id || '').localeCompare(b.id || '');
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
  }, [
    transactions, 
    searchTerm, 
    selectedType, 
    selectedCategory, 
    selectedAccount, 
    selectedGroup, 
    selectedLoan, 
    startDate, 
    endDate, 
    minAmount, 
    maxAmount, 
    sortBy, 
    accounts, 
    categories, 
    groups, 
    showPersonalAccounts, 
    showSharedEditAccounts, 
    showSharedViewAccounts, 
    user.email
  ]);

  // Filtered totals
  const totalFilteredOutflow = filteredTransactions
    .filter(t => t.type === 'expense' || t.type === 'emi_payment' || (t.type === 'settlement' && t.notes?.includes('Paid to')))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalFilteredInflow = filteredTransactions
    .filter(t => t.type === 'income' || (t.type === 'settlement' && t.notes?.includes('Received from')))
    .reduce((sum, t) => sum + t.amount, 0);

  const netFilteredAmount = totalFilteredInflow - totalFilteredOutflow;

  // Reset visible pagination when filters or sort change
  useEffect(() => {
    setVisibleCount(INITIAL_COUNT);
  }, [
    searchTerm, 
    selectedType, 
    selectedCategory, 
    selectedAccount, 
    selectedGroup, 
    selectedLoan, 
    startDate, 
    endDate, 
    minAmount, 
    maxAmount, 
    sortBy, 
    showPersonalAccounts, 
    showSharedEditAccounts, 
    showSharedViewAccounts
  ]);

  // Sliced transactions currently visible (starts at 50, increments by 20 on scroll)
  const visibleTransactions = useMemo(() => {
    return filteredTransactions.slice(0, visibleCount);
  }, [filteredTransactions, visibleCount]);

  // Infinite Scroll IntersectionObserver: Automatically load next 20 when user scrolls down
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry && firstEntry.isIntersecting) {
          setVisibleCount((prev) => {
            if (prev < filteredTransactions.length) {
              return Math.min(prev + LOAD_INCREMENT, filteredTransactions.length);
            }
            return prev;
          });
        }
      },
      { root: null, rootMargin: '300px', threshold: 0.05 }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [filteredTransactions.length]);

  // Group visible transactions by dates for date-categorized presentation
  const dateCategorizedTransactions = useMemo(() => {
    const groupsList: {
      dateKey: string;
      displayDate: string;
      relativeLabel?: string;
      dayTotalOutflow: number;
      dayTotalInflow: number;
      dayNet: number;
      transactions: Transaction[];
    }[] = [];

    const dateMap = new Map<string, Transaction[]>();

    visibleTransactions.forEach(tx => {
      const dKey = tx.date ? tx.date.split('T')[0] : 'Unknown Date';
      if (!dateMap.has(dKey)) {
        dateMap.set(dKey, []);
      }
      dateMap.get(dKey)!.push(tx);
    });

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    dateMap.forEach((txList, dKey) => {
      let displayDate = dKey;
      let relativeLabel: string | undefined;

      if (dKey !== 'Unknown Date') {
        const parts = dKey.split('-');
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          const dateObj = new Date(year, month, day);

          if (!isNaN(dateObj.getTime())) {
            displayDate = dateObj.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            if (dKey === todayStr) {
              relativeLabel = 'Today';
            } else if (dKey === yesterdayStr) {
              relativeLabel = 'Yesterday';
            }
          }
        }
      }

      const dayTotalOutflow = txList
        .filter(t => t.type === 'expense' || t.type === 'emi_payment' || (t.type === 'settlement' && t.notes?.includes('Paid to')))
        .reduce((sum, t) => sum + t.amount, 0);

      const dayTotalInflow = txList
        .filter(t => t.type === 'income' || (t.type === 'settlement' && t.notes?.includes('Received from')))
        .reduce((sum, t) => sum + t.amount, 0);

      const dayNet = dayTotalInflow - dayTotalOutflow;

      groupsList.push({
        dateKey: dKey,
        displayDate,
        relativeLabel,
        dayTotalOutflow,
        dayTotalInflow,
        dayNet,
        transactions: txList
      });
    });

    return groupsList;
  }, [visibleTransactions]);

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
    <div ref={transactionsViewRef} className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Metrics Strip & Action Buttons on the Same Line */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        {/* 4 Financial Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1">
          <div className="group bg-white rounded-xl px-3.5 py-2 border border-slate-200 shadow-2xs hover:shadow-xs transition flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filtered Count</span>
            <div className="text-sm font-extrabold text-slate-900 mt-0.5 leading-tight">
              {filteredTransactions.length} <span className="text-[11px] font-normal text-slate-500">/ {transactions.length}</span>
            </div>
          </div>

          <div className="group bg-white rounded-xl px-3.5 py-2 border border-slate-200 shadow-2xs hover:shadow-xs transition flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Outflow</span>
            <div className="text-sm font-extrabold text-slate-900 mt-0.5 leading-tight privacy-value">
              {user.currency}{totalFilteredOutflow.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="group bg-white rounded-xl px-3.5 py-2 border border-slate-200 shadow-2xs hover:shadow-xs transition flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Inflow</span>
            <div className="text-sm font-extrabold text-emerald-700 mt-0.5 leading-tight privacy-value">
              {user.currency}{totalFilteredInflow.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="group bg-white rounded-xl px-3.5 py-2 border border-slate-200 shadow-2xs hover:shadow-xs transition flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Net Balance</span>
            <div className={`text-sm font-extrabold mt-0.5 leading-tight privacy-value ${netFilteredAmount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {netFilteredAmount >= 0 ? '+' : ''}{user.currency}{netFilteredAmount.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Calendar View & Export CSV Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {onOpenCalendar && (
            <button
              onClick={onOpenCalendar}
              id="btn-switch-to-calendar"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-95"
              title="Open monthly cashflow calendar"
            >
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Calendar View</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            id="btn-export-transactions-csv"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-95"
            title="Download CSV of filtered results"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Primary Filter Control Bar - Sticky below main header during scroll */}
      <div className="sticky top-[61px] sm:top-[65px] z-20 bg-slate-50 pt-3 pb-1 -mt-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          {/* Row 1: Search Input, Type, Category, Filters Toggle & Reset, and Rightmost Search Button */}
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-center">
            {/* Search Box */}
            <div className="md:col-span-4 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search title, notes, account, group..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Clear search input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Type Filter */}
            <div className="md:col-span-2">
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
            <div className="md:col-span-2">
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

            {/* Right Group: Filters Toggle, Reset, and Search Button grouped together */}
            <div className="md:col-span-4 flex items-center justify-start md:justify-end gap-2">
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition cursor-pointer flex-shrink-0"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border cursor-pointer flex-shrink-0 ${
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

              <button
                type="submit"
                id="btn-search-transactions"
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer flex-shrink-0"
                title="Search all related transactions"
              >
                <Search className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Search</span>
              </button>
            </div>
          </form>

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

            {/* Account Sharing & Permission Scope Filter */}
            <div className="relative" ref={sharingScopeDropdownRef}>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Account Sharing / Scope</label>
              <button
                type="button"
                onClick={() => setIsSharingScopeOpen(!isSharingScopeOpen)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 flex items-center justify-between text-left cursor-pointer hover:bg-slate-100/70 transition"
              >
                <span className="truncate pr-1">{sharingScopeSummaryLabel}</span>
                {isSharingScopeOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                )}
              </button>

              {/* Dropdown Popover with Checkboxes */}
              {isSharingScopeOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-2 space-y-1 animate-fadeIn">
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showPersonalAccounts}
                      onChange={handleTogglePersonal}
                      className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                    <span className="truncate">Personal account</span>
                    <span className="text-[10px] text-slate-400 font-semibold ml-auto">({sharingCategoryCounts.personal})</span>
                  </label>

                  <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showSharedEditAccounts}
                      onChange={handleToggleSharedEdit}
                      className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                    />
                    <span className="truncate">Shared accounts Edit only</span>
                    <span className="text-[10px] text-slate-400 font-semibold ml-auto">({sharingCategoryCounts.sharedEdit})</span>
                  </label>

                  <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showSharedViewAccounts}
                      onChange={handleToggleSharedView}
                      className="w-3.5 h-3.5 rounded text-purple-600 border-slate-300 focus:ring-purple-500 cursor-pointer accent-purple-600"
                    />
                    <span className="truncate">Shared accounts view only</span>
                    <span className="text-[10px] text-slate-400 font-semibold ml-auto">({sharingCategoryCounts.sharedView})</span>
                  </label>
                </div>
              )}
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
                <button onClick={handleClearSearch} title="Clear search filter"><X className="w-3 h-3 hover:text-blue-900" /></button>
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

            {!showPersonalAccounts && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                Personal Accounts: Hidden
                <button onClick={() => setShowPersonalAccounts(true)} title="Show personal accounts">
                  <X className="w-3 h-3 hover:text-blue-900" />
                </button>
              </span>
            )}

            {!showSharedEditAccounts && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                Shared (Edit): Hidden
                <button onClick={() => setShowSharedEditAccounts(true)} title="Show shared edit-access accounts">
                  <X className="w-3 h-3 hover:text-emerald-900" />
                </button>
              </span>
            )}

            {!showSharedViewAccounts && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                Shared (View-Only): Hidden
                <button onClick={() => setShowSharedViewAccounts(true)} title="Show shared view-only accounts">
                  <X className="w-3 h-3 hover:text-purple-900" />
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
      </div>

      {/* Main Transactions List / Table Grouped by Date */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {dateCategorizedTransactions.length > 0 ? (
          <div className="divide-y divide-slate-200/70">
            {dateCategorizedTransactions.map((group) => (
              <div key={group.dateKey} className="space-y-0">
                {/* Date Group Header */}
                <div className="bg-slate-50/95 px-4 py-2.5 border-b border-slate-200/60 flex flex-wrap items-center justify-between gap-2 sticky top-0 z-10 backdrop-blur-xs">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-bold text-slate-800 tracking-tight">
                      {group.displayDate}
                    </span>
                    {group.relativeLabel && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        {group.relativeLabel}
                      </span>
                    )}
                    <span className="text-[11px] font-medium text-slate-500">
                      ({group.transactions.length} {group.transactions.length === 1 ? 'transaction' : 'transactions'})
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 text-[11px] font-semibold text-slate-600 ml-auto flex-wrap">
                    {/* Credited Total (Green, Minimal) */}
                    {group.dayTotalInflow > 0 && (
                      <span className="text-emerald-600 font-bold privacy-value">
                        +{user.currency}{group.dayTotalInflow.toLocaleString('en-IN')}
                      </span>
                    )}

                    {/* Debited Total (Red, Minimal) */}
                    {group.dayTotalOutflow > 0 && (
                      <span className="text-rose-600 font-bold privacy-value">
                        -{user.currency}{group.dayTotalOutflow.toLocaleString('en-IN')}
                      </span>
                    )}

                    {/* Day Net Total (Retaining badge with background) */}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold border privacy-value ${
                      group.dayNet > 0 
                        ? 'bg-emerald-100/70 border-emerald-300 text-emerald-800' 
                        : group.dayNet < 0 
                        ? 'bg-rose-100/70 border-rose-300 text-rose-800' 
                        : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}>
                      <span className="text-[10px] font-medium uppercase opacity-75">Net</span>
                      <span>
                        {group.dayNet > 0 ? '+' : group.dayNet < 0 ? '-' : ''}
                        {user.currency}{Math.abs(group.dayNet).toLocaleString('en-IN')}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Transaction Rows for This Date */}
                <div className="divide-y divide-slate-100">
                  {group.transactions.map((tx) => {
                    const acc = accounts.find(a => a.id === tx.accountId);
                    const bankInfo = getBankForAccount(acc);
                    const cat = categories.find(c => c.id === tx.categoryId);
                    const grp = groups.find(g => g.id === tx.groupId);
                    const emi = loans.find(l => l.id === tx.emiId);
                    const isExpense = tx.type === 'expense' || tx.type === 'emi_payment' || (tx.type === 'settlement' && tx.notes?.includes('Paid to'));
                    const formattedTime = formatTxTime(tx);

                    return (
                      <div
                        key={tx.id}
                        onClick={() => handleOpenEdit(tx)}
                        className="group p-3.5 sm:p-4 hover:bg-slate-50 transition flex items-center justify-between gap-3 cursor-pointer"
                      >
                        {/* Left Column: Icon + Title + Badges + Subtitle */}
                        <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            bankInfo
                              ? 'bg-white border border-slate-200/80 shadow-2xs p-1.5'
                              : tx.type === 'income' 
                              ? 'bg-emerald-100 text-emerald-600' 
                              : tx.type === 'emi_payment'
                              ? 'bg-indigo-100 text-indigo-600'
                              : tx.type === 'transfer'
                              ? 'bg-blue-100 text-blue-600'
                              : tx.type === 'settlement'
                              ? 'bg-purple-100 text-purple-600'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {bankInfo ? (
                              <img
                                src={bankInfo.symbolUrl}
                                alt={bankInfo.name}
                                className="w-6 h-6 object-contain"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  if (!target.src.endsWith('.png')) {
                                    target.src = bankInfo.symbolPngUrl;
                                  }
                                }}
                              />
                            ) : tx.type === 'income' ? (
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

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-sm text-slate-900 truncate group-hover:text-blue-600 transition">{tx.title}</span>
                              
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

                            {/* Subtitle Info (Time + Account + Notes) */}
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                              {/* Transaction Time Badge on Row */}
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] border border-slate-200/70 shadow-2xs">
                                <Clock className="w-3 h-3 text-slate-500" />
                                <span>{formattedTime}</span>
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="font-medium text-slate-700">{acc ? acc.name : 'Primary Account'}</span>
                              {tx.notes && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="italic text-slate-500 truncate max-w-xs">{tx.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Amount */}
                        <div className="flex items-center gap-2.5 flex-shrink-0 pl-3">
                          <div className="text-right">
                            <div className={`font-extrabold text-sm privacy-value ${isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {isExpense ? '-' : '+'}{user.currency}{tx.amount.toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Infinite Scroll Sentinel & Load More Status Indicator */}
            <div ref={loadMoreSentinelRef} className="p-4 flex flex-col items-center justify-center text-center border-t border-slate-100 bg-slate-50/60">
              {visibleCount < filteredTransactions.length ? (
                <div className="flex flex-col sm:flex-row items-center gap-3 py-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>Loading next {Math.min(LOAD_INCREMENT, filteredTransactions.length - visibleCount)} transactions...</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    (Showing {visibleCount} of {filteredTransactions.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setVisibleCount(prev => Math.min(prev + LOAD_INCREMENT, filteredTransactions.length))}
                    className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-blue-600 shadow-2xs transition cursor-pointer"
                  >
                    Load More (+20)
                  </button>
                </div>
              ) : (
                <div className="text-xs font-medium text-slate-500 py-1 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                  <span>Showing all {filteredTransactions.length} transactions</span>
                </div>
              )}
            </div>
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
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Clear All Filters
                </button>
              )}
              <button
                onClick={onOpenAddExpense}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
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
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit Transaction</h2>
                {editingTx.groupId && (
                  <p className="text-[11px] font-medium text-emerald-700 mt-0.5">
                    Splitwise Group: {groups.find(g => g.id === editingTx.groupId)?.name || 'Group Expense'} (member shares will auto-adjust)
                  </p>
                )}
              </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Time</label>
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
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

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const idToDelete = editingTx.id;
                    setEditingTx(null);
                    setDeletingTxId(idToDelete);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTx(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
                  >
                    Save
                  </button>
                </div>
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
                    {(selectedTxDetail.type === 'expense' || selectedTxDetail.type === 'emi_payment' || (selectedTxDetail.type === 'settlement' && selectedTxDetail.notes?.includes('Paid to'))) ? '-' : '+'}{user.currency}{selectedTxDetail.amount.toLocaleString('en-IN')}
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
                  <span className="font-semibold text-slate-800">
                    {selectedTxDetail.date}
                    {formatTxTime(selectedTxDetail) ? ` at ${formatTxTime(selectedTxDetail)}` : ''}
                  </span>
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
                            {user.currency}{split.shareAmount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {(() => {
                const detailAcc = accounts.find(a => a.id === selectedTxDetail.accountId);
                const canTransactDetail = detailAcc ? canUserTransactAccount(detailAcc, user.email) : true;

                if (canTransactDetail) {
                  return (
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const idToDelete = selectedTxDetail.id;
                          setSelectedTxDetail(null);
                          setDeletingTxId(idToDelete);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedTxDetail(null)}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                        >
                          Close
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const txToEdit = selectedTxDetail;
                            setSelectedTxDetail(null);
                            handleOpenEdit(txToEdit);
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Edit Transaction</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="pt-3 space-y-3 border-t border-slate-100">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-center gap-2">
                      <Lock className="w-4 h-4 flex-shrink-0 text-slate-400" />
                      <span>This account is shared in view-only mode. Editing is restricted.</span>
                    </div>
                    <button
                      onClick={() => setSelectedTxDetail(null)}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                );
              })()}
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

      {/* Floating Go To Top Button (At bottom-right, dims to 20% opacity after 2s) */}
      <button
        type="button"
        onClick={handleScrollToTop}
        onMouseEnter={() => {
          setIsScrollTopDimmed(false);
          if (scrollTopTimerRef.current) {
            clearTimeout(scrollTopTimerRef.current);
          }
        }}
        onMouseLeave={() => {
          if (showScrollTop) {
            scrollTopTimerRef.current = setTimeout(() => {
              setIsScrollTopDimmed(true);
            }, 2000);
          }
        }}
        id="btn-scroll-to-top"
        aria-label="Scroll to top of transactions"
        title="Scroll to top"
        className={`fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 p-3 rounded-2xl bg-slate-900 text-white shadow-xl hover:bg-blue-600 hover:scale-110 active:scale-95 border border-slate-700/50 cursor-pointer flex items-center justify-center transition-all duration-500 ease-out ${
          showScrollTop 
            ? isScrollTopDimmed 
              ? 'opacity-10 hover:opacity-100 translate-y-0 pointer-events-auto shadow-xs' 
              : 'opacity-100 translate-y-0 pointer-events-auto shadow-2xl'
            : 'opacity-0 translate-y-8 pointer-events-none'
        }`}
      >
        <ArrowUp className="w-5 h-5 stroke-[2.5]" />
      </button>
    </div>
  );
};
