import React, { useState } from 'react';
import { 
  Landmark, 
  CreditCard, 
  Plus, 
  Share2, 
  ShieldCheck, 
  UserPlus, 
  Trash2, 
  ArrowRightLeft, 
  CheckCircle2, 
  Calendar,
  DollarSign,
  AlertCircle,
  Eye,
  Edit3,
  Users
} from 'lucide-react';
import { Account, AccountPermission, UserProfile } from '../types';

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
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(initialOpenAddModal);

  React.useEffect(() => {
    if (initialOpenAddModal) {
      setIsAddModalOpen(true);
      if (onCloseInitialOpenAddModal) {
        onCloseInitialOpenAddModal();
      }
    }
  }, [initialOpenAddModal, onCloseInitialOpenAddModal]);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [sharingAccount, setSharingAccount] = useState<Account | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [payingCard, setPayingCard] = useState<Account | null>(null);

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

  const filteredAccounts = accounts.filter(acc => {
    if (activeTab === 'all') return true;
    return acc.type === activeTab;
  });

  const bankAccounts = accounts.filter(a => a.type === 'bank' || a.type === 'cash');
  const creditCards = accounts.filter(a => a.type === 'credit_card');

  const handleOpenEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setEditName(acc.name);
    setEditType((acc.type === 'credit_card' || acc.type === 'cash') ? acc.type : 'bank');
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
    if (deletingAccountId && onDeleteAccount) {
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
      bankName: newAccBank || 'Bank',
      accountNumberLast4: newAccLast4,
      color: newAccColor,
      currency: user.currency,
      ownerEmail: user.email,
      sharedWith: [],
    });

    setIsAddModalOpen(false);
    // Reset
    setNewAccName('');
    setNewAccBalance('');
    setNewAccLimit('');
    setNewAccDue('');
    setNewAccLast4('');
    setNewAccBank('');
  };

  const handleAddSharePermission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharingAccount || !shareEmail) return;

    const newPerm: AccountPermission = {
      email: shareEmail,
      name: shareName || shareEmail.split('@')[0],
      role: shareRole,
      addedAt: new Date().toISOString().split('T')[0],
    };

    const updated = [...(sharingAccount.sharedWith || []), newPerm];
    onUpdateAccountPermissions(sharingAccount.id, updated);
    setSharingAccount({ ...sharingAccount, sharedWith: updated });
    setShareEmail('');
    setShareName('');
  };

  const handleRemovePermission = (email: string) => {
    if (!sharingAccount) return;
    const updated = (sharingAccount.sharedWith || []).filter(p => p.email !== email);
    onUpdateAccountPermissions(sharingAccount.id, updated);
    setSharingAccount({ ...sharingAccount, sharedWith: updated });
  };

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferFrom || !transferTo || !transferAmount || transferFrom === transferTo) return;
    onTransferFunds(transferFrom, transferTo, Number(transferAmount), transferNote || 'Account transfer');
    setIsTransferModalOpen(false);
    setTransferAmount('');
    setTransferNote('');
  };

  const handleExecutePayCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCard || !payFromBank || !payAmount) return;
    onPayCreditCardDue(payingCard.id, payFromBank, Number(payAmount));
    setPayingCard(null);
    setPayAmount('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Action Toolbar */}
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <button
          onClick={() => setIsTransferModalOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold text-sm transition"
        >
          <ArrowRightLeft className="w-4 h-4 text-blue-600" />
          <span>Transfer Funds</span>
        </button>

        <button
          onClick={() => setIsAddModalOpen(true)}
          id="btn-add-account"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-sm transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Account / Card</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          All Accounts ({accounts.length})
        </button>
        <button
          onClick={() => setActiveTab('bank')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === 'bank'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Bank & Cash ({bankAccounts.length})
        </button>
        <button
          onClick={() => setActiveTab('credit_card')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            activeTab === 'credit_card'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Credit Cards ({creditCards.length})
        </button>
      </div>

      {/* Accounts Grid */}
      {filteredAccounts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Accounts or Cards Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Add your bank accounts, cash wallets, or credit cards to start tracking transactions, bill payments, and shared permissions.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Account / Card</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAccounts.map((acc) => {
          const isCard = acc.type === 'credit_card';
          const due = acc.dueAmount || 0;
          const limit = acc.creditLimit || 0;
          const available = Math.max(0, limit - due);

          return (
            <div
              key={acc.id}
              className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                {/* Top Badge & Share Info */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                      style={{ backgroundColor: acc.color }}
                    >
                      {isCard ? <CreditCard className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {acc.type.replace('_', ' ')}
                      </span>
                      <h3 className="font-bold text-base text-slate-900 mt-1">{acc.name}</h3>
                      <p className="text-xs text-slate-700">
                        {acc.bankName} {acc.accountNumberLast4 ? `•••• ${acc.accountNumberLast4}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditAccount(acc)}
                      className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-amber-600 transition"
                      title="Edit Account"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setSharingAccount(acc)}
                      className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition"
                      title="Manage Shared Permissions"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>

                    {onDeleteAccount && (
                      <button
                        onClick={() => setDeletingAccountId(acc.id)}
                        className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-rose-600 transition"
                        title="Delete Account"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Balance or Due Section */}
                <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  {isCard ? (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">Total Due Amount</span>
                        {acc.dueDate && (
                          <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded">
                            Due: {new Date(acc.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <div className="text-2xl font-extrabold text-rose-600 mt-1 privacy-value">
                        {acc.currency}{due.toLocaleString()}
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-200 text-xs flex justify-between text-slate-700">
                        <span>Available: <strong className="text-slate-800 privacy-value">{acc.currency}{available.toLocaleString()}</strong></span>
                        <span>Limit: <span className="privacy-value">{acc.currency}{limit.toLocaleString()}</span></span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs font-semibold text-slate-700">Current Available Balance</span>
                      <div className="text-2xl font-extrabold text-slate-900 mt-1 privacy-value">
                        {acc.currency}{acc.balance.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Shared Friends (Only shown if account is shared) */}
                {acc.sharedWith && acc.sharedWith.length > 0 && (
                  <div className="mt-3.5 flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50/80 px-3 py-2 rounded-xl border border-indigo-100/90">
                    <Users className="w-3.5 h-3.5 flex-shrink-0 text-indigo-600" />
                    <span className="truncate">
                      Shared with: <strong className="font-semibold text-indigo-900">{acc.sharedWith.map(p => p.name || p.email.split('@')[0]).join(', ')}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                {isCard ? (
                  <button
                    onClick={() => {
                      setPayingCard(acc);
                      setPayAmount(String(acc.dueAmount || 0));
                    }}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                  >
                    Pay Credit Card Due
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setTransferFrom(acc.id);
                      setIsTransferModalOpen(true);
                    }}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition"
                  >
                    Transfer from this Account
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* MODAL 1: Add New Account or Card */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Add New Account or Credit Card</h2>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Account Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'bank', label: 'Bank Account' },
                    { id: 'credit_card', label: 'Credit Card' },
                    { id: 'cash', label: 'Cash Wallet' }
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setNewAccType(type.id as any)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border text-center transition ${
                        newAccType === type.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Salary, Amex Gold, Main Wallet"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Bank / Provider</label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC, Chase, ICICI"
                    value={newAccBank}
                    onChange={(e) => setNewAccBank(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Last 4 Digits</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="e.g. 4821"
                    value={newAccLast4}
                    onChange={(e) => setNewAccLast4(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
              </div>

              {newAccType === 'credit_card' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Total Credit Limit</label>
                      <input
                        type="number"
                        placeholder="e.g. 200000"
                        value={newAccLimit}
                        onChange={(e) => setNewAccLimit(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Current Due Amount</label>
                      <input
                        type="number"
                        placeholder="e.g. 15000"
                        value={newAccDue}
                        onChange={(e) => setNewAccDue(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Payment Due Date</label>
                    <input
                      type="date"
                      value={newAccDueDate}
                      onChange={(e) => setNewAccDueDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Starting Balance ({user.currency})</label>
                  <input
                    type="number"
                    placeholder="e.g. 50000"
                    value={newAccBalance}
                    onChange={(e) => setNewAccBalance(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Card / Tag Color</label>
                <div className="flex items-center gap-2">
                  {['#1E40AF', '#B91C1C', '#0284C7', '#EA580C', '#059669', '#7C3AED', '#DB2777'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewAccColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${newAccColor === c ? 'scale-125 ring-2 ring-slate-900' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Share Account Edit / View Permissions */}
      {sharingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Share Account Access</h2>
                <p className="text-xs text-slate-700">Account: <strong>{sharingAccount.name}</strong></p>
              </div>
              <button 
                onClick={() => setSharingAccount(null)}
                className="text-slate-700 hover:text-slate-900 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Invite Form */}
            <form onSubmit={handleAddSharePermission} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 mb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="email"
                  required
                  placeholder="Collaborator email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
                <input
                  type="text"
                  placeholder="Name / Label (optional)"
                  value={shareName}
                  onChange={(e) => setShareName(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      checked={shareRole === 'view'}
                      onChange={() => setShareRole('view')}
                      className="text-blue-600"
                    />
                    <span className="flex items-center gap-1 text-slate-700">
                      <Eye className="w-3.5 h-3.5 text-slate-700" /> View Only
                    </span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      checked={shareRole === 'edit'}
                      onChange={() => setShareRole('edit')}
                      className="text-blue-600"
                    />
                    <span className="flex items-center gap-1 text-slate-700">
                      <Edit3 className="w-3.5 h-3.5 text-blue-600" /> Can Edit & Transact
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  Grant Access
                </button>
              </div>
            </form>

            {/* Existing Shared Users List */}
            <div>
              <h3 className="text-xs font-bold uppercase text-slate-700 mb-2">People with Access</h3>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                <div className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-900">{user.name} (You)</span>
                    <p className="text-[11px] text-slate-700">{user.email}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded text-[10px]">
                    Owner
                  </span>
                </div>

                {sharingAccount.sharedWith && sharingAccount.sharedWith.map((perm) => (
                  <div key={perm.email} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900">{perm.name || perm.email}</span>
                      <p className="text-[11px] text-slate-700">{perm.email} • Added {perm.addedAt}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        perm.role === 'edit' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {perm.role === 'edit' ? 'Can Edit' : 'View Only'}
                      </span>
                      <button
                        onClick={() => handleRemovePermission(perm.email)}
                        className="text-rose-700 hover:text-rose-900 p-1 rounded hover:bg-rose-50 transition"
                        title="Revoke Permission"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSharingAccount(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Transfer Funds */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Transfer Funds Between Accounts</h2>
            <p className="text-xs text-slate-700 mb-4">Move money from one bank/wallet to another with instant balance updates.</p>

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">From Account</label>
                <select
                  required
                  value={transferFrom}
                  onChange={(e) => setTransferFrom(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                >
                  <option value="">Select source account</option>
                  {bankAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency}{a.balance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">To Account</label>
                <select
                  required
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                >
                  <option value="">Select destination account</option>
                  {accounts.filter(a => a.id !== transferFrom).map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type === 'credit_card' ? `Due: ${a.currency}${a.dueAmount}` : `Balance: ${a.currency}${a.balance}`})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Amount ({user.currency})</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 5000"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly savings transfer"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm"
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
            <h2 className="text-xl font-bold text-slate-900 mb-1">Pay Credit Card Bill</h2>
            <p className="text-xs text-slate-700 mb-4">
              Card: <strong>{payingCard.name}</strong> • Due: <strong className="text-rose-600">{payingCard.currency}{payingCard.dueAmount?.toLocaleString()}</strong>
            </p>

            <form onSubmit={handleExecutePayCard} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Pay From Bank Account</label>
                <select
                  required
                  value={payFromBank}
                  onChange={(e) => setPayFromBank(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                >
                  <option value="">Select bank account</option>
                  {bankAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Balance: {a.currency}{a.balance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Payment Amount ({user.currency})</label>
                <input
                  type="number"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPayingCard(null)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm"
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
            <h2 className="text-xl font-bold text-slate-900 mb-1">Edit Account / Card</h2>
            <p className="text-xs text-slate-500 mb-4">
              Update account details, balances, limits, or styling.
            </p>

            <form onSubmit={handleSaveEditAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Account / Card Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Chase Sapphire or HDFC Savings"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Type</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  >
                    <option value="bank">Bank Account</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="cash">Cash Wallet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Bank / Institution</label>
                  <input
                    type="text"
                    value={editBank}
                    onChange={(e) => setEditBank(e.target.value)}
                    placeholder="e.g. Chase, HDFC, Wells Fargo"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
              </div>

              {editType === 'credit_card' ? (
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Total Credit Limit</label>
                      <input
                        type="number"
                        value={editLimit}
                        onChange={(e) => setEditLimit(e.target.value)}
                        placeholder="5000"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Current Due Amount</label>
                      <input
                        type="number"
                        value={editDue}
                        onChange={(e) => setEditDue(e.target.value)}
                        placeholder="450"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Next Statement Due Date</label>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Current Balance ({user.currency})</label>
                  <input
                    type="number"
                    value={editBalance}
                    onChange={(e) => setEditBalance(e.target.value)}
                    placeholder="2500"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Last 4 Digits</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={editLast4}
                    onChange={(e) => setEditLast4(e.target.value.replace(/\D/g, ''))}
                    placeholder="1234"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Badge Color</label>
                  <div className="flex items-center gap-2 pt-1">
                    {['#1E40AF', '#047857', '#B91C1C', '#D97706', '#6D28D9', '#0F172A'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        className={`w-7 h-7 rounded-full transition ${editColor === c ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'opacity-70 hover:opacity-100'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm"
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
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingAccountId(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs shadow-sm transition"
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
