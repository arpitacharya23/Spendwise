import React, { useState, useMemo, useEffect } from 'react';
import {
  Landmark,
  CreditCard,
  Wallet,
  Plus,
  Share2,
  ShieldCheck,
  Trash2,
  ArrowRightLeft,
  Calendar,
  AlertCircle,
  Eye,
  Edit3,
  Users,
  Search,
  X,
  Lock,
  ArrowUpRight,
} from 'lucide-react';
import { Account, AccountPermission, UserProfile } from '../types';
import { INDIAN_BANKS, getBankForAccount, getBankByName } from '../data/indianBanks';
import { getAccountAccess } from '../lib/accountPermissions';

interface AccountsViewProps {
  user: UserProfile;
  accounts: Account[];
  initialOpenAddModal?: boolean;
  onCloseInitialOpenAddModal?: () => void;
  onAddAccount: (account: Partial<Account>) => void;
  onEditAccount?: (accountId: string, updatedData: Partial<Account>) => void;
  onDeleteAccount?: (accountId: string) => void;
  onUpdateAccountPermissions: (accountId: string, permissions: AccountPermission[]) => void;
  onPayCreditCardDue: (cardId: string, fromBankId: string, amount: number) => void;
  onTransferFunds: (fromId: string, toId: string, amount: number, note: string) => void;
}

const ACCOUNT_COLORS = ['#1E40AF', '#047857', '#B91C1C', '#0284C7', '#D97706', '#6D28D9', '#0F172A'];

export const AccountsView: React.FC<AccountsViewProps> = ({
  user,
  accounts,
  initialOpenAddModal = false,
  onCloseInitialOpenAddModal,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onUpdateAccountPermissions,
  onPayCreditCardDue,
  onTransferFunds,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'bank' | 'credit_card'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(initialOpenAddModal);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [sharingAccount, setSharingAccount] = useState<Account | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [payingCard, setPayingCard] = useState<Account | null>(null);

  useEffect(() => {
    if (initialOpenAddModal) {
      setIsAddModalOpen(true);
      if (onCloseInitialOpenAddModal) {
        onCloseInitialOpenAddModal();
      }
    }
  }, [initialOpenAddModal, onCloseInitialOpenAddModal]);

  // New Account Form
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'bank' | 'credit_card' | 'cash'>('bank');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [newAccLimit, setNewAccLimit] = useState('');
  const [newAccDue, setNewAccDue] = useState('');
  const [newAccDueDate, setNewAccDueDate] = useState('');
  const [newAccBank, setNewAccBank] = useState('');
  const [newAccLast4, setNewAccLast4] = useState('');
  const [newAccColor, setNewAccColor] = useState('#1E40AF');

  // Edit Account Form
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'bank' | 'credit_card' | 'cash'>('bank');
  const [editBalance, setEditBalance] = useState('');
  const [editLimit, setEditLimit] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editBank, setEditBank] = useState('');
  const [editLast4, setEditLast4] = useState('');
  const [editColor, setEditColor] = useState('#1E40AF');

  // Share permission form
  const [shareEmail, setShareEmail] = useState('');
  const [shareName, setShareName] = useState('');
  const [shareRole, setShareRole] = useState<'view' | 'edit'>('view');

  // Transfer form
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');

  // Pay card form
  const [payFromBank, setPayFromBank] = useState('');
  const [payAmount, setPayAmount] = useState('');

  const bankAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'bank' || a.type === 'cash' || a.type === 'investment'),
    [accounts]
  );
  const creditCards = useMemo(
    () => accounts.filter((a) => a.type === 'credit_card'),
    [accounts]
  );

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accounts.filter((acc) => {
      if (activeTab === 'bank' && acc.type !== 'bank' && acc.type !== 'cash' && acc.type !== 'investment') {
        return false;
      }
      if (activeTab === 'credit_card' && acc.type !== 'credit_card') {
        return false;
      }
      if (!q) return true;
      return (
        acc.name.toLowerCase().includes(q) ||
        (acc.bankName || '').toLowerCase().includes(q) ||
        (acc.accountNumberLast4 || '').toLowerCase().includes(q) ||
        acc.type.replace('_', ' ').toLowerCase().includes(q)
      );
    });
  }, [accounts, activeTab, searchQuery]);

  // Summary metrics
  const totalLiquidBalance = bankAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalCardDue = creditCards.reduce((sum, a) => sum + (a.dueAmount || 0), 0);
  const totalCardLimit = creditCards.reduce((sum, a) => sum + (a.creditLimit || 0), 0);
  const overallUtilization = totalCardLimit > 0 ? Math.min(100, Math.round((totalCardDue / totalCardLimit) * 100)) : 0;
  const netCashPosition = totalLiquidBalance - totalCardDue;

  // Transactable accounts for transfers and bill payments
  const transferableBankAccounts = bankAccounts.filter((a) => getAccountAccess(a, user.email).canTransact);
  const payableBankAccounts = transferableBankAccounts;

  const formatDueDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return dateStr;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getTypeLabel = (type: Account['type']) => {
    if (type === 'credit_card') return 'Credit Card';
    if (type === 'cash') return 'Cash Wallet';
    if (type === 'investment') return 'Investment';
    return 'Bank Account';
  };

  const handleOpenEditAccount = (acc: Account) => {
    const access = getAccountAccess(acc, user.email);
    if (!access.canEdit) return;
    setEditingAccount(acc);
    setEditName(acc.name);
    setEditType(acc.type === 'credit_card' || acc.type === 'cash' ? acc.type : 'bank');
    setEditBalance(String(acc.balance || 0));
    setEditLimit(acc.creditLimit !== undefined ? String(acc.creditLimit) : '');
    setEditDue(acc.dueAmount !== undefined ? String(acc.dueAmount) : '');
    setEditDueDate(acc.dueDate || '');
    setEditBank(acc.bankName || '');
    setEditLast4(acc.accountNumberLast4 || '');
    setEditColor(acc.color || '#1E40AF');
  };

  const handleSaveEditAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount || !editName) return;
    const access = getAccountAccess(editingAccount, user.email);
    if (!access.canEdit) return;

    if (onEditAccount) {
      onEditAccount(editingAccount.id, {
        name: editName,
        type: editType,
        balance: Number(editBalance) || 0,
        creditLimit: editType === 'credit_card' ? Number(editLimit) || 0 : undefined,
        dueAmount: editType === 'credit_card' ? Number(editDue) || 0 : undefined,
        dueDate: editType === 'credit_card' ? editDueDate : undefined,
        bankName: editBank || 'Bank',
        accountNumberLast4: editLast4,
        color: editColor,
      });
    }
    setEditingAccount(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingAccountId) return;
    const target = accounts.find((a) => a.id === deletingAccountId);
    if (!target || !getAccountAccess(target, user.email).canDelete) {
      setDeletingAccountId(null);
      return;
    }
    if (onDeleteAccount) {
      onDeleteAccount(deletingAccountId);
    }
    setDeletingAccountId(null);
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName) return;

    onAddAccount({
      name: newAccName,
      type: newAccType,
      balance: Number(newAccBalance) || 0,
      creditLimit: newAccType === 'credit_card' ? Number(newAccLimit) || 0 : undefined,
      dueAmount: newAccType === 'credit_card' ? Number(newAccDue) || 0 : undefined,
      dueDate: newAccType === 'credit_card' ? newAccDueDate : undefined,
      bankName: newAccBank || (newAccType === 'cash' ? 'Cash' : 'Bank'),
      accountNumberLast4: newAccLast4,
      color: newAccColor,
      currency: user.currency,
      ownerEmail: user.email,
      sharedWith: [],
    });

    setIsAddModalOpen(false);
    setNewAccName('');
    setNewAccBalance('');
    setNewAccLimit('');
    setNewAccDue('');
    setNewAccDueDate('');
    setNewAccLast4('');
    setNewAccBank('');
    setNewAccColor('#1E40AF');
  };

  const handleAddSharePermission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharingAccount || !shareEmail) return;
    const access = getAccountAccess(sharingAccount, user.email);
    if (!access.canManagePermissions) return;

    const newPerm: AccountPermission = {
      email: shareEmail,
      name: shareName || (shareEmail ? shareEmail.split('@')[0] : 'Member'),
      role: shareRole,
      addedAt: new Date().toISOString().split('T')[0],
    };

    const updated = [
      ...(sharingAccount.sharedWith || []).filter((p) => p.email.toLowerCase() !== shareEmail.toLowerCase()),
      newPerm,
    ];
    onUpdateAccountPermissions(sharingAccount.id, updated);
    setSharingAccount({ ...sharingAccount, sharedWith: updated });
    setShareEmail('');
    setShareName('');
  };

  const handleRemovePermission = (email: string) => {
    if (!sharingAccount) return;
    const access = getAccountAccess(sharingAccount, user.email);
    if (!access.canManagePermissions) return;

    const updated = (sharingAccount.sharedWith || []).filter((p) => p.email !== email);
    onUpdateAccountPermissions(sharingAccount.id, updated);
    setSharingAccount({ ...sharingAccount, sharedWith: updated });
  };

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferFrom || !transferTo || !transferAmount || transferFrom === transferTo) return;
    const fromAcc = accounts.find((a) => a.id === transferFrom);
    if (!fromAcc || !getAccountAccess(fromAcc, user.email).canTransact) return;

    onTransferFunds(transferFrom, transferTo, Number(transferAmount), transferNote || 'Account transfer');
    setIsTransferModalOpen(false);
    setTransferAmount('');
    setTransferNote('');
  };

  const handleExecutePayCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCard || !payFromBank || !payAmount) return;
    const fromBankAcc = accounts.find((a) => a.id === payFromBank);
    if (!fromBankAcc || !getAccountAccess(fromBankAcc, user.email).canTransact) return;
    if (!getAccountAccess(payingCard, user.email).canTransact) return;

    onPayCreditCardDue(payingCard.id, payFromBank, Number(payAmount));
    setPayingCard(null);
    setPayAmount('');
  };

  const openPayCardModal = (card: Account) => {
    setPayingCard(card);
    setPayAmount(String(card.dueAmount || 0));
    const preferredBank =
      payableBankAccounts.find((b) => b.balance >= (card.dueAmount || 0)) || payableBankAccounts[0];
    setPayFromBank(preferredBank ? preferredBank.id : '');
  };

  const renderAccountCard = (acc: Account) => {
    const isCard = acc.type === 'credit_card';
    const isCash = acc.type === 'cash';
    const due = acc.dueAmount || 0;
    const limit = acc.creditLimit || 0;
    const available = Math.max(0, limit - due);
    const utilization = limit > 0 ? Math.min(100, Math.round((due / limit) * 100)) : 0;
    const formattedDueDate = formatDueDate(acc.dueDate);
    const access = getAccountAccess(acc, user.email);
    const bankInfo = getBankForAccount(acc);

    const utilizationColor =
      utilization >= 75 ? 'bg-rose-500' : utilization >= 40 ? 'bg-amber-500' : 'bg-blue-600';

    return (
      <article
        key={acc.id}
        className="group relative bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between overflow-hidden"
      >
        {/* Subtle 3px top accent stripe identifying account color */}
        <div className="h-1 w-full" style={{ backgroundColor: acc.color || '#1E40AF' }} />

        <div className="p-5 flex-1 flex flex-col justify-between">
          <div>
            {/* Card Header: Bank emblem + Title + Unboxed Metadata + Actions */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    bankInfo ? 'bg-white border border-slate-200/80 p-1.5' : 'text-white'
                  }`}
                  style={!bankInfo ? { backgroundColor: acc.color || '#1E40AF' } : undefined}
                >
                  {bankInfo ? (
                    <img
                      src={bankInfo.symbolUrl}
                      alt={bankInfo.name}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 object-contain"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.src.endsWith('.png')) {
                          target.src = bankInfo.symbolPngUrl;
                        }
                      }}
                    />
                  ) : isCard ? (
                    <CreditCard className="w-5 h-5" />
                  ) : isCash ? (
                    <Wallet className="w-5 h-5" />
                  ) : (
                    <Landmark className="w-5 h-5" />
                  )}
                </div>

                <div className="min-w-0">
                  <h3 className="font-bold text-[15px] text-slate-900 leading-snug truncate">
                    {acc.name}
                  </h3>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
                    <span className="truncate">{acc.bankName || getTypeLabel(acc.type)}</span>
                    {acc.accountNumberLast4 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-slate-600">
                          •••• {acc.accountNumberLast4}
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{getTypeLabel(acc.type)}</span>
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-0.5 flex-shrink-0 -mr-1 -mt-1">
                {access.canEdit && (
                  <button
                    type="button"
                    onClick={() => handleOpenEditAccount(acc)}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Edit Account"
                    aria-label={`Edit ${acc.name}`}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSharingAccount(acc)}
                  className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                  title={access.canManagePermissions ? 'Manage Shared Permissions' : 'View People with Access'}
                  aria-label={`Share settings for ${acc.name}`}
                >
                  <Share2 className="w-4 h-4" />
                </button>

                {access.canDelete && onDeleteAccount && (
                  <button
                    type="button"
                    onClick={() => setDeletingAccountId(acc.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete Account"
                    aria-label={`Delete ${acc.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Balance / Statement Section — separated by whitespace, no inner card box */}
            <div className="mt-6">
              {isCard ? (
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-500">Statement Due</span>
                    {formattedDueDate && (
                      <span
                        className={`inline-flex items-center gap-1 font-medium tabular-nums ${
                          due > 0 ? 'text-rose-600' : 'text-slate-500'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        Due {formattedDueDate}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <span
                      className={`text-2xl font-bold tracking-tight tabular-nums privacy-value ${
                        due > 0 ? 'text-rose-600' : 'text-slate-900'
                      }`}
                    >
                      {acc.currency}
                      {due.toLocaleString('en-IN')}
                    </span>
                    {limit > 0 && (
                      <span className="text-xs font-medium text-slate-500 tabular-nums">
                        {utilization}% used
                      </span>
                    )}
                  </div>

                  {/* Credit Utilization Meter */}
                  <div className="mt-3">
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${utilizationColor}`}
                        style={{ width: `${utilization}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500 tabular-nums">
                      <span>
                        Available{' '}
                        <strong className="font-semibold text-slate-800 privacy-value">
                          {acc.currency}
                          {available.toLocaleString('en-IN')}
                        </strong>
                      </span>
                      <span>
                        Limit{' '}
                        <span className="font-medium text-slate-700 privacy-value">
                          {acc.currency}
                          {limit.toLocaleString('en-IN')}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="text-xs font-medium text-slate-500 block">Available Balance</span>
                  <div className="text-2xl font-bold tracking-tight text-slate-900 mt-1 tabular-nums privacy-value">
                    {acc.currency}
                    {acc.balance.toLocaleString('en-IN')}
                  </div>
                </div>
              )}
            </div>

            {/* Clean Inline Collaboration / Permission Metadata (Unboxed) */}
            {(!access.isOwner || (acc.sharedWith && acc.sharedWith.length > 0)) && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-600">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  {access.isOwner ? (
                    <span className="truncate">
                      Shared with{' '}
                      <strong className="font-semibold text-slate-800">
                        {acc.sharedWith
                          .map((p) => p.name || (p.email ? p.email.split('@')[0] : 'Member'))
                          .join(', ')}
                      </strong>
                    </span>
                  ) : (
                    <span className="truncate">
                      Owner <strong className="font-semibold text-slate-800">{acc.ownerEmail || 'Account Owner'}</strong>
                    </span>
                  )}
                </div>

                {!access.isOwner && (
                  <span
                    className={`inline-flex items-center gap-1 font-semibold flex-shrink-0 ${
                      access.role === 'view'
                        ? 'text-amber-700'
                        : access.role === 'edit'
                        ? 'text-emerald-700'
                        : 'text-blue-700'
                    }`}
                  >
                    {access.role === 'view' ? (
                      <>
                        <Eye className="w-3.5 h-3.5" /> View only
                      </>
                    ) : access.role === 'edit' ? (
                      <>
                        <Edit3 className="w-3.5 h-3.5" /> Can edit
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" /> Admin
                      </>
                    )}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Card Footer Action */}
          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
            {isCard ? (
              access.canTransact ? (
                <button
                  type="button"
                  onClick={() => openPayCardModal(acc)}
                  className={`w-full py-2 px-4 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    due > 0
                      ? 'bg-slate-900 hover:bg-slate-800 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span>{due > 0 ? 'Pay Card Due' : 'Record Card Payment'}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="w-full py-2 px-3 bg-slate-50 text-slate-500 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>View Only · Payments Restricted</span>
                </div>
              )
            ) : access.canTransact ? (
              <button
                type="button"
                onClick={() => {
                  setTransferFrom(acc.id);
                  setIsTransferModalOpen(true);
                }}
                className="w-full py-2 px-4 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                <span>Transfer Funds</span>
              </button>
            ) : (
              <div className="w-full py-2 px-3 bg-slate-50 text-slate-500 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>View Only · Transfers Restricted</span>
              </div>
            )}
          </div>
        </div>
      </article>
    );
  };

  const selectedNewBankAsset = getBankByName(newAccBank);
  const selectedEditBankAsset = getBankByName(editBank);

  return (
    <div className="space-y-6 pb-12">
      {/* Unified Treasury Summary Bar & Primary Actions */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-0 sm:divide-x sm:divide-slate-200/80 flex-1">
            {/* Metric 1: Liquid Balance */}
            <div className="sm:pr-6">
              <span className="text-xs font-medium text-slate-500 block">Bank & Cash Balance</span>
              <div className="text-2xl font-bold tracking-tight text-slate-900 mt-1 tabular-nums privacy-value">
                {user.currency}
                {totalLiquidBalance.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                Across {bankAccounts.length} {bankAccounts.length === 1 ? 'account' : 'accounts'}
              </p>
            </div>

            {/* Metric 2: Cards Due */}
            <div className="sm:px-6">
              <span className="text-xs font-medium text-slate-500 block">Credit Cards Due</span>
              <div
                className={`text-2xl font-bold tracking-tight mt-1 tabular-nums privacy-value ${
                  totalCardDue > 0 ? 'text-rose-600' : 'text-slate-900'
                }`}
              >
                {user.currency}
                {totalCardDue.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {creditCards.length === 0
                  ? 'No credit cards added'
                  : totalCardLimit > 0
                  ? `${overallUtilization}% of ${user.currency}${totalCardLimit.toLocaleString('en-IN')} limit`
                  : `${creditCards.length} active ${creditCards.length === 1 ? 'card' : 'cards'}`}
              </p>
            </div>

            {/* Metric 3: Net Cash Position */}
            <div className="sm:pl-6">
              <span className="text-xs font-medium text-slate-500 block">Net Account Position</span>
              <div
                className={`text-2xl font-bold tracking-tight mt-1 tabular-nums privacy-value ${
                  netCashPosition >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {netCashPosition < 0 ? '-' : ''}
                {user.currency}
                {Math.abs(netCashPosition).toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {accounts.length} total active {accounts.length === 1 ? 'account' : 'accounts'}
              </p>
            </div>
          </div>

          {/* Primary Actions */}
          <div className="flex items-center gap-2.5 flex-shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-600" />
              <span>Transfer</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              id="btn-add-account"
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs transition-colors active:scale-[0.98] cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Account</span>
            </button>
          </div>
        </div>
      </section>

      {/* Filter Bar: Segmented View Tabs + Search Input */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl self-start"
          role="tablist"
          aria-label="Filter accounts by type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({accounts.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bank'}
            onClick={() => setActiveTab('bank')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
              activeTab === 'bank'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bank & Cash ({bankAccounts.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'credit_card'}
            onClick={() => setActiveTab('credit_card')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
              activeTab === 'credit_card'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Credit Cards ({creditCards.length})
          </button>
        </div>

        {/* Live Search Filter */}
        {accounts.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bank, name, last 4..."
              className="w-full pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Accounts Content Area */}
      {filteredAccounts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
          <div className="w-14 h-14 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {searchQuery
              ? 'No matching accounts'
              : activeTab === 'credit_card'
              ? 'No Credit Cards Added'
              : activeTab === 'bank'
              ? 'No Bank or Cash Accounts Added'
              : 'No Accounts or Cards Yet'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5 mb-6">
            {searchQuery
              ? `No accounts matched "${searchQuery}". Try another bank name or clear your search.`
              : 'Add your bank accounts, cash wallets, or credit cards to track balances, card dues, transfers, and shared access.'}
          </p>
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Clear Search
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Account / Card</span>
            </button>
          )}
        </div>
      ) : activeTab === 'all' && !searchQuery && bankAccounts.length > 0 && creditCards.length > 0 ? (
        /* Organized Section Split when viewing All Accounts with both types present */
        <div className="space-y-8">
          <section className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <h2 className="text-sm font-bold text-slate-900">
                Bank & Cash Accounts
              </h2>
              <span className="text-xs font-medium text-slate-500 tabular-nums privacy-value">
                {bankAccounts.length} {bankAccounts.length === 1 ? 'account' : 'accounts'} · Total {user.currency}
                {totalLiquidBalance.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {bankAccounts.map(renderAccountCard)}
            </div>
          </section>

          <section className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <h2 className="text-sm font-bold text-slate-900">
                Credit Cards
              </h2>
              <span className="text-xs font-medium text-slate-500 tabular-nums privacy-value">
                {creditCards.length} {creditCards.length === 1 ? 'card' : 'cards'} · Due {user.currency}
                {totalCardDue.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {creditCards.map(renderAccountCard)}
            </div>
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAccounts.map(renderAccountCard)}
        </div>
      )}

      {/* MODAL 1: Add New Account or Card */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add New Account or Card</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Connect a bank account, credit card, or cash wallet to your ledger.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'bank', label: 'Bank Account' },
                    { id: 'credit_card', label: 'Credit Card' },
                    { id: 'cash', label: 'Cash Wallet' },
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setNewAccType(type.id as 'bank' | 'credit_card' | 'cash')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border text-center transition cursor-pointer ${
                        newAccType === type.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Salary, Amex Gold, Main Wallet"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bank / Provider</label>
                  <div className="relative flex items-center">
                    {selectedNewBankAsset && (
                      <img
                        src={selectedNewBankAsset.symbolUrl}
                        alt={selectedNewBankAsset.name}
                        referrerPolicy="no-referrer"
                        className="w-4 h-4 object-contain absolute left-3 pointer-events-none"
                      />
                    )}
                    <select
                      value={newAccBank}
                      onChange={(e) => setNewAccBank(e.target.value)}
                      className={`w-full ${
                        selectedNewBankAsset ? 'pl-9 pr-3' : 'px-3.5'
                      } py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 bg-white`}
                    >
                      <option value="">Select Bank / Provider</option>
                      {INDIAN_BANKS.map((b) => (
                        <option key={b.slug} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Last 4 Digits</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="e.g. 4821"
                    value={newAccLast4}
                    onChange={(e) => setNewAccLast4(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                  />
                </div>
              </div>

              {newAccType === 'credit_card' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Total Credit Limit</label>
                      <input
                        type="number"
                        placeholder="e.g. 200000"
                        value={newAccLimit}
                        onChange={(e) => setNewAccLimit(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Current Due Amount</label>
                      <input
                        type="number"
                        placeholder="e.g. 15000"
                        value={newAccDue}
                        onChange={(e) => setNewAccDue(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Due Date</label>
                    <input
                      type="date"
                      value={newAccDueDate}
                      onChange={(e) => setNewAccDueDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Starting Balance ({user.currency})
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 50000"
                    value={newAccBalance}
                    onChange={(e) => setNewAccBalance(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Accent Color</label>
                <div className="flex items-center gap-2.5">
                  {ACCOUNT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewAccColor(c)}
                      aria-label={`Select color ${c}`}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                        newAccColor === c ? 'scale-115 ring-2 ring-offset-2 ring-slate-900' : 'hover:scale-110 opacity-80'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Share Account Edit / View Permissions */}
      {sharingAccount && (() => {
        const sharingAccess = getAccountAccess(sharingAccount, user.email);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {sharingAccess.canManagePermissions ? 'Share Account Access' : 'Account Access Details'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Account: <strong className="text-slate-800">{sharingAccount.name}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSharingAccount(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {sharingAccess.canManagePermissions ? (
                <form
                  onSubmit={handleAddSharePermission}
                  className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 mb-4 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="email"
                      required
                      placeholder="Collaborator email"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      className="px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                    />
                    <input
                      type="text"
                      placeholder="Name / Label (optional)"
                      value={shareName}
                      onChange={(e) => setShareName(e.target.value)}
                      className="px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="role"
                          checked={shareRole === 'view'}
                          onChange={() => setShareRole('view')}
                          className="accent-blue-600"
                        />
                        <span className="flex items-center gap-1 text-slate-700 font-medium">
                          <Eye className="w-3.5 h-3.5 text-slate-500" /> View Only
                        </span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="role"
                          checked={shareRole === 'edit'}
                          onChange={() => setShareRole('edit')}
                          className="accent-blue-600"
                        />
                        <span className="flex items-center gap-1 text-slate-700 font-medium">
                          <Edit3 className="w-3.5 h-3.5 text-blue-600" /> Can Edit & Transact
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Grant Access
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 mb-4 flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold block">Read-Only Permission View</strong>
                    This account is owned by <strong>{sharingAccount.ownerEmail || 'another user'}</strong>. Only the
                    account owner can invite or revoke access.
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold text-slate-500 mb-2">People with Access</h3>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  <div className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900">
                        {sharingAccount.ownerEmail === user.email
                          ? `${user.name} (You)`
                          : sharingAccount.ownerEmail || 'Account Owner'}
                      </span>
                      <p className="text-[11px] text-slate-500">{sharingAccount.ownerEmail || user.email}</p>
                    </div>
                    <span className="text-xs font-semibold text-blue-700">Owner</span>
                  </div>

                  {sharingAccount.sharedWith &&
                    sharingAccount.sharedWith.map((perm) => {
                      const isSelf = perm.email.toLowerCase() === user.email.toLowerCase();
                      return (
                        <div key={perm.email} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-slate-900">
                              {perm.name || perm.email} {isSelf ? '(You)' : ''}
                            </span>
                            <p className="text-[11px] text-slate-500">
                              {perm.email} · Added {perm.addedAt}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-semibold ${
                                perm.role === 'edit' ? 'text-emerald-700' : 'text-slate-600'
                              }`}
                            >
                              {perm.role === 'edit' ? 'Can Edit' : 'View Only'}
                            </span>
                            {sharingAccess.canManagePermissions && (
                              <button
                                type="button"
                                onClick={() => handleRemovePermission(perm.email)}
                                className="text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="Revoke Permission"
                                aria-label={`Revoke permission for ${perm.email}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSharingAccount(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 3: Transfer Funds */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Transfer Funds</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Move money between accounts with instant balance updates.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  From Account
                </label>
                <select
                  required
                  value={transferFrom}
                  onChange={(e) => setTransferFrom(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 bg-white"
                >
                  <option value="">Select source account</option>
                  {transferableBankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency}
                      {a.balance.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">To Account</label>
                <select
                  required
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 bg-white"
                >
                  <option value="">Select destination account</option>
                  {accounts
                    .filter((a) => a.id !== transferFrom)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (
                        {a.type === 'credit_card'
                          ? `Due: ${a.currency}${(a.dueAmount || 0).toLocaleString('en-IN')}`
                          : `Balance: ${a.currency}${a.balance.toLocaleString('en-IN')}`}
                        )
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Amount ({user.currency})
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="e.g. 5000"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly savings transfer"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Transfer Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Pay Credit Card Due */}
      {payingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Pay Credit Card Bill</h2>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {payingCard.name} · Current due{' '}
                  <strong className="text-rose-600">
                    {payingCard.currency}
                    {(payingCard.dueAmount || 0).toLocaleString('en-IN')}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayingCard(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecutePayCard} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pay From Bank Account</label>
                <select
                  required
                  value={payFromBank}
                  onChange={(e) => setPayFromBank(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 bg-white"
                >
                  <option value="">Select bank account</option>
                  {payableBankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Balance: {a.currency}
                      {a.balance.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Payment Amount ({user.currency})
                  </label>
                  {(payingCard.dueAmount || 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setPayAmount(String(payingCard.dueAmount || 0))}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      Pay Full Due
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayingCard(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Edit Account */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit Account / Card</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update account details, balances, limits, or styling.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account / Card Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. HDFC Savings or ICICI Amazon Pay"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Type</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as 'bank' | 'credit_card' | 'cash')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 bg-white"
                  >
                    <option value="bank">Bank Account</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="cash">Cash Wallet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bank / Institution</label>
                  <div className="relative flex items-center">
                    {selectedEditBankAsset && (
                      <img
                        src={selectedEditBankAsset.symbolUrl}
                        alt={selectedEditBankAsset.name}
                        referrerPolicy="no-referrer"
                        className="w-4 h-4 object-contain absolute left-3 pointer-events-none"
                      />
                    )}
                    <select
                      value={editBank}
                      onChange={(e) => setEditBank(e.target.value)}
                      className={`w-full ${
                        selectedEditBankAsset ? 'pl-9 pr-3' : 'px-3.5'
                      } py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 bg-white`}
                    >
                      <option value="">Select Bank / Institution</option>
                      {editBank && !INDIAN_BANKS.some((b) => b.name === editBank) && (
                        <option value={editBank}>{editBank}</option>
                      )}
                      {INDIAN_BANKS.map((b) => (
                        <option key={b.slug} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {editType === 'credit_card' ? (
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Total Credit Limit</label>
                      <input
                        type="number"
                        value={editLimit}
                        onChange={(e) => setEditLimit(e.target.value)}
                        placeholder="200000"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Current Due Amount</label>
                      <input
                        type="number"
                        value={editDue}
                        onChange={(e) => setEditDue(e.target.value)}
                        placeholder="4500"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Next Statement Due Date</label>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Current Balance ({user.currency})
                  </label>
                  <input
                    type="number"
                    value={editBalance}
                    onChange={(e) => setEditBalance(e.target.value)}
                    placeholder="25000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Last 4 Digits</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={editLast4}
                    onChange={(e) => setEditLast4(e.target.value.replace(/\D/g, ''))}
                    placeholder="1234"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Accent Color</label>
                  <div className="flex items-center gap-2 pt-1.5">
                    {ACCOUNT_COLORS.slice(0, 6).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        aria-label={`Select color ${c}`}
                        className={`w-6 h-6 rounded-full transition cursor-pointer ${
                          editColor === c ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'opacity-75 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Delete Account Confirmation */}
      {deletingAccountId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Delete Account?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Are you sure you want to delete this account? Historical transactions will remain stored.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingAccountId(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
