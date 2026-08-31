import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ChevronDown, 
  User, 
  LogOut, 
  Plus, 
  ShieldCheck,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Database
} from 'lucide-react';
import { 
  currentUser, 
  initialAccounts, 
  initialCategories, 
  initialFriends, 
  initialGroupActivityLogs, 
  initialGroups, 
  initialLoans, 
  initialTransactions 
} from './data/initialData';
import { 
  Account, 
  AccountPermission, 
  Category, 
  Friend, 
  Group, 
  GroupActivityLog, 
  LoanEMI, 
  SplitMemberShare, 
  Transaction, 
  UserProfile,
  TransactionRule,
  DashboardCardConfig
} from './types';
import { initialRules } from './data/initialRules';
import { initialDashboardCards } from './data/initialDashboardCards';
import { findMatchingRule, applyRulesToTransactionsList } from './lib/ruleEngine';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { AccountsView } from './components/AccountsView';
import { LoansView } from './components/LoansView';
import { GroupsView } from './components/GroupsView';
import { FriendsView } from './components/FriendsView';
import { ReportsView } from './components/ReportsView';
import { TransactionsView } from './components/TransactionsView';
import { CalendarView } from './components/CalendarView';
import { CategoriesView } from './components/CategoriesView';
import { RulesView } from './components/RulesView';
import { DatabaseModal } from './components/DatabaseModal';
import { ManageDashboardModal } from './components/ManageDashboardModal';
import { AuthView } from './components/AuthView';
import { AddExpenseModal } from './components/AddExpenseModal';
import { ProfileModal } from './components/ProfileModal';
import { NotificationBell } from './components/NotificationBell';
import { supabase } from './lib/supabase';
import { 
  getSupabaseProfile, 
  saveSupabaseProfile,
  getSupabaseAccounts, 
  saveSupabaseAccount, 
  deleteSupabaseAccount,
  getSupabaseCategories, 
  saveSupabaseCategory, 
  deleteSupabaseCategory,
  importGlobalCategoriesToUser,
  getSupabaseRules,
  saveSupabaseRule,
  deleteSupabaseRule,
  importGlobalRulesToUser,
  saveSupabaseBudget,
  getSupabaseTransactions, 
  saveSupabaseTransaction, 
  deleteSupabaseTransaction,
  getSupabaseLoans, 
  saveSupabaseLoan,
  deleteSupabaseLoan,
  getSupabaseGroups, 
  saveSupabaseGroup,
  getSupabaseActivityLogs, 
  saveSupabaseActivityLog,
  getSupabaseFriends, 
  saveSupabaseFriend,
  deleteSupabaseFriend
} from './lib/supabaseService';

export default function App() {
  // Authentication state - defaults to null if not logged in
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('spendwise_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Global Privacy Mode: mask all numbers, hover reveals them
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('spendwise_privacy_mode') === 'true';
    } catch {
      return false;
    }
  });

  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [loans, setLoans] = useState<LoanEMI[]>(initialLoans);
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [activityLogs, setActivityLogs] = useState<GroupActivityLog[]>(initialGroupActivityLogs);
  const [friends, setFriends] = useState<Friend[]>(initialFriends);

  // Rule-based engine rules state
  const [rules, setRules] = useState<TransactionRule[]>(() => {
    try {
      const saved = localStorage.getItem('spendwise_rules');
      return saved ? JSON.parse(saved) : initialRules;
    } catch {
      return initialRules;
    }
  });

  // Dashboard customizable cards state
  const [dashboardCards, setDashboardCards] = useState<DashboardCardConfig[]>(() => {
    try {
      const saved = localStorage.getItem('spendwise_dashboard_cards');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out legacy quick_actions if present in saved localStorage
          const filtered = parsed.filter((c: { id: string }) => c.id !== 'quick_actions');
          if (filtered.length > 0) {
            return filtered;
          }
        }
      }
      return initialDashboardCards;
    } catch {
      return initialDashboardCards;
    }
  });

  // Modal for managing dashboard cards
  const [isManageDashboardOpen, setIsManageDashboardOpen] = useState(false);

  // Persist rules & dashboard layout to local storage
  useEffect(() => {
    try {
      localStorage.setItem('spendwise_rules', JSON.stringify(rules));
    } catch (e) {
      console.warn('Failed to save rules to localStorage', e);
    }
  }, [rules]);

  useEffect(() => {
    try {
      localStorage.setItem('spendwise_dashboard_cards', JSON.stringify(dashboardCards));
    } catch (e) {
      console.warn('Failed to save dashboard cards to localStorage', e);
    }
  }, [dashboardCards]);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean | null>(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isAddAccountModalTriggered, setIsAddAccountModalTriggered] = useState(false);
  const [addExpensePrefillDate, setAddExpensePrefillDate] = useState<string | undefined>(undefined);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [logoutNotice, setLogoutNotice] = useState<string | null>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Toggle privacy mode handler
  const togglePrivacyMode = () => {
    setIsPrivacyMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('spendwise_privacy_mode', String(next));
      } catch (e) {
        console.warn('Storage warning:', e);
      }
      return next;
    });
  };

  // Load data from Supabase on mount or login
  const loadDataFromSupabase = useCallback(async (userEmail?: string) => {
    const targetEmail = userEmail || user?.email;
    if (!targetEmail) return;

    setIsSyncing(true);
    try {
      const sbAccounts = await getSupabaseAccounts(targetEmail);
      const accessibleAccountIds = (sbAccounts || []).map(a => a.id);

      const [
        sbProfile,
        sbCategories,
        sbRules,
        sbTransactions,
        sbLoans,
        sbGroups,
        sbFriends
      ] = await Promise.all([
        getSupabaseProfile(targetEmail),
        getSupabaseCategories(targetEmail),
        getSupabaseRules(targetEmail),
        getSupabaseTransactions(targetEmail, accessibleAccountIds),
        getSupabaseLoans(targetEmail),
        getSupabaseGroups(targetEmail),
        getSupabaseFriends(targetEmail)
      ]);

      const userGroupIds = (sbGroups || []).map(g => g.id);
      const sbLogs = await getSupabaseActivityLogs(userGroupIds);

      let connected = false;

      if (sbProfile) {
        // Merge with existing user profile to preserve avatarUrl if sbProfile has null/undefined
        setUser(prev => {
          const merged: UserProfile = {
            ...sbProfile,
            avatarUrl: sbProfile.avatarUrl || prev?.avatarUrl,
          };
          localStorage.setItem('spendwise_auth_user', JSON.stringify(merged));
          return merged;
        });
        connected = true;
      }
      if (sbAccounts !== null) {
        setAccounts(sbAccounts);
        connected = true;
      }
      if (sbCategories && sbCategories.length > 0) {
        setCategories(sbCategories);
        connected = true;
      }
      if (sbRules && sbRules.length > 0) {
        setRules(sbRules);
        connected = true;
      }
      if (sbTransactions !== null) {
        const sortedTxs = [...sbTransactions].sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.date).getTime() || new Date(a.date).getTime() || 0;
          const timeB = new Date(b.updatedAt || b.date).getTime() || new Date(b.date).getTime() || 0;
          if (timeB !== timeA) return timeB - timeA;
          return (b.id || '').localeCompare(a.id || '');
        });
        setTransactions(sortedTxs);
        connected = true;
      }
      if (sbLoans !== null) {
        setLoans(sbLoans);
        connected = true;
      }
      if (sbGroups !== null) {
        setGroups(sbGroups);
        connected = true;
      }
      if (sbLogs !== null) {
        const sortedLogs = [...sbLogs].sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime() || 0;
          const timeB = new Date(b.timestamp).getTime() || 0;
          if (timeB !== timeA) return timeB - timeA;
          return (b.id || '').localeCompare(a.id || '');
        });
        setActivityLogs(sortedLogs);
        connected = true;
      }
      if (sbFriends !== null) {
        setFriends(sbFriends);
        connected = true;
      }

      setIsCloudConnected(connected);
    } catch {
      setIsCloudConnected(false);
    } finally {
      setIsSyncing(false);
    }
  }, [user?.email]);

  useEffect(() => {
    // Check Supabase session on startup
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          const authUser = data.session.user;
          const userEmail = authUser.email;
          if (userEmail) {
            const { data: profileRow } = await supabase
              .from('profiles')
              .select('*')
              .eq('email', userEmail)
              .maybeSingle();

            const profile: UserProfile = {
              name: profileRow?.name || authUser.user_metadata?.name || userEmail.split('@')[0],
              email: userEmail,
              currency: profileRow?.currency || authUser.user_metadata?.currency || '₹',
              avatarColor: profileRow?.avatar_color || '#3B82F6',
              avatarUrl: profileRow?.avatar_url || authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || undefined,
              phone: profileRow?.phone || authUser.user_metadata?.phone || undefined,
              countryCode: profileRow?.country_code || authUser.user_metadata?.country_code || undefined,
              monthlyBudget: Number(profileRow?.monthly_budget) || 50000,
            };
            setUser(profile);
            localStorage.setItem('spendwise_auth_user', JSON.stringify(profile));
          }
        }
      } catch (err) {
        console.warn('Session check notice:', err);
      }
    };
    checkSession();

    // Listen to Supabase auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user?.email) {
        const userEmail = session.user.email;
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', userEmail)
          .maybeSingle();

        const profile: UserProfile = {
          name: profileRow?.name || session.user.user_metadata?.name || userEmail.split('@')[0],
          email: userEmail,
          currency: profileRow?.currency || session.user.user_metadata?.currency || '₹',
          avatarColor: profileRow?.avatar_color || '#3B82F6',
          avatarUrl: profileRow?.avatar_url || session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || undefined,
          phone: profileRow?.phone || session.user.user_metadata?.phone || undefined,
          countryCode: profileRow?.country_code || session.user.user_metadata?.country_code || undefined,
          monthlyBudget: Number(profileRow?.monthly_budget) || 50000,
        };
        setUser(profile);
        localStorage.setItem('spendwise_auth_user', JSON.stringify(profile));
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user?.email) {
      loadDataFromSupabase(user.email);
    }
  }, [user?.email, loadDataFromSupabase]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAuthSuccess = (profile: UserProfile) => {
    setUser(profile);
    localStorage.setItem('spendwise_auth_user', JSON.stringify(profile));
    loadDataFromSupabase(profile.email);
  };

  const handleLogout = async () => {
    setIsProfileMenuOpen(false);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Signout notice:', err);
    }
    localStorage.removeItem('spendwise_auth_user');
    setUser(null);
    setAccounts([]);
    setTransactions([]);
    setLoans([]);
    setGroups([]);
    setFriends([]);
    setActivityLogs([]);
    setLogoutNotice('Logged out of SpendWise.');
    setTimeout(() => setLogoutNotice(null), 4000);
  };

  const handleSaveProfile = async (updatedUser: UserProfile) => {
    setUser(updatedUser);
    try {
      await saveSupabaseProfile(updatedUser);
      localStorage.setItem('spendwise_auth_user', JSON.stringify(updatedUser));
    } catch (err) {
      console.error('Profile save failed:', err);
    }
  };

  const handleOpenAddExpense = (prefillDate?: string) => {
    setAddExpensePrefillDate(prefillDate);
    setIsAddExpenseModalOpen(true);
  };

  // Global Net Worth & Debt Calculations
  const totalBankBalances = accounts.filter(a => a.type === 'bank' || a.type === 'cash').reduce((sum, a) => sum + a.balance, 0);
  const totalCreditCardDue = accounts.filter(a => a.type === 'credit_card').reduce((sum, a) => sum + (a.dueAmount || 0), 0);
  const totalLoanPrincipal = loans.filter(l => l.status === 'active').reduce((sum, l) => sum + l.remainingPrincipal, 0);
  const totalOwedToMe = friends.reduce((sum, f) => f.netBalance > 0 ? sum + f.netBalance : sum, 0);
  const totalIOwe = friends.reduce((sum, f) => f.netBalance < 0 ? sum + Math.abs(f.netBalance) : sum, 0);
  
  const totalDebts = totalCreditCardDue + totalLoanPrincipal + totalIOwe;
  const netWorth = (totalBankBalances + totalOwedToMe) - totalDebts;

  // HANDLER: Add Standalone Expense / Income / EMI
  const handleSaveExpense = (txData: Partial<Transaction>) => {
    const newTxId = `tx-${Date.now().toString().slice(-6)}`;
    const newTx: Transaction = {
      id: newTxId,
      date: txData.date || new Date().toISOString().split('T')[0],
      title: txData.title || 'Expense',
      amount: Number(txData.amount) || 0,
      type: txData.type || 'expense',
      accountId: txData.accountId || (accounts.length > 0 ? accounts[0].id : 'acc-default'),
      categoryId: txData.categoryId || 'cat-1',
      notes: txData.notes,
      emiId: txData.emiId,
      groupId: txData.groupId,
      createdBy: user.email,
      updatedAt: new Date().toISOString(),
    };

    if (newTx.groupId) {
      const grp = groups.find(g => g.id === newTx.groupId);
      if (grp) {
        const perPerson = Math.round((newTx.amount / grp.members.length) * 100) / 100;
        newTx.splitDetails = grp.members.map((m, idx) => ({
          memberId: m.id,
          memberName: m.name,
          memberEmail: m.email,
          shareAmount: perPerson,
          paidAmount: idx === 0 ? newTx.amount : 0,
          isSelected: true,
        }));
        newTx.paidByMemberId = grp.members[0]?.id || 'mem-1';

        const newLog: GroupActivityLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          groupId: newTx.groupId,
          actionType: 'tx_added',
          actorName: user.name,
          actorEmail: user.email,
          message: `${user.name} added "${newTx.title}" (${user.currency}${newTx.amount.toLocaleString('en-IN')})`,
          timestamp: new Date().toISOString(),
          details: { txId: newTxId, txTitle: newTx.title, amount: newTx.amount, currency: user.currency },
        };
        setActivityLogs([newLog, ...activityLogs]);
        saveSupabaseActivityLog(newLog);
      }
    }

    setTransactions([newTx, ...transactions]);
    saveSupabaseTransaction(newTx);

    // Update account balance if account exists
    if (accounts.some(a => a.id === newTx.accountId)) {
      setAccounts(accounts.map(acc => {
        if (acc.id === newTx.accountId) {
          let updatedAcc: Account;
          if (acc.type === 'credit_card') {
            updatedAcc = { ...acc, dueAmount: (acc.dueAmount || 0) + newTx.amount };
          } else {
            updatedAcc = {
              ...acc,
              balance: newTx.type === 'income' ? acc.balance + newTx.amount : acc.balance - newTx.amount
            };
          }
          saveSupabaseAccount(updatedAcc);
          return updatedAcc;
        }
        return acc;
      }));
    }

    // If EMI linked, update loan
    if (newTx.emiId) {
      setLoans(loans.map(loan => {
        if (loan.id === newTx.emiId) {
          const updatedLoan = {
            ...loan,
            remainingPrincipal: Math.max(0, loan.remainingPrincipal - newTx.amount),
            paidTenureMonths: loan.paidTenureMonths + 1,
          };
          saveSupabaseLoan(updatedLoan);
          return updatedLoan;
        }
        return loan;
      }));
    }
  };

  // HANDLER: Add New Bank / Card Account
  const handleAddAccount = (accData: Partial<Account>) => {
    const newId = `acc-${Date.now().toString().slice(-6)}`;
    const newAccount: Account = {
      id: newId,
      name: accData.name || 'New Account',
      type: accData.type || 'bank',
      balance: accData.balance || 0,
      creditLimit: accData.creditLimit,
      dueAmount: accData.dueAmount,
      dueDate: accData.dueDate,
      currency: user.currency,
      bankName: accData.bankName,
      accountNumberLast4: accData.accountNumberLast4,
      color: accData.color || '#1E40AF',
      ownerEmail: user.email,
      sharedWith: [],
    };
    setAccounts([...accounts, newAccount]);
    saveSupabaseAccount(newAccount);
  };

  // HANDLER: Update Account Permissions
  const handleUpdateAccountPermissions = (accountId: string, permissions: AccountPermission[]) => {
    setAccounts(accounts.map(a => {
      if (a.id === accountId) {
        const updated = { ...a, sharedWith: permissions };
        saveSupabaseAccount(updated);
        return updated;
      }
      return a;
    }));
  };

  // HANDLER: Pay Credit Card Due
  const handlePayCreditCardDue = (cardId: string, fromBankId: string, amount: number) => {
    setAccounts(accounts.map(acc => {
      if (acc.id === cardId) {
        const updated = { ...acc, dueAmount: Math.max(0, (acc.dueAmount || 0) - amount) };
        saveSupabaseAccount(updated);
        return updated;
      }
      if (acc.id === fromBankId) {
        const updated = { ...acc, balance: acc.balance - amount };
        saveSupabaseAccount(updated);
        return updated;
      }
      return acc;
    }));

    const card = accounts.find(a => a.id === cardId);
    const fromBank = accounts.find(a => a.id === fromBankId);
    const nowIso = new Date().toISOString();
    const dateStr = nowIso.split('T')[0];
    const timestamp = Date.now();

    // 1. Debit transaction from bank account
    const debitTx: Transaction = {
      id: `tx-${timestamp}-dr`,
      date: dateStr,
      title: `Bill Payment - ${card?.name || 'Credit Card'}`,
      amount,
      type: 'expense',
      accountId: fromBankId,
      toAccountId: cardId,
      categoryId: 'cat-7',
      notes: `Bill payment of ${user.currency}${amount.toLocaleString('en-IN')} paid towards ${card?.name || 'Credit Card'}`,
      createdBy: user.email,
      updatedAt: nowIso,
    };

    // 2. Credit transaction on credit card account
    const creditTx: Transaction = {
      id: `tx-${timestamp + 1}-cr`,
      date: dateStr,
      title: `Payment Received - ${fromBank?.name || 'Bank'}`,
      amount,
      type: 'income',
      accountId: cardId,
      toAccountId: fromBankId,
      categoryId: 'cat-7',
      notes: `Payment of ${user.currency}${amount.toLocaleString('en-IN')} credited from ${fromBank?.name || 'Bank'}`,
      createdBy: user.email,
      updatedAt: nowIso,
    };

    setTransactions([debitTx, creditTx, ...transactions]);
    saveSupabaseTransaction(debitTx);
    saveSupabaseTransaction(creditTx);
  };

  // HANDLER: Transfer Funds Between Accounts
  const handleTransferFunds = (fromId: string, toId: string, amount: number, note: string) => {
    setAccounts(accounts.map(acc => {
      if (acc.id === fromId) {
        const updated = acc.type === 'credit_card'
          ? { ...acc, dueAmount: (acc.dueAmount || 0) + amount }
          : { ...acc, balance: acc.balance - amount };
        saveSupabaseAccount(updated);
        return updated;
      }
      if (acc.id === toId) {
        const updated = acc.type === 'credit_card'
          ? { ...acc, dueAmount: Math.max(0, (acc.dueAmount || 0) - amount) }
          : { ...acc, balance: acc.balance + amount };
        saveSupabaseAccount(updated);
        return updated;
      }
      return acc;
    }));

    const fromAcc = accounts.find(a => a.id === fromId);
    const toAcc = accounts.find(a => a.id === toId);
    const nowIso = new Date().toISOString();
    const dateStr = nowIso.split('T')[0];
    const timestamp = Date.now();

    // 1. Debit Transaction (From Source Account)
    const outTx: Transaction = {
      id: `tx-${timestamp}-dr`,
      date: dateStr,
      title: `Transfer to ${toAcc?.name || 'Account'}`,
      amount,
      type: 'expense',
      accountId: fromId,
      toAccountId: toId,
      categoryId: 'cat-9',
      notes: note || `Transferred ${user.currency}${amount.toLocaleString('en-IN')} to ${toAcc?.name || 'Account'}`,
      createdBy: user.email,
      updatedAt: nowIso,
    };

    // 2. Credit Transaction (Into Destination Account)
    const inTx: Transaction = {
      id: `tx-${timestamp + 1}-cr`,
      date: dateStr,
      title: `Transfer from ${fromAcc?.name || 'Account'}`,
      amount,
      type: 'income',
      accountId: toId,
      toAccountId: fromId,
      categoryId: 'cat-9',
      notes: note || `Received ${user.currency}${amount.toLocaleString('en-IN')} from ${fromAcc?.name || 'Account'}`,
      createdBy: user.email,
      updatedAt: nowIso,
    };

    setTransactions([outTx, inTx, ...transactions]);
    saveSupabaseTransaction(outTx);
    saveSupabaseTransaction(inTx);
  };

  // HANDLER: Edit Account
  const handleEditAccount = (accountId: string, updatedData: Partial<Account>) => {
    setAccounts(accounts.map(a => {
      if (a.id === accountId) {
        const updated = { ...a, ...updatedData };
        saveSupabaseAccount(updated);
        return updated;
      }
      return a;
    }));
  };

  // HANDLER: Delete Account
  const handleDeleteAccount = (accountId: string) => {
    setAccounts(accounts.filter(a => a.id !== accountId));
    deleteSupabaseAccount(accountId);
  };

  // HANDLER: Add Loan / EMI
  const handleAddLoan = (loanData: Partial<LoanEMI>) => {
    const newLoan: LoanEMI = {
      id: `emi-${Date.now().toString().slice(-6)}`,
      name: loanData.name || 'New Loan',
      lender: loanData.lender || 'Bank',
      totalPrincipal: loanData.totalPrincipal || 0,
      remainingPrincipal: loanData.remainingPrincipal || 0,
      interestRate: loanData.interestRate || 0,
      monthlyEMI: loanData.monthlyEMI || 0,
      totalTenureMonths: loanData.totalTenureMonths || 12,
      paidTenureMonths: loanData.paidTenureMonths || 0,
      linkedAccountId: loanData.linkedAccountId || (accounts.length > 0 ? accounts[0].id : 'acc-1'),
      startDate: loanData.startDate || new Date().toISOString().split('T')[0],
      nextDueDate: loanData.nextDueDate || '2026-09-05',
      category: loanData.category || 'Gadgets',
      notes: loanData.notes,
      status: 'active',
      userEmail: user.email,
      ownerEmail: user.email,
    };
    setLoans([...loans, newLoan]);
    saveSupabaseLoan(newLoan);
  };

  // HANDLER: Delete Loan
  const handleDeleteLoan = (loanId: string) => {
    setLoans(loans.filter(l => l.id !== loanId));
    deleteSupabaseLoan(loanId);
  };

  // HANDLER: Pay Monthly EMI
  const handlePayEMI = (emi: LoanEMI, fromAccountId: string, amount: number) => {
    // Deduct from bank
    setAccounts(accounts.map(a => {
      if (a.id === fromAccountId) {
        const updated = { ...a, balance: a.balance - amount };
        saveSupabaseAccount(updated);
        return updated;
      }
      return a;
    }));

    // Update Loan principal & tenure
    setLoans(loans.map(l => {
      if (l.id === emi.id) {
        const updated = {
          ...l,
          remainingPrincipal: Math.max(0, l.remainingPrincipal - amount),
          paidTenureMonths: l.paidTenureMonths + 1,
        };
        saveSupabaseLoan(updated);
        return updated;
      }
      return l;
    }));

    // Record Transaction
    const newTx: Transaction = {
      id: `tx-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      title: `${emi.name} - EMI #${emi.paidTenureMonths + 1}`,
      amount,
      type: 'emi_payment',
      accountId: fromAccountId,
      categoryId: 'cat-6',
      emiId: emi.id,
      notes: `Monthly EMI installment deducted`,
      createdBy: user.email,
      updatedAt: new Date().toISOString(),
    };
    setTransactions([newTx, ...transactions]);
    saveSupabaseTransaction(newTx);
  };

  // HANDLER: Create Group
  const handleCreateGroup = (grpData: Partial<Group>) => {
    const newGroupId = `grp-${Date.now().toString().slice(-6)}`;
    const newGroup: Group = {
      id: newGroupId,
      name: grpData.name || 'New Group',
      description: grpData.description || '',
      category: grpData.category || 'Trip',
      avatarColor: grpData.avatarColor || '#0EA5E9',
      currency: user.currency,
      createdBy: user.email,
      createdAt: new Date().toISOString().split('T')[0],
      members: grpData.members || [],
    };
    setGroups([...groups, newGroup]);
    setSelectedGroupId(newGroupId);
    saveSupabaseGroup(newGroup);

    // Add activity log
    const newLog: GroupActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      groupId: newGroupId,
      actionType: 'group_created',
      actorName: user.name,
      actorEmail: user.email,
      message: `${user.name} created the group "${newGroup.name}"`,
      timestamp: new Date().toISOString(),
    };
    setActivityLogs([newLog, ...activityLogs]);
    saveSupabaseActivityLog(newLog);
  };

  // HANDLER: Add Group Expense
  const handleAddGroupExpense = (
    groupId: string,
    data: {
      title: string;
      amount: number;
      categoryId: string;
      accountId: string;
      paidByMemberId: string;
      splitDetails: SplitMemberShare[];
      notes: string;
    }
  ) => {
    const newTxId = `tx-${Date.now().toString().slice(-6)}`;
    const newTx: Transaction = {
      id: newTxId,
      date: new Date().toISOString().split('T')[0],
      title: data.title,
      amount: data.amount,
      type: 'expense',
      accountId: data.accountId,
      categoryId: data.categoryId,
      groupId,
      paidByMemberId: data.paidByMemberId,
      splitDetails: data.splitDetails,
      notes: data.notes,
      createdBy: user.email,
      updatedAt: new Date().toISOString(),
    };

    setTransactions([newTx, ...transactions]);
    saveSupabaseTransaction(newTx);

    // Update account
    setAccounts(accounts.map(acc => {
      if (acc.id === data.accountId) {
        let updated: Account;
        if (acc.type === 'credit_card') {
          updated = { ...acc, dueAmount: (acc.dueAmount || 0) + data.amount };
        } else {
          updated = { ...acc, balance: acc.balance - data.amount };
        }
        saveSupabaseAccount(updated);
        return updated;
      }
      return acc;
    }));

    // Post Activity Log
    const deselected = data.splitDetails.filter(s => !s.isSelected);
    const grp = groups.find(g => g.id === groupId);
    const payer = grp?.members.find(m => m.id === data.paidByMemberId);

    let message = `${payer?.name || user.name} added "${data.title}" (${user.currency}${data.amount.toLocaleString('en-IN')})`;
    if (deselected.length > 0) {
      message += ` • Excluded: ${deselected.map(d => (d.memberName || 'Member').split(' ')[0]).join(', ')}`;
    }

    const newLog: GroupActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      groupId,
      actionType: 'tx_added',
      actorName: payer?.name || user.name,
      actorEmail: payer?.email || user.email,
      message,
      timestamp: new Date().toISOString(),
      details: {
        txId: newTxId,
        txTitle: data.title,
        amount: data.amount,
        currency: user.currency,
      },
    };
    setActivityLogs([newLog, ...activityLogs]);
    saveSupabaseActivityLog(newLog);
  };

  // HANDLER: Edit Group Expense
  const handleEditGroupExpense = (
    txId: string,
    data: {
      title: string;
      amount: number;
      date?: string;
      accountId?: string;
      paidByMemberId?: string;
      categoryId?: string;
      splitDetails: SplitMemberShare[];
      notes: string;
    }
  ) => {
    const existingTx = transactions.find(t => t.id === txId);
    if (!existingTx) return;

    // Account balance adjustment
    const oldAmount = existingTx.amount;
    const newAmount = data.amount;
    const oldAccountId = existingTx.accountId;
    const newAccountId = data.accountId || existingTx.accountId;

    if (oldAccountId === newAccountId) {
      const diff = newAmount - oldAmount;
      if (diff !== 0) {
        setAccounts(accounts.map(acc => {
          if (acc.id === oldAccountId) {
            let updated: Account;
            if (acc.type === 'credit_card') {
              updated = { ...acc, dueAmount: (acc.dueAmount || 0) + diff };
            } else {
              updated = { ...acc, balance: acc.balance - diff };
            }
            saveSupabaseAccount(updated);
            return updated;
          }
          return acc;
        }));
      }
    } else {
      // Revert old account deduction, apply to new account
      setAccounts(accounts.map(acc => {
        if (acc.id === oldAccountId) {
          let updated: Account;
          if (acc.type === 'credit_card') {
            updated = { ...acc, dueAmount: Math.max(0, (acc.dueAmount || 0) - oldAmount) };
          } else {
            updated = { ...acc, balance: acc.balance + oldAmount };
          }
          saveSupabaseAccount(updated);
          return updated;
        }
        if (acc.id === newAccountId) {
          let updated: Account;
          if (acc.type === 'credit_card') {
            updated = { ...acc, dueAmount: (acc.dueAmount || 0) + newAmount };
          } else {
            updated = { ...acc, balance: acc.balance - newAmount };
          }
          saveSupabaseAccount(updated);
          return updated;
        }
        return acc;
      }));
    }

    const updatedTx: Transaction = {
      ...existingTx,
      title: data.title,
      amount: data.amount,
      date: data.date || existingTx.date,
      accountId: newAccountId,
      paidByMemberId: data.paidByMemberId || existingTx.paidByMemberId,
      categoryId: data.categoryId || existingTx.categoryId,
      splitDetails: data.splitDetails,
      notes: data.notes,
      updatedAt: new Date().toISOString(),
    };

    setTransactions(transactions.map(t => t.id === txId ? updatedTx : t));
    saveSupabaseTransaction(updatedTx);

    if (existingTx.groupId) {
      const newLog: GroupActivityLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        groupId: existingTx.groupId,
        actionType: 'tx_edited',
        actorName: user.name,
        actorEmail: user.email,
        message: `${user.name} edited "${data.title}" (${user.currency}${data.amount.toLocaleString('en-IN')})`,
        timestamp: new Date().toISOString(),
        details: { txId, txTitle: data.title, amount: data.amount, currency: user.currency },
      };
      setActivityLogs([newLog, ...activityLogs]);
      saveSupabaseActivityLog(newLog);
    }
  };

  // HANDLER: Delete Group Expense
  const handleDeleteGroupExpense = (groupId: string, txId: string) => {
    const tx = transactions.find(t => t.id === txId);
    setTransactions(transactions.filter(t => t.id !== txId));
    deleteSupabaseTransaction(txId);

    const newLog: GroupActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      groupId,
      actionType: 'tx_deleted',
      actorName: user.name,
      actorEmail: user.email,
      message: `${user.name} deleted expense "${tx?.title || 'Expense'}"`,
      timestamp: new Date().toISOString(),
    };
    setActivityLogs([newLog, ...activityLogs]);
    saveSupabaseActivityLog(newLog);
  };

  // HANDLER: Add Group Member
  const handleAddGroupMember = (groupId: string, name: string, email: string) => {
    const newMemberId = `mem-${Date.now().toString().slice(-6)}`;
    const colors = ['#10B981', '#EC4899', '#F59E0B', '#8B5CF6', '#06B6D4'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newMember = {
      id: newMemberId,
      name,
      email,
      avatarColor: randomColor,
      role: 'member' as const,
      joinedAt: new Date().toISOString().split('T')[0],
    };

    setGroups(groups.map(g => {
      if (g.id === groupId) {
        const updated = { ...g, members: [...g.members, newMember] };
        saveSupabaseGroup(updated);
        return updated;
      }
      return g;
    }));

    const newLog: GroupActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      groupId,
      actionType: 'member_joined',
      actorName: name,
      actorEmail: email,
      message: `${name} joined the group`,
      timestamp: new Date().toISOString(),
    };
    setActivityLogs([newLog, ...activityLogs]);
    saveSupabaseActivityLog(newLog);
  };

  // HANDLER: Remove Group Member
  const handleRemoveGroupMember = (groupId: string, memberId: string, memberName: string) => {
    setGroups(groups.map(g => {
      if (g.id === groupId) {
        const updated = { ...g, members: g.members.filter(m => m.id !== memberId) };
        saveSupabaseGroup(updated);
        return updated;
      }
      return g;
    }));

    const newLog: GroupActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      groupId,
      actionType: 'member_left',
      actorName: memberName,
      actorEmail: '',
      message: `${memberName} left the group`,
      timestamp: new Date().toISOString(),
    };
    setActivityLogs([newLog, ...activityLogs]);
    saveSupabaseActivityLog(newLog);
  };

  // HANDLER: Settle Group Debt
  const handleSettleGroupDebt = (groupId: string, fromMemberId: string, toMemberId: string, amount: number, accountId: string) => {
    const grp = groups.find(g => g.id === groupId);
    const fromMember = grp?.members.find(m => m.id === fromMemberId);
    const toMember = grp?.members.find(m => m.id === toMemberId);

    const newTx: Transaction = {
      id: `tx-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      title: `Settlement: ${fromMember?.name} ➔ ${toMember?.name}`,
      amount,
      type: 'settlement',
      accountId,
      groupId,
      categoryId: 'cat-10',
      notes: 'Group debt settlement',
      createdBy: user.email,
      updatedAt: new Date().toISOString(),
    };

    setTransactions([newTx, ...transactions]);
    saveSupabaseTransaction(newTx);

    const newLog: GroupActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      groupId,
      actionType: 'settlement_made',
      actorName: fromMember?.name || 'Member',
      actorEmail: fromMember?.email || '',
      message: `${fromMember?.name} paid ${user.currency}${amount.toLocaleString('en-IN')} to ${toMember?.name} (Settlement)`,
      timestamp: new Date().toISOString(),
      details: { amount, currency: user.currency, targetMemberName: toMember?.name },
    };
    setActivityLogs([newLog, ...activityLogs]);
    saveSupabaseActivityLog(newLog);
  };

  // HANDLER: Settle Friend Debt
  const handleSettleFriendDebt = (friendId: string, amount: number, accountId: string, direction: 'they_paid_me' | 'i_paid_them') => {
    const friend = friends.find(f => f.id === friendId);
    if (!friend) return;

    setFriends(friends.map(f => {
      if (f.id === friendId) {
        const adjustment = direction === 'they_paid_me' ? -amount : amount;
        const updated = { ...f, netBalance: f.netBalance + adjustment, lastActivity: new Date().toISOString().split('T')[0] };
        saveSupabaseFriend(updated, user);
        return updated;
      }
      return f;
    }));

    // Update account balance
    setAccounts(accounts.map(a => {
      if (a.id === accountId) {
        const updated = {
          ...a,
          balance: direction === 'they_paid_me' ? a.balance + amount : a.balance - amount
        };
        saveSupabaseAccount(updated);
        return updated;
      }
      return a;
    }));

    const newTx: Transaction = {
      id: `tx-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      title: direction === 'they_paid_me' ? `Received from ${friend.name}` : `Paid to ${friend.name}`,
      amount,
      type: direction === 'they_paid_me' ? 'income' : 'expense',
      accountId,
      categoryId: 'cat-10',
      notes: `Direct friend balance settlement`,
      createdBy: user.email,
      updatedAt: new Date().toISOString(),
    };
    setTransactions([newTx, ...transactions]);
    saveSupabaseTransaction(newTx);
  };

  // HANDLER: Add Friend (Bidirectional)
  const handleAddFriend = (friendData: Partial<Friend>) => {
    const newFriend: Friend = {
      id: friendData.id || `fr-${Date.now().toString().slice(-6)}`,
      name: friendData.name || 'Friend',
      email: (friendData.email || '').trim().toLowerCase(),
      phone: friendData.phone,
      avatarColor: friendData.avatarColor || '#10B981',
      netBalance: friendData.netBalance || 0,
      lastActivity: new Date().toISOString().split('T')[0],
      userEmail: user.email,
      ownerEmail: user.email,
    };
    setFriends([...friends, newFriend]);
    saveSupabaseFriend(newFriend, user);
    return newFriend;
  };

  // HANDLER: Delete Friend
  const handleDeleteFriend = (friendId: string) => {
    const targetFriend = friends.find(f => f.id === friendId);
    setFriends(friends.filter(f => f.id !== friendId));
    deleteSupabaseFriend(friendId, user.email, targetFriend?.email);
  };

  // HANDLER: Edit Standalone / Group Transaction
  const handleEditTransaction = (txId: string, updatedData: Partial<Transaction>) => {
    const existingTx = transactions.find(t => t.id === txId);
    if (!existingTx) return;

    let updatedSplitDetails = updatedData.splitDetails || existingTx.splitDetails;

    // If amount changed for a group expense and splitDetails wasn't explicitly provided, scale shares proportionately
    if (updatedData.amount !== undefined && updatedData.amount !== existingTx.amount && existingTx.groupId && updatedSplitDetails) {
      const selectedMembers = updatedSplitDetails.filter(s => s.isSelected);
      const selectedCount = selectedMembers.length;
      if (selectedCount > 0) {
        const perPerson = Math.round((updatedData.amount / selectedCount) * 100) / 100;
        updatedSplitDetails = updatedSplitDetails.map(s => ({
          ...s,
          shareAmount: s.isSelected ? perPerson : 0,
          paidAmount: s.memberId === (existingTx.paidByMemberId || 'mem-1') ? updatedData.amount! : 0,
        }));
      }
    }

    const updated: Transaction = {
      ...existingTx,
      ...updatedData,
      splitDetails: updatedSplitDetails,
      updatedAt: new Date().toISOString(),
    };

    setTransactions(transactions.map(t => t.id === txId ? updated : t));
    saveSupabaseTransaction(updated);

    if (existingTx.groupId) {
      const newLog: GroupActivityLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        groupId: existingTx.groupId,
        actionType: 'tx_edited',
        actorName: user.name,
        actorEmail: user.email,
        message: `${user.name} edited "${updated.title}" (${user.currency}${updated.amount.toLocaleString('en-IN')})`,
        timestamp: new Date().toISOString(),
        details: { txId, txTitle: updated.title, amount: updated.amount, currency: user.currency },
      };
      setActivityLogs([newLog, ...activityLogs]);
      saveSupabaseActivityLog(newLog);
    }
  };

  // HANDLER: Delete Standalone Transaction
  const handleDeleteTransaction = (txId: string) => {
    setTransactions(transactions.filter(t => t.id !== txId));
    deleteSupabaseTransaction(txId);
  };

  // HANDLERS: Category Management (User-Scoped)
  const handleAddCategory = (newCat: Category) => {
    const userScopedCat: Category = {
      ...newCat,
      userEmail: user.email,
      isGlobal: false,
    };
    setCategories(prev => [...prev, userScopedCat]);
    saveSupabaseCategory(userScopedCat, user.email);
  };

  const handleEditCategory = (categoryId: string, updatedData: Partial<Category>) => {
    setCategories(categories.map(c => {
      if (c.id === categoryId) {
        const updated = { ...c, ...updatedData, userEmail: user.email, isGlobal: false };
        saveSupabaseCategory(updated, user.email);
        return updated;
      }
      return c;
    }));
  };

  const handleDeleteCategory = (categoryId: string, reassignCategoryId?: string) => {
    if (reassignCategoryId) {
      setTransactions(transactions.map(t => {
        if (t.categoryId === categoryId) {
          const updated = { ...t, categoryId: reassignCategoryId };
          saveSupabaseTransaction(updated);
          return updated;
        }
        return t;
      }));
    }
    setCategories(categories.filter(c => c.id !== categoryId));
    deleteSupabaseCategory(categoryId, user.email);
  };

  const handleResetCategories = async () => {
    const imported = await importGlobalCategoriesToUser(user.email);
    if (imported && imported.length > 0) {
      setCategories(imported);
    } else {
      setCategories(initialCategories);
    }
  };

  const handleUpdateCategoryBudget = (categoryId: string, budgetLimit?: number) => {
    setCategories(categories.map(c => {
      if (c.id === categoryId) {
        const updated = { ...c, budgetLimit, userEmail: user.email, isGlobal: false };
        saveSupabaseCategory(updated, user.email);
        return updated;
      }
      return c;
    }));

    if (budgetLimit !== undefined) {
      const now = new Date();
      saveSupabaseBudget({
        userEmail: user.email,
        categoryId,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        limitAmount: budgetLimit,
      });
    }
  };

  // ========================================================
  // HANDLERS: Rule Engine & Keyword Automation (User-Scoped)
  // ========================================================
  const handleAddRule = (newRule: Omit<TransactionRule, 'id' | 'createdAt' | 'matchCount'>) => {
    const rule: TransactionRule = {
      ...newRule,
      id: `rule-${Date.now().toString().slice(-6)}`,
      matchCount: 0,
      createdAt: new Date().toISOString(),
      userEmail: user.email,
      isGlobal: false,
    };
    setRules(prev => [rule, ...prev]);
    saveSupabaseRule(rule, user.email);
  };

  const handleEditRule = (ruleId: string, updatedData: Partial<TransactionRule>) => {
    setRules(prev => prev.map(r => {
      if (r.id === ruleId) {
        const updated = { ...r, ...updatedData, userEmail: user.email, isGlobal: false };
        saveSupabaseRule(updated, user.email);
        return updated;
      }
      return r;
    }));
  };

  const handleDeleteRule = (ruleId: string) => {
    setRules(prev => prev.filter(r => r.id !== ruleId));
    deleteSupabaseRule(ruleId, user.email);
  };

  const handleToggleRule = (ruleId: string) => {
    setRules(prev => prev.map(r => {
      if (r.id === ruleId) {
        const updated = { ...r, isEnabled: !r.isEnabled, userEmail: user.email, isGlobal: false };
        saveSupabaseRule(updated, user.email);
        return updated;
      }
      return r;
    }));
  };

  const handleIncrementRuleMatch = (ruleId: string) => {
    setRules(prev => prev.map(r => {
      if (r.id === ruleId) {
        const updated = { ...r, matchCount: (r.matchCount || 0) + 1, userEmail: user.email, isGlobal: false };
        saveSupabaseRule(updated, user.email);
        return updated;
      }
      return r;
    }));
  };

  const handleResetDefaultRules = async () => {
    const imported = await importGlobalRulesToUser(user.email);
    if (imported && imported.length > 0) {
      setRules(imported);
    } else {
      setRules(initialRules);
    }
  };

  const handleImportRules = (importedRules: TransactionRule[], mode: 'append' | 'replace') => {
    const userScopedRules = importedRules.map(r => ({
      ...r,
      userEmail: user.email,
      isGlobal: false,
    }));

    if (mode === 'replace') {
      setRules(userScopedRules);
    } else {
      setRules(prev => [...userScopedRules, ...prev]);
    }
    userScopedRules.forEach(r => saveSupabaseRule(r, user.email));
  };

  const handleApplyRulesToAllTransactions = () => {
    const { updatedTransactions, modifiedCount } = applyRulesToTransactionsList(transactions, rules);
    if (modifiedCount > 0) {
      setTransactions(updatedTransactions);
      updatedTransactions.forEach(t => saveSupabaseTransaction(t));
    }
    return modifiedCount;
  };

  // ========================================================
  // HANDLERS: Manage Dashboard Layout
  // ========================================================
  const handleSaveDashboardCards = (updatedCards: DashboardCardConfig[]) => {
    setDashboardCards(updatedCards);
  };

  const handleResetDashboardCards = () => {
    setDashboardCards(initialDashboardCards);
  };

  if (!user) {
    return <AuthView onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className={`h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row font-sans selection:bg-blue-600 selection:text-white overflow-hidden ${isPrivacyMode ? 'privacy-mode' : ''}`}>
      {/* Left Collapsible Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        netWorth={netWorth}
        totalDebts={totalDebts}
        onQuickAdd={() => setIsAddExpenseModalOpen(true)}
        onLogout={handleLogout}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
        {/* Top Sticky Header with Active View Title, Privacy Toggle & Profile Dropdown */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between shadow-xs">
          {/* Left: Tab Title */}
          <div className="flex items-center space-x-3">
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 capitalize tracking-tight flex items-center gap-2">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'transactions' && 'Transactions'}
              {activeTab === 'rules' && 'Rules & Automation'}
              {(activeTab === 'budgets' || activeTab === 'categories') && 'Budgets & Categories'}
              {activeTab === 'calendar' && 'Cashflow Calendar'}
              {activeTab === 'accounts' && 'Accounts'}
              {activeTab === 'loans' && 'Loans'}
              {activeTab === 'groups' && 'Splitwise'}
              {activeTab === 'friends' && 'Friends'}
              {activeTab === 'reports' && 'Financial Analytics'}
            </h1>
          </div>

          {/* Right: Privacy Toggle, Quick Action & User Profile Dropdown */}
          <div className="flex items-center space-x-2.5">
            {/* Eye Icon Privacy Toggle Button (Icon only, expands on hover) */}
            <button
              onClick={togglePrivacyMode}
              id="privacy-mode-toggle"
              className={`group flex items-center h-9 px-2.5 rounded-xl text-xs font-bold border transition-all duration-300 ease-out cursor-pointer active:scale-95 overflow-hidden ${
                isPrivacyMode 
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-xs' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-2xs'
              }`}
              title={isPrivacyMode ? "Privacy Mode ON (Hover to reveal text / Click to disable)" : "Privacy Mode OFF (Hover to reveal text / Click to enable)"}
            >
              <div className="flex items-center justify-center flex-shrink-0">
                {isPrivacyMode ? (
                  <EyeOff className="w-4 h-4 text-amber-600 transition-transform duration-300 group-hover:scale-110" />
                ) : (
                  <Eye className="w-4 h-4 text-slate-500 group-hover:text-slate-800 transition-all duration-300 group-hover:scale-110" />
                )}
              </div>
              <span className="max-w-0 opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-300 ease-out whitespace-nowrap overflow-hidden font-semibold select-none">
                {isPrivacyMode ? 'Masked' : 'Hide Numbers'}
              </span>
            </button>

            {/* Record Expense Button (Plus logo only, expands on hover) */}
            <button
              onClick={() => handleOpenAddExpense()}
              id="btn-quick-record-expense"
              className="group flex items-center h-9 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all duration-300 ease-out active:scale-95 cursor-pointer overflow-hidden"
              title="Record"
            >
              <div className="flex items-center justify-center flex-shrink-0">
                <Plus className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90 flex-shrink-0" />
              </div>
              <span className="max-w-0 opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-hover:ml-1.5 transition-all duration-300 ease-out whitespace-nowrap overflow-hidden font-bold select-none">
                Record
              </span>
            </button>

            {/* Notification Bell Component */}
            <NotificationBell
              user={user}
              accounts={accounts}
              loans={loans}
              groups={groups}
              transactions={transactions}
              activityLogs={activityLogs}
              onNavigateTab={(tab, payload) => {
                setActiveTab(tab);
                if (tab === 'groups' && typeof payload === 'string') {
                  setSelectedGroupId(payload);
                }
              }}
            />

            {/* Profile Dropdown Container */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                id="top-profile-menu-button"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 border border-slate-200/80 bg-white shadow-xs transition group cursor-pointer"
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="true"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-slate-200"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs flex-shrink-0"
                    style={{ backgroundColor: user.avatarColor || '#3B82F6' }}
                  >
                    {(user.name || user.email || 'U').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                  </div>
                )}
                <span className="text-xs font-bold text-slate-800 hidden sm:inline-block max-w-[130px] truncate">
                  {user.name || 'User'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 group-hover:text-slate-700 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* User Info Header */}
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-slate-200"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow flex-shrink-0"
                          style={{ backgroundColor: user.avatarColor || '#3B82F6' }}
                        >
                          {(user.name || user.email || 'U').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        <span className="inline-block mt-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60">
                          Currency: {user.currency}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="p-1 space-y-0.5">
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsManageDashboardOpen(true);
                      }}
                      id="menu-manage-dashboard"
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition text-left cursor-pointer"
                    >
                      <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                      <span>Manage Dashboard</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsDatabaseModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition text-left cursor-pointer"
                    >
                      <Database className="w-4 h-4 text-indigo-500" />
                      <span>Database & Storage</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition text-left cursor-pointer"
                    >
                      <User className="w-4 h-4 text-slate-500" />
                      <span>Edit Profile & Currency</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-100 my-1"></div>

                  {/* Logout Button */}
                  <div className="p-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Optional Logout Notice Banner */}
        {logoutNotice && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>{logoutNotice}</span>
            </div>
            <button 
              onClick={() => setLogoutNotice(null)}
              className="text-xs font-bold text-amber-900 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6">
          {activeTab === 'dashboard' && (
            <DashboardView
              user={user}
              accounts={accounts}
              transactions={transactions}
              loans={loans}
              groups={groups}
              friends={friends}
              categories={categories}
              cardsConfig={dashboardCards}
              onOpenAddExpense={() => setIsAddExpenseModalOpen(true)}
              onOpenAddAccount={() => {
                setActiveTab('accounts');
                setIsAddAccountModalTriggered(true);
              }}
              onOpenPayEMI={(emi) => {
                setActiveTab('loans');
              }}
              onOpenShareAccount={(acc) => {
                setActiveTab('accounts');
              }}
              onOpenPayCreditCard={(card) => {
                setActiveTab('accounts');
              }}
              onPayCreditCardDue={handlePayCreditCardDue}
              onSelectGroup={(groupId) => {
                setSelectedGroupId(groupId);
                setActiveTab('groups');
              }}
              onSelectFriend={(friendId) => {
                setActiveTab('friends');
              }}
              onNavigateTab={setActiveTab}
              onOpenManageDashboard={() => setIsManageDashboardOpen(true)}
            />
          )}

          {activeTab === 'rules' && (
            <RulesView
              user={user}
              rules={rules}
              categories={categories}
              accounts={accounts}
              transactions={transactions}
              onAddRule={handleAddRule}
              onEditRule={handleEditRule}
              onDeleteRule={handleDeleteRule}
              onToggleRule={handleToggleRule}
              onImportRules={handleImportRules}
              onApplyRulesToAll={handleApplyRulesToAllTransactions}
              onResetRules={handleResetDefaultRules}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsView
              user={user}
              transactions={transactions}
              accounts={accounts}
              categories={categories}
              loans={loans}
              groups={groups}
              onOpenAddExpense={() => handleOpenAddExpense()}
              onOpenCalendar={() => setActiveTab('calendar')}
              onEditTransaction={handleEditTransaction}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarView
              user={user}
              transactions={transactions}
              accounts={accounts}
              categories={categories}
              loans={loans}
              groups={groups}
              onOpenAddExpense={(prefillDate) => handleOpenAddExpense(prefillDate)}
              onOpenCategories={() => setActiveTab('categories')}
              onEditTransaction={handleEditTransaction}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {(activeTab === 'categories' || activeTab === 'budgets') && (
            <CategoriesView
              user={user}
              categories={categories}
              transactions={transactions}
              onAddCategory={handleAddCategory}
              onEditCategory={handleEditCategory}
              onDeleteCategory={handleDeleteCategory}
              onResetCategories={handleResetCategories}
              onUpdateUserBudget={(budget) => {
                const updated = { ...user, monthlyBudget: budget };
                setUser(updated);
                saveSupabaseProfile(updated);
              }}
              onUpdateCategoryBudget={handleUpdateCategoryBudget}
            />
          )}

          {activeTab === 'accounts' && (
            <AccountsView
              user={user}
              accounts={accounts}
              initialOpenAddModal={isAddAccountModalTriggered}
              onCloseInitialOpenAddModal={() => setIsAddAccountModalTriggered(false)}
              onAddAccount={handleAddAccount}
              onEditAccount={handleEditAccount}
              onDeleteAccount={handleDeleteAccount}
              onUpdateAccountPermissions={handleUpdateAccountPermissions}
              onPayCreditCardDue={handlePayCreditCardDue}
              onTransferFunds={handleTransferFunds}
            />
          )}

          {activeTab === 'loans' && (
            <LoansView
              user={user}
              loans={loans}
              accounts={accounts}
              onAddLoan={handleAddLoan}
              onPayEMI={handlePayEMI}
              onDeleteLoan={handleDeleteLoan}
            />
          )}

          {activeTab === 'groups' && (
            <GroupsView
              user={user}
              groups={groups}
              friends={friends}
              activityLogs={activityLogs}
              transactions={transactions}
              accounts={accounts}
              selectedGroupId={selectedGroupId}
              onSelectGroup={setSelectedGroupId}
              onCreateGroup={handleCreateGroup}
              onAddGroupExpense={handleAddGroupExpense}
              onEditGroupExpense={handleEditGroupExpense}
              onDeleteGroupExpense={handleDeleteGroupExpense}
              onAddGroupMember={handleAddGroupMember}
              onRemoveGroupMember={handleRemoveGroupMember}
              onSettleGroupDebt={handleSettleGroupDebt}
              onAddFriend={handleAddFriend}
            />
          )}

          {activeTab === 'friends' && (
            <FriendsView
              user={user}
              friends={friends}
              transactions={transactions}
              accounts={accounts}
              onAddFriend={handleAddFriend}
              onSettleFriendDebt={handleSettleFriendDebt}
              onDeleteFriend={handleDeleteFriend}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              user={user}
              accounts={accounts}
              transactions={transactions}
              loans={loans}
              groups={groups}
              friends={friends}
              categories={categories}
            />
          )}
        </main>
      </div>

      {/* Global Quick Add Expense Modal */}
      <AddExpenseModal
        isOpen={isAddExpenseModalOpen}
        onClose={() => {
          setIsAddExpenseModalOpen(false);
          setAddExpensePrefillDate(undefined);
        }}
        user={user}
        accounts={accounts}
        categories={categories}
        loans={loans}
        groups={groups}
        rules={rules}
        initialDate={addExpensePrefillDate}
        onSaveExpense={handleSaveExpense}
        onIncrementRuleMatch={handleIncrementRuleMatch}
      />

      {/* Manage Dashboard Cards Modal */}
      <ManageDashboardModal
        isOpen={isManageDashboardOpen}
        onClose={() => setIsManageDashboardOpen(false)}
        cardsConfig={dashboardCards}
        onUpdateCardsConfig={handleSaveDashboardCards}
        onResetToDefault={handleResetDashboardCards}
      />

      {/* User Profile Settings Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onSave={handleSaveProfile}
      />

      {/* Database & Storage Modal */}
      {isDatabaseModalOpen && user && (
        <DatabaseModal
          isOpen={isDatabaseModalOpen}
          onClose={() => setIsDatabaseModalOpen(false)}
          user={user}
          accounts={accounts}
          transactions={transactions}
          categories={categories}
          loans={loans}
          rules={rules}
          onRestoreFromSheets={(restored) => {
            if (restored.accounts && restored.accounts.length > 0) setAccounts(restored.accounts);
            if (restored.transactions && restored.transactions.length > 0) setTransactions(restored.transactions);
            if (restored.categories && restored.categories.length > 0) setCategories(restored.categories);
            if (restored.loans && restored.loans.length > 0) setLoans(restored.loans);
            if (restored.rules && restored.rules.length > 0) setRules(restored.rules);
          }}
        />
      )}
    </div>
  );
}

