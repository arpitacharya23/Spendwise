import React, { useState, useEffect, useRef } from 'react';
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
  AlertCircle,
  Trash2,
  Loader2,
  User,
  UserX,
  Edit2,
  ShieldCheck
} from 'lucide-react';
import { Account, Friend, Transaction, UserProfile } from '../types';
import { findUserByEmailOrPhone } from '../lib/supabaseService';

interface FriendsViewProps {
  user: UserProfile;
  friends: Friend[];
  transactions: Transaction[];
  accounts: Account[];
  onAddFriend: (friend: Partial<Friend>) => void;
  onSettleFriendDebt: (friendId: string, amount: number, accountId: string, direction: 'they_paid_me' | 'i_paid_them') => void;
  onDeleteFriend?: (friendId: string) => void;
}

// Helper to normalize phone digits
function normalizePhone(p?: string | null): string {
  if (!p) return '';
  return p.replace(/\D/g, '');
}

function isPhoneMatch(p1?: string | null, p2?: string | null): boolean {
  const n1 = normalizePhone(p1);
  const n2 = normalizePhone(p2);
  if (!n1 || !n2) return false;
  // If exact all digits match
  if (n1 === n2) return true;
  // If standard 10-digit phone matches (e.g. +91 9876543210 vs 9876543210)
  if (n1.length >= 10 && n2.length >= 10 && n1.slice(-10) === n2.slice(-10)) {
    return true;
  }
  return false;
}

function isPhoneQuery(q: string): boolean {
  const digits = (q.match(/\d/g) || []).length;
  return digits >= 10 && !q.includes('@');
}

// Helper to format clean display name from email
function inferNameFromEmail(email: string): string {
  const username = email.split('@')[0] || '';
  if (!username) return 'Friend';
  
  // Remove numbers and special characters from start/end
  const cleaned = username.replace(/[0-9_.-]+$/g, '').replace(/^[0-9_.-]+/g, '');
  const parts = (cleaned || username).split(/[._\-+]+/).filter(Boolean);
  
  if (parts.length === 0) return 'Friend';
  
  return parts
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
}

interface SearchUserResult {
  email: string;
  name: string;
  avatarColor: string;
  phone?: string;
  isRegistered?: boolean;
  isAlreadyFriend?: boolean;
  isSelf?: boolean;
  existingFriend?: Friend;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  user,
  friends,
  transactions,
  accounts,
  onAddFriend,
  onSettleFriendDebt,
  onDeleteFriend,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(friends[0] || null);

  // Modals
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);

  // Search by email or phone state in Modal
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchUserResult | null>(null);
  const [searchNotFound, setSearchNotFound] = useState<string | null>(null);
  const [isEditingResolvedName, setIsEditingResolvedName] = useState(false);
  const [customResolvedName, setCustomResolvedName] = useState('');
  const [customPhone, setCustomPhone] = useState('');
  const [customColor, setCustomColor] = useState('#10B981');
  const [addSuccessMessage, setAddSuccessMessage] = useState<string | null>(null);

  // Settle Form
  const [settleAmount, setSettleAmount] = useState('');
  const [settleAccountId, setSettleAccountId] = useState('');
  const [settleDirection, setSettleDirection] = useState<'they_paid_me' | 'i_paid_them'>('they_paid_me');

  // Overall totals
  const totalOwedToMe = friends.reduce((sum, f) => f.netBalance > 0 ? sum + f.netBalance : sum, 0);
  const totalIOwe = friends.reduce((sum, f) => f.netBalance < 0 ? sum + Math.abs(f.netBalance) : sum, 0);

  const trimmedSearch = searchTerm.trim();
  const searchDigits = normalizePhone(trimmedSearch);
  const isSearchAnEmail = trimmedSearch.includes('@') && trimmedSearch.includes('.');
  const isSearchAPhone = searchDigits.length >= 10;
  const isSearchIdentifier = isSearchAnEmail || isSearchAPhone;
  
  const filteredFriends = friends.filter(f => {
    if (isSearchAnEmail) {
      return f.email.toLowerCase() === trimmedSearch.toLowerCase();
    }
    if (isSearchAPhone) {
      return isPhoneMatch(f.phone, trimmedSearch);
    }
    // Search by friend name
    return f.name.toLowerCase().includes(trimmedSearch.toLowerCase());
  });

  // Perform search lookup by email or mobile number - ONLY returns registered users
  const executeUserLookup = async (queryToSearch: string) => {
    const norm = queryToSearch.trim();
    if (!norm) {
      setSearchResult(null);
      setSearchNotFound(null);
      return;
    }

    const isEmail = norm.includes('@') && norm.includes('.');
    const digits = normalizePhone(norm);
    const isPhone = digits.length >= 10;
    if (!isEmail && !isPhone) {
      setSearchResult(null);
      setSearchNotFound(null);
      return;
    }

    setIsSearchingUser(true);
    setSearchNotFound(null);
    setSearchResult(null);

    // 1. Check if it's the user's own account (email or phone)
    const isSelfEmail = isEmail && user.email && norm.toLowerCase() === user.email.trim().toLowerCase();
    const isSelfPhone = isPhone && isPhoneMatch(user.phone, norm);
    if (isSelfEmail || isSelfPhone) {
      setSearchResult({
        email: user.email,
        name: user.name,
        avatarColor: user.avatarColor || '#3B82F6',
        phone: user.phone,
        isSelf: true,
      });
      setIsSearchingUser(false);
      return;
    }

    // 2. Check if already a friend in current local list
    const existing = friends.find(f => {
      if (isEmail && f.email.toLowerCase() === norm.toLowerCase()) return true;
      if (isPhone && isPhoneMatch(f.phone, norm)) return true;
      return false;
    });

    if (existing) {
      setSearchResult({
        email: existing.email,
        name: existing.name,
        avatarColor: existing.avatarColor,
        phone: existing.phone,
        isAlreadyFriend: true,
        existingFriend: existing,
      });
      setIsSearchingUser(false);
      return;
    }

    // 3. Query Supabase profiles table for real registered user
    try {
      const dbProfile = await findUserByEmailOrPhone(norm);
      if (dbProfile && dbProfile.name) {
        setSearchResult({
          email: dbProfile.email,
          name: dbProfile.name,
          avatarColor: dbProfile.avatarColor || '#3B82F6',
          phone: dbProfile.phone,
          isRegistered: true,
        });
        setCustomResolvedName(dbProfile.name);
        setCustomColor(dbProfile.avatarColor || '#3B82F6');
        setCustomPhone(dbProfile.phone || (isPhoneQuery(norm) ? norm : ''));
        setIsSearchingUser(false);
        return;
      }
    } catch (err) {
      console.warn('Profile search error:', err);
    }

    // 4. No registered user found
    setSearchResult(null);
    setSearchNotFound(norm);
    setIsSearchingUser(false);
  };

  // Debounce search when typing in modal
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchQuery.trim();
      const isEmail = trimmed.includes('@') && trimmed.includes('.');
      const isPhone = normalizePhone(trimmed).length >= 10;

      if (isEmail || isPhone) {
        executeUserLookup(trimmed);
      } else {
        setSearchResult(null);
        setSearchNotFound(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleOpenAddModal = (initialQuery: string = '') => {
    setSearchQuery(initialQuery);
    setSearchResult(null);
    setSearchNotFound(null);
    setIsEditingResolvedName(false);
    setCustomPhone('');
    setCustomColor('#10B981');
    setAddSuccessMessage(null);
    setIsAddFriendModalOpen(true);
    const initialTrimmed = initialQuery.trim();
    const isEmail = initialTrimmed.includes('@') && initialTrimmed.includes('.');
    const isPhone = normalizePhone(initialTrimmed).length >= 10;
    if (isEmail || isPhone) {
      executeUserLookup(initialTrimmed);
    }
  };

  const handleConfirmAddFriend = () => {
    if (!searchResult) return;
    const targetEmail = searchResult.email;
    const finalName = customResolvedName.trim() || searchResult.name;

    // Check if friend with email or phone already exists
    const existing = friends.find(f => 
      (targetEmail && f.email.toLowerCase() === targetEmail.toLowerCase()) ||
      (searchResult.phone && isPhoneMatch(f.phone, searchResult.phone))
    );

    if (existing) {
      setSelectedFriend(existing);
      setIsAddFriendModalOpen(false);
      setSearchTerm('');
      return;
    }

    const newFriendId = `fr-${Date.now().toString().slice(-6)}`;
    const newFriend: Friend = {
      id: newFriendId,
      name: finalName,
      email: targetEmail,
      phone: customPhone.trim() || searchResult.phone || undefined,
      avatarColor: customColor || searchResult.avatarColor || '#10B981',
      netBalance: 0,
      lastActivity: new Date().toISOString().split('T')[0],
      userEmail: user.email,
      ownerEmail: user.email,
    };

    onAddFriend(newFriend);
    setSelectedFriend(newFriend);
    setIsAddFriendModalOpen(false);
    setSearchTerm('');
    setSearchQuery('');
    setSearchResult(null);
    setAddSuccessMessage(`Added ${finalName} to your friends list!`);
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
      {/* Top Action Toolbar */}
      <div className="flex items-center justify-end gap-2.5 flex-wrap">
        <button
          onClick={() => handleOpenAddModal('')}
          id="btn-find-friend"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-2xs transition active:scale-95 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Find Friend (Mobile / Email)</span>
        </button>
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
            Find a friend by typing their mobile number or email address to add them to your list, track IOUs, and split group expenses.
          </p>
          <button
            onClick={() => handleOpenAddModal('')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Find Friend by Mobile or Email</span>
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
                placeholder="Find friend by name, mobile, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-slate-50/50"
              />
            </div>

            {/* If user searched an email or phone and it's NOT in the list yet, show a search user directory card */}
            {isSearchIdentifier && !friends.some(f => 
              (isSearchAnEmail && f.email.toLowerCase() === trimmedSearch.toLowerCase()) ||
              (isSearchAPhone && isPhoneMatch(f.phone, trimmedSearch))
            ) && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 text-xs animate-fadeIn">
                <div className="flex items-center gap-2 text-slate-700 font-semibold">
                  <Search className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span className="truncate">Not in friends list: <strong>{trimmedSearch}</strong></span>
                </div>
                <button
                  onClick={() => handleOpenAddModal(trimmedSearch)}
                  className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search User Directory</span>
                </button>
              </div>
            )}

            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {filteredFriends.length === 0 && !isSearchIdentifier ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  <p>No friend matched "{searchTerm}".</p>
                  <button
                    onClick={() => handleOpenAddModal(searchTerm)}
                    className="mt-2 text-blue-600 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Find Friend in Directory</span>
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
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                            {f.phone ? (
                              <span className="truncate">{f.phone}</span>
                            ) : (
                              <span className="truncate">{f.email}</span>
                            )}
                          </div>
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

                  {/* Settle & Delete Action Buttons */}
                  <div className="flex items-center gap-2">
                    {onDeleteFriend && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to remove "${selectedFriend.name}" from your friends list?`)) {
                            onDeleteFriend(selectedFriend.id);
                            setSelectedFriend(friends.find(f => f.id !== selectedFriend.id) || null);
                          }
                        }}
                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        title="Remove Friend"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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
                      Track shared expenses, group settlements, and debt balances directly with <strong>{selectedFriend.name}</strong> ({selectedFriend.email}{selectedFriend.phone ? ` • ${selectedFriend.phone}` : ''}).
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

      {/* MODAL 1: Find Friend by Mobile Number or Email / Add Friend */}
      {isAddFriendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Find Friend</h2>
                <p className="text-xs text-slate-500 mt-0.5">Search by mobile number or email to verify their registered account and add them.</p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Search className="w-5 h-5" />
              </div>
            </div>

            {/* Mobile / Email Search Box */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase text-slate-700">Friend's Mobile Number or Email</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  {searchQuery.includes('@') ? (
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  ) : isPhoneQuery(searchQuery) ? (
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  ) : (
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  )}
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. +91 98765 43210 or rohan@example.com"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (searchQuery.trim()) {
                          executeUserLookup(searchQuery);
                        }
                      }
                    }}
                    className="w-full pl-9.5 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium bg-slate-50/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => executeUserLookup(searchQuery)}
                  disabled={isSearchingUser || (!(searchQuery.includes('@') && searchQuery.includes('.')) && normalizePhone(searchQuery).length < 10)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                >
                  {isSearchingUser ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>Search</span>
                </button>
              </div>
            </div>

            {/* Loading Indicator */}
            {isSearchingUser && (
              <div className="py-6 flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <p className="font-semibold">Looking up registered user...</p>
              </div>
            )}

            {/* NOT FOUND State */}
            {!isSearchingUser && searchNotFound && (
              <div className="p-6 bg-slate-50 border border-slate-200/80 rounded-2xl text-center space-y-2.5 animate-fadeIn">
                <div className="w-12 h-12 rounded-2xl bg-amber-100/70 text-amber-700 mx-auto flex items-center justify-center shadow-2xs">
                  <UserX className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">No User Found</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                    No registered user was found matching <span className="font-bold text-slate-800 break-all">{searchNotFound}</span>.
                  </p>
                </div>
                <div className="pt-2 text-[11px] text-slate-500 bg-white p-2.5 rounded-xl border border-slate-200 max-w-xs mx-auto text-left leading-relaxed">
                  💡 <strong>Note:</strong> Only registered users can be added. Please verify the mobile number or email spelling, or ask your friend to create an account.
                </div>
              </div>
            )}

            {/* Search Result Card (Shows Verified Registered User Details) */}
            {!isSearchingUser && searchResult && (
              <div className="space-y-4 animate-fadeIn">
                {/* Result Hero Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200">
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-13 h-13 rounded-2xl flex items-center justify-center text-white font-extrabold text-base shadow-sm flex-shrink-0"
                      style={{ backgroundColor: customColor || searchResult.avatarColor }}
                    >
                      {(customResolvedName || searchResult.name).substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-extrabold text-slate-900 truncate">
                          {customResolvedName || searchResult.name}
                        </h4>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 flex-shrink-0">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          Registered User
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 mt-1 text-xs text-slate-500">
                        {searchResult.email && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{searchResult.email}</span>
                          </div>
                        )}
                        {searchResult.phone && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{searchResult.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Notice / Warnings */}
                {searchResult.isSelf ? (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>This is your own account ({searchResult.email || searchResult.phone}). You cannot add yourself as a friend.</span>
                  </div>
                ) : searchResult.isAlreadyFriend ? (
                  <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span>{searchResult.name} is already in your friends list!</span>
                    </div>
                    {searchResult.existingFriend && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFriend(searchResult.existingFriend!);
                          setIsAddFriendModalOpen(false);
                        }}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition cursor-pointer"
                      >
                        View Profile
                      </button>
                    )}
                  </div>
                ) : (
                  /* Ready to Add Details */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase text-slate-500">Contact Details</span>
                      <button
                        type="button"
                        onClick={() => setIsEditingResolvedName(!isEditingResolvedName)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>{isEditingResolvedName ? 'Done Editing' : 'Customize Name & Color'}</span>
                      </button>
                    </div>

                    {isEditingResolvedName && (
                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-fadeIn text-xs">
                        <div>
                          <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Display Name</label>
                          <input
                            type="text"
                            value={customResolvedName}
                            onChange={(e) => setCustomResolvedName(e.target.value)}
                            placeholder="Enter full name"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Phone (optional)</label>
                          <input
                            type="tel"
                            value={customPhone}
                            onChange={(e) => setCustomPhone(e.target.value)}
                            placeholder="+91 98765 43210"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Theme Color</label>
                          <div className="flex items-center gap-2">
                            {['#10B981', '#EC4899', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4'].map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setCustomColor(c)}
                                className={`w-6 h-6 rounded-lg transition-transform cursor-pointer ${customColor === c ? 'scale-120 ring-2 ring-slate-900 shadow-sm' : 'hover:scale-110 opacity-80'}`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsAddFriendModalOpen(false)}
                className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                Cancel
              </button>
              {searchResult && !searchResult.isSelf && !searchResult.isAlreadyFriend && (
                <button
                  type="button"
                  onClick={handleConfirmAddFriend}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add {customResolvedName || searchResult.name} as Friend</span>
                </button>
              )}
            </div>
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
                    {(selectedFriend.name || 'Friend').split(' ')[0]} paid me
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
                    I paid {(selectedFriend.name || 'Friend').split(' ')[0]}
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
