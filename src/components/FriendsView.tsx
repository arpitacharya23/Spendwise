import React, { useState } from 'react';
import { 
  UserCheck, 
  UserPlus, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CheckCircle2, 
  Phone, 
  Mail, 
  HandCoins,
  Sparkles,
  Check,
  AlertCircle
} from 'lucide-react';
import { Account, Friend, Transaction, UserProfile } from '../types';

interface FriendsViewProps {
  user: UserProfile;
  friends: Friend[];
  transactions: Transaction[];
  accounts: Account[];
  onAddFriend: (friend: Partial<Friend>) => void;
  onSettleFriendDebt: (friendId: string, amount: number, accountId: string, direction: 'they_paid_me' | 'i_paid_them') => void;
}

// Helper to format clean display name from email
function inferNameFromEmail(email: string): string {
  const username = email.split('@')[0] || '';
  if (!username) return 'Friend';
  
  // Remove numbers and special characters from start/end
  const cleaned = username.replace(/[0-9_.-]+$/g, '').replace(/^[0-9_.-]+/g, '');
  const parts = (cleaned || username).split(/[._-]+/).filter(Boolean);
  
  if (parts.length === 0) return 'Friend';
  
  return parts
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  user,
  friends,
  transactions,
  accounts,
  onAddFriend,
  onSettleFriendDebt,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(friends[0] || null);

  // Modals
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);

  // Add / Find Friend Form State
  const [emailQuery, setEmailQuery] = useState('');
  const [friendName, setFriendName] = useState('');
  const [friendPhone, setFriendPhone] = useState('');
  const [friendColor, setFriendColor] = useState('#10B981');
  const [addSuccessMessage, setAddSuccessMessage] = useState<string | null>(null);

  // Settle Form
  const [settleAmount, setSettleAmount] = useState('');
  const [settleAccountId, setSettleAccountId] = useState('');
  const [settleDirection, setSettleDirection] = useState<'they_paid_me' | 'i_paid_them'>('they_paid_me');

  // Overall totals
  const totalOwedToMe = friends.reduce((sum, f) => f.netBalance > 0 ? sum + f.netBalance : sum, 0);
  const totalIOwe = friends.reduce((sum, f) => f.netBalance < 0 ? sum + Math.abs(f.netBalance) : sum, 0);

  const trimmedSearch = searchTerm.trim();
  const isSearchAnEmail = trimmedSearch.includes('@');
  
  const filteredFriends = friends.filter(f => 
    f.name.toLowerCase().includes(trimmedSearch.toLowerCase()) || 
    f.email.toLowerCase().includes(trimmedSearch.toLowerCase())
  );

  const exactEmailFriendMatch = friends.find(
    f => f.email.toLowerCase() === (emailQuery.trim().toLowerCase() || trimmedSearch.toLowerCase())
  );

  const handleOpenAddModalWithEmail = (initialEmail: string = '') => {
    setEmailQuery(initialEmail);
    if (initialEmail) {
      setFriendName(inferNameFromEmail(initialEmail));
    } else {
      setFriendName('');
    }
    setFriendPhone('');
    setFriendColor('#10B981');
    setAddSuccessMessage(null);
    setIsAddFriendModalOpen(true);
  };

  const handleEmailInputChange = (val: string) => {
    setEmailQuery(val);
    // If the name hasn't been manually set or matches previous auto-inferred, auto-infer from new email
    if (val.includes('@')) {
      const suggested = inferNameFromEmail(val);
      if (!friendName || friendName === 'Friend') {
        setFriendName(suggested);
      }
    }
  };

  const handleCreateFriend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetEmail = emailQuery.trim();
    if (!targetEmail) return;

    // Check if friend with email already exists
    const existing = friends.find(f => f.email.toLowerCase() === targetEmail.toLowerCase());
    if (existing) {
      setSelectedFriend(existing);
      setIsAddFriendModalOpen(false);
      setSearchTerm('');
      return;
    }

    const finalName = friendName.trim() || inferNameFromEmail(targetEmail);
    const newFriendId = `fr-${Date.now().toString().slice(-6)}`;
    const newFriend: Friend = {
      id: newFriendId,
      name: finalName,
      email: targetEmail,
      phone: friendPhone.trim() || undefined,
      avatarColor: friendColor,
      netBalance: 0,
      lastActivity: new Date().toISOString().split('T')[0],
    };

    onAddFriend(newFriend);
    setSelectedFriend(newFriend);
    setIsAddFriendModalOpen(false);
    setSearchTerm('');
    setEmailQuery('');
    setFriendName('');
    setFriendPhone('');
    setAddSuccessMessage(`Added ${finalName} (${targetEmail}) to your friends list!`);
    setTimeout(() => setAddSuccessMessage(null), 4000);
  };

  const handleExecuteSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriend || !settleAmount) return;

    onSettleFriendDebt(
      selectedFriend.id,
      Number(settleAmount),
      settleAccountId || accounts[0]?.id || 'acc-1',
      settleDirection
    );

    setIsSettleModalOpen(false);
    setSettleAmount('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Friends
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Find friends by email, split shared expenses, and track debt balances.</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleOpenAddModalWithEmail('')}
            id="btn-find-friend-email"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Find Friend by Email</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {addSuccessMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-800 animate-fadeIn">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{addSuccessMessage}</span>
          </div>
          <button 
            onClick={() => setAddSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-xs transition flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase text-slate-500">You are owed by friends</span>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1 privacy-value">
              +{user.currency}{totalOwedToMe.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Money to collect from friends</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        <div className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-xs transition flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase text-slate-500">You owe friends</span>
            <div className="text-2xl font-extrabold text-rose-700 mt-1 privacy-value">
              -{user.currency}{totalIOwe.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Pending payments you need to clear</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Friends Layout */}
      {friends.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-2xs">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserCheck className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Friends Added Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Find a friend by typing their email address to add them to your list, track IOUs, and split group expenses.
          </p>
          <button
            onClick={() => handleOpenAddModalWithEmail('')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Find Friend by Email</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Friends Search & List */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Find friend by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-slate-50/50"
              />
            </div>

            {/* If user searched an email and it's NOT in the list yet, show a quick-add card */}
            {isSearchAnEmail && !exactEmailFriendMatch && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2 text-xs animate-fadeIn">
                <div className="flex items-center gap-2 text-blue-900 font-semibold">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span className="truncate">Email not in list: {trimmedSearch}</span>
                </div>
                <button
                  onClick={() => handleOpenAddModalWithEmail(trimmedSearch)}
                  className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add {inferNameFromEmail(trimmedSearch)} to List</span>
                </button>
              </div>
            )}

            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {filteredFriends.length === 0 && !isSearchAnEmail ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  <p>No friend matched "{searchTerm}".</p>
                  <button
                    onClick={() => handleOpenAddModalWithEmail(searchTerm.includes('@') ? searchTerm : '')}
                    className="mt-2 text-blue-600 font-bold hover:underline inline-flex items-center gap-1"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Find or Add by Email</span>
                  </button>
                </div>
              ) : (
                filteredFriends.map((f) => {
                  const isSelected = selectedFriend?.id === f.id;
                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFriend(f)}
                      className={`group p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-400 shadow-2xs'
                          : 'bg-white border-slate-200/80 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-2xs flex-shrink-0"
                          style={{ backgroundColor: f.avatarColor }}
                        >
                          {f.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-slate-900 truncate">{f.name}</h4>
                          <p className="text-[11px] text-slate-500 truncate">{f.email}</p>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0 pl-2">
                        {f.netBalance > 0 ? (
                          <div>
                            <span className="text-[10px] font-bold text-emerald-700 uppercase block">owes you</span>
                            <span className="text-xs font-extrabold text-emerald-700 privacy-value">
                              +{user.currency}{f.netBalance.toLocaleString()}
                            </span>
                          </div>
                        ) : f.netBalance < 0 ? (
                          <div>
                            <span className="text-[10px] font-bold text-rose-700 uppercase block">you owe</span>
                            <span className="text-xs font-extrabold text-rose-700 privacy-value">
                              -{user.currency}{Math.abs(f.netBalance).toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Settled</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Selected Friend Detail */}
          {selectedFriend ? (
            <div className="group lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between">
              <div>
                {/* Friend Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                  <div className="flex items-center space-x-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg shadow-2xs flex-shrink-0"
                      style={{ backgroundColor: selectedFriend.avatarColor }}
                    >
                      {selectedFriend.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-900">{selectedFriend.name}</h3>
                      <div className="flex items-center flex-wrap gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400" /> {selectedFriend.email}
                        </span>
                        {selectedFriend.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-slate-400" /> {selectedFriend.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Settle Action Button */}
                  <button
                    onClick={() => {
                      setSettleAmount(String(Math.abs(selectedFriend.netBalance)));
                      setSettleDirection(selectedFriend.netBalance > 0 ? 'they_paid_me' : 'i_paid_them');
                      setIsSettleModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer"
                  >
                    <HandCoins className="w-4 h-4" />
                    <span>Settle Balance (<span className="privacy-value">{user.currency}{Math.abs(selectedFriend.netBalance).toLocaleString()}</span>)</span>
                  </button>
                </div>

                {/* Balance Hero */}
                <div className="mt-6 p-5 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase text-slate-500">Net Standing Balance</span>
                    <div className="text-3xl font-extrabold mt-1">
                      {selectedFriend.netBalance > 0 ? (
                        <span className="text-emerald-700"><span className="privacy-value">+{user.currency}{selectedFriend.netBalance.toLocaleString()}</span> <span className="text-xs font-semibold text-slate-500">(Owes You)</span></span>
                      ) : selectedFriend.netBalance < 0 ? (
                        <span className="text-rose-700"><span className="privacy-value">-{user.currency}{Math.abs(selectedFriend.netBalance).toLocaleString()}</span> <span className="text-xs font-semibold text-slate-500">(You Owe)</span></span>
                      ) : (
                        <span className="text-slate-700">All Settled Up 🎉</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right text-xs text-slate-500">
                    <span>Last Activity: </span>
                    <strong className="text-slate-800">{selectedFriend.lastActivity}</strong>
                  </div>
                </div>

                {/* Shared Activities with Friend */}
                <div className="mt-6">
                  <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">Mutual Transactions & Group Splits</h4>
                  <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-2">
                    <p>
                      Track shared expenses, group settlements, and debt balances directly with <strong>{selectedFriend.name}</strong> ({selectedFriend.email}).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs flex flex-col items-center justify-center">
              <UserCheck className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">Select a friend to view balance and settle up</p>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Find Friend by Email / Add Friend */}
      {isAddFriendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Find Friend by Email</h2>
                <p className="text-xs text-slate-500 mt-0.5">Enter an email address to find or add them to your friends list.</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
            </div>

            <form onSubmit={handleCreateFriend} className="space-y-4">
              {/* Email Input */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="e.g. friend.name@example.com"
                    value={emailQuery}
                    onChange={(e) => handleEmailInputChange(e.target.value)}
                    className="w-full pl-9.5 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium"
                  />
                </div>
              </div>

              {/* Status Detection Banner */}
              {exactEmailFriendMatch ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span><strong>{exactEmailFriendMatch.name}</strong> is already in your friends list!</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFriend(exactEmailFriendMatch);
                      setIsAddFriendModalOpen(false);
                    }}
                    className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 text-xs transition cursor-pointer"
                  >
                    View Friend
                  </button>
                </div>
              ) : emailQuery.includes('@') && emailQuery.length > 5 ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-900">
                  <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Found new contact! Confirm display name to add to your list.</span>
                </div>
              ) : null}

              {/* Friend's Full Name (Auto-inferred or manual) */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Friend's Display Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sameer Verma"
                  value={friendName}
                  onChange={(e) => setFriendName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              {/* Phone Number (Optional) */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Phone Number (optional)</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={friendPhone}
                  onChange={(e) => setFriendPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              {/* Avatar Color Picker */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">Avatar Color</label>
                <div className="flex items-center gap-2.5">
                  {['#10B981', '#EC4899', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFriendColor(c)}
                      className={`w-7 h-7 rounded-xl transition-transform cursor-pointer ${friendColor === c ? 'scale-120 ring-2 ring-slate-900 shadow-sm' : 'hover:scale-110 opacity-80 hover:opacity-100'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddFriendModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(exactEmailFriendMatch) || !emailQuery.includes('@')}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add to Friends List</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Settle Debt */}
      {isSettleModalOpen && selectedFriend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Settle Up with {selectedFriend.name}</h2>
            <p className="text-xs text-slate-500 mb-4">Record a direct cash or bank transfer payment.</p>

            <form onSubmit={handleExecuteSettle} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Payment Direction</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettleDirection('they_paid_me')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition cursor-pointer ${
                      settleDirection === 'they_paid_me'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {selectedFriend.name.split(' ')[0]} paid me
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettleDirection('i_paid_them')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition cursor-pointer ${
                      settleDirection === 'i_paid_them'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    I paid {selectedFriend.name.split(' ')[0]}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Amount ({user.currency})</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 4250"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Linked Bank / Cash Account</label>
                <select
                  value={settleAccountId}
                  onChange={(e) => setSettleAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.currency}{a.balance.toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
                >
                  Record Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
