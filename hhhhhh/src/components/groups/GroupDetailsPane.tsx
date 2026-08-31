import React, { useMemo } from 'react';
import { 
  Users2, 
  Plus, 
  X, 
  Check, 
  UserMinus, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  Calendar, 
  Shield, 
  ArrowRight, 
  CreditCard,
  UserPlus,
  Compass,
  Home,
  Briefcase,
  Smile,
  Layers,
  Sparkles,
  PieChart
} from 'lucide-react';
import { Group, GroupMember, Friend, UserProfile } from '../../types';

interface MemberBalance {
  paid: number;
  share: number;
  net: number;
  member: GroupMember;
}

interface SimplifiedDebt {
  from: GroupMember;
  to: GroupMember;
  amount: number;
}

interface GroupDetailsPaneProps {
  user: UserProfile;
  activeGroup: Group;
  memberBalances: Record<string, MemberBalance>;
  simplifiedDebts: SimplifiedDebt[];
  totalGroupSpend: number;
  unaddedFriends: Friend[];
  onClose: () => void;
  onOpenAddMemberModal: (tab?: 'global_friends' | 'manual') => void;
  onQuickAddFriend: (friend: Friend) => void;
  onRemoveMember: (groupId: string, memberId: string, memberName: string) => void;
  onDirectSettle: (fromMemberId: string, toMemberId: string, amount: number) => void;
}

export const GroupDetailsPane: React.FC<GroupDetailsPaneProps> = ({
  user,
  activeGroup,
  memberBalances,
  simplifiedDebts,
  totalGroupSpend,
  unaddedFriends,
  onClose,
  onOpenAddMemberModal,
  onQuickAddFriend,
  onRemoveMember,
  onDirectSettle,
}) => {
  // Find current user's member object and balance in this group
  const userMember = useMemo(() => {
    const userEmailNorm = (user?.email || '').trim().toLowerCase();
    return activeGroup.members.find(m => 
      (Boolean(m?.email && userEmailNorm) && (m.email || '').trim().toLowerCase() === userEmailNorm) || 
      (Boolean(m?.name) && (m.name || '').toLowerCase().includes('you')) ||
      m?.id === 'mem-1'
    ) || activeGroup.members[0];
  }, [activeGroup, user.email]);

  const userBalance = userMember ? (memberBalances[userMember.id]?.net || 0) : 0;
  const isUserOwed = userBalance > 0.01;
  const doesUserOwe = userBalance < -0.01;

  // Creditors (people who get money back) for smart settling suggestions
  const creditors = useMemo(() => {
    return (Object.values(memberBalances) as MemberBalance[])
      .filter(b => b.net > 0.01)
      .map(b => b.member);
  }, [memberBalances]);

  // Total unsettled debt in the group
  const totalUnsettledDebt = useMemo(() => {
    return simplifiedDebts.reduce((sum, d) => sum + d.amount, 0);
  }, [simplifiedDebts]);

  return (
    <div className="w-full flex flex-col h-full bg-white overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
      {/* Pane Header */}
      <div className="p-4 bg-slate-50/90 text-slate-900 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Users2 className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-extrabold tracking-tight">Group Info & Members</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          title="Close details pane"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Group Profile Hero Card */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/90 text-center space-y-3">
          <div
            className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center font-black text-white text-xl shadow-md"
            style={{ backgroundColor: activeGroup.avatarColor || '#0EA5E9' }}
          >
            {activeGroup.name.substring(0, 2).toUpperCase()}
          </div>

          <div>
            <h2 className="text-base font-black text-slate-900">{activeGroup.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{activeGroup.description || 'Shared expenses'}</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {activeGroup.category}
              </span>
              <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Created {activeGroup.createdAt}</span>
              </span>
            </div>
          </div>

          {/* Financial Snapshot 2-column Banner */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/70 text-left">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Group Spend</p>
              <p className="text-sm font-black text-slate-900 privacy-value mt-0.5">
                {activeGroup.currency}{totalGroupSpend.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Your Balance</p>
              <div className="mt-0.5">
                {isUserOwed ? (
                  <span className="text-xs font-black text-emerald-600 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>+{activeGroup.currency}{Math.round(userBalance).toLocaleString('en-IN')}</span>
                  </span>
                ) : doesUserOwe ? (
                  <span className="text-xs font-black text-rose-600 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" />
                    <span>-{activeGroup.currency}{Math.round(Math.abs(userBalance)).toLocaleString('en-IN')}</span>
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-slate-400" />
                    <span>Settled (₹0)</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Members Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <span>Group Members</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-700 font-bold rounded-md">
                {activeGroup.members.length}
              </span>
            </h4>
            <button
              onClick={() => onOpenAddMemberModal('global_friends')}
              className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Member</span>
            </button>
          </div>

          {/* Quick Add Unadded Friends Chips */}
          {unaddedFriends && unaddedFriends.length > 0 && (
            <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-100 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-blue-950 flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Suggested Friends</span>
                </span>
                <button
                  onClick={() => onOpenAddMemberModal('global_friends')}
                  className="text-[10px] font-bold text-blue-700 hover:underline cursor-pointer"
                >
                  View All ({unaddedFriends.length})
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {unaddedFriends.slice(0, 3).map((friend, fIdx) => (
                  <button
                    key={friend.id || `unadded-${fIdx}`}
                    onClick={() => onQuickAddFriend(friend)}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-blue-600 hover:text-white text-slate-700 text-[11px] font-bold rounded-lg border border-blue-200/80 shadow-2xs transition cursor-pointer group"
                    title={`Add ${friend.name || 'Friend'} to this group`}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                      style={{ backgroundColor: friend.avatarColor || '#3B82F6' }}
                    >
                      {(friend.name || 'Friend').substring(0, 1).toUpperCase()}
                    </div>
                    <span>{(friend.name || 'Friend').split(' ')[0]}</span>
                    <Plus className="w-3 h-3 text-blue-500 group-hover:text-white" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Member List Cards */}
          <div className="space-y-2">
            {activeGroup.members.map((mem, mIdx) => {
              const balance = memberBalances[mem.id];
              const net = balance ? balance.net : 0;
              const isOwed = net > 0.01;
              const owes = net < -0.01;

              return (
                <div 
                  key={mem.id || `mem-${mIdx}`} 
                  className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-2xs flex-shrink-0"
                        style={{ backgroundColor: mem.avatarColor || '#10B981' }}
                      >
                        {(mem.name || 'Member').substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900 truncate">{mem.name || 'Member'}</span>
                          {mem.role === 'admin' && (
                            <span className="text-[9px] bg-blue-100 text-blue-800 font-extrabold px-1.5 py-0.2 rounded">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">
                          {mem.email || 'No email provided'}
                        </p>
                      </div>
                    </div>

                    {/* Member Net Status Pill */}
                    <div>
                      {isOwed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                          <span>+{activeGroup.currency}{Math.round(net).toLocaleString('en-IN')}</span>
                        </span>
                      ) : owes ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-full">
                          <span>-{activeGroup.currency}{Math.round(Math.abs(net)).toLocaleString('en-IN')}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          Settled
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Financial Metrics Line & Actions */}
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-100">
                    <div>
                      <span>Paid: <strong className="text-slate-800 font-semibold">{activeGroup.currency}{balance ? Math.round(balance.paid).toLocaleString('en-IN') : 0}</strong></span>
                      <span className="mx-1">•</span>
                      <span>Share: <strong className="text-slate-800 font-semibold">{activeGroup.currency}{balance ? Math.round(balance.share).toLocaleString('en-IN') : 0}</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Direct Settle Button if member owes money */}
                      {owes && (
                        <button
                          onClick={() => {
                            const bestCreditor = creditors[0];
                            const toMemberId = bestCreditor?.id || (mem.id === 'mem-1' ? (activeGroup.members.find(m => m.id !== 'mem-1')?.id || '') : 'mem-1');
                            onDirectSettle(mem.id, toMemberId, Math.round(Math.abs(net)));
                          }}
                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-[10px] shadow-2xs transition cursor-pointer flex items-center gap-0.5"
                          title={`Settle debt for ${mem.name || 'Member'}`}
                        >
                          <Check className="w-2.5 h-2.5" />
                          <span>Settle</span>
                        </button>
                      )}

                      {/* Remove member button */}
                      {mem.id !== 'mem-1' && (
                        <button
                          onClick={() => onRemoveMember(activeGroup.id, mem.id, mem.name || 'Member')}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                          title="Remove from group"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Smart Simplified Debts Section (Who owes Whom) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <span>Simplified Debts</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-bold rounded-md">
                {simplifiedDebts.length} path{simplifiedDebts.length === 1 ? '' : 's'}
              </span>
            </h4>
          </div>

          {simplifiedDebts.length === 0 ? (
            <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 text-center space-y-1.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
              <p className="text-xs font-bold text-emerald-950">All group debts are settled!</p>
              <p className="text-[10px] text-emerald-700">No member currently owes any balance in this group.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {simplifiedDebts.map((debt, dIdx) => (
                <div
                  key={`sim-debt-${debt.from.id}-${debt.to.id}-${dIdx}`}
                  className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-900 truncate">{(debt.from?.name || 'Member').split(' ')[0]}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="font-bold text-slate-900 truncate">{(debt.to?.name || 'Member').split(' ')[0]}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-black text-slate-900 privacy-value text-xs">
                      {activeGroup.currency}{debt.amount.toLocaleString('en-IN')}
                    </span>
                    <button
                      onClick={() => onDirectSettle(debt.from.id, debt.to.id, debt.amount)}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] shadow-2xs transition cursor-pointer"
                    >
                      Settle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
