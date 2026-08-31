import React, { useRef, useMemo, useEffect, useState } from 'react';
import { 
  Plus, 
  MessageSquare, 
  History, 
  UserPlus, 
  UserMinus, 
  DollarSign, 
  Check, 
  Edit2, 
  Trash2, 
  ArrowDown, 
  Users2, 
  ChevronLeft, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  CreditCard,
  Layers,
  Compass,
  Home,
  Briefcase,
  Smile,
  Receipt,
  Clock
} from 'lucide-react';
import { Group, GroupMember, Transaction, UserProfile, FlowItem } from '../../types';

interface FlowItemWithDetails {
  id: string;
  type: 'expense' | 'settlement' | 'member_joined' | 'member_left' | 'group_created' | 'tx_edited' | 'tx_deleted' | 'system';
  timestamp: string;
  actorName: string;
  actorAvatarColor?: string;
  message: string;
  tx?: Transaction;
  details?: {
    txId?: string;
    txTitle?: string;
    amount?: number;
    currency?: string;
    fromMemberName?: string;
    toMemberName?: string;
  };
}

interface GroupChatPaneProps {
  user: UserProfile;
  activeGroup: Group | null;
  flowItems: FlowItemWithDetails[];
  groupedFlow: { dateLabel: string; items: FlowItemWithDetails[] }[];
  totalGroupSpend: number;
  isRightPaneOpen: boolean;
  onToggleRightPane: () => void;
  onOpenAddExpenseModal: () => void;
  onOpenSettleModal: () => void;
  onOpenEditExpenseModal: (tx: Transaction) => void;
  onDeleteGroupExpense: (groupId: string, txId: string) => void;
  onBackToGroupsList?: () => void;
}

export const GroupChatPane: React.FC<GroupChatPaneProps> = ({
  user,
  activeGroup,
  flowItems,
  groupedFlow,
  totalGroupSpend,
  isRightPaneOpen,
  onToggleRightPane,
  onOpenAddExpenseModal,
  onOpenSettleModal,
  onOpenEditExpenseModal,
  onDeleteGroupExpense,
  onBackToGroupsList,
}) => {
  const activityContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    } else if (activityContainerRef.current) {
      activityContainerRef.current.scrollTo({
        top: activityContainerRef.current.scrollHeight,
        behavior,
      });
    }
  };

  const handleScroll = () => {
    if (!activityContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = activityContainerRef.current;
    // Show scroll-to-bottom button only when user has scrolled up away from the bottom
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setIsScrolledUp(distanceFromBottom > 120);
  };

  // Scroll to bottom on initial load and group switch
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom('auto');
      setIsScrolledUp(false);
    }, 60);
    return () => clearTimeout(timer);
  }, [activeGroup?.id]);

  // Scroll to bottom when new messages/expenses arrive
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom('smooth');
    }, 40);
    return () => clearTimeout(timer);
  }, [flowItems.length]);

  // Group members name preview string
  const memberNamesPreview = useMemo(() => {
    if (!activeGroup) return '';
    const names = activeGroup.members.map(m => {
      const mName = m?.name || 'Member';
      if (mName.includes('(You)') || (m.email && user.email && m.email.toLowerCase() === user.email.toLowerCase()) || m.id === 'mem-1') {
        return 'You';
      }
      return mName.split(' ')[0];
    });
    return names.join(', ');
  }, [activeGroup, user.email]);

  if (!activeGroup) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 text-center">
        <div className="w-16 h-16 bg-blue-100/80 text-blue-600 rounded-3xl flex items-center justify-center mb-4 shadow-sm">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Select a group to view conversation & splits</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Choose a group from the left pane or create a new group to track expenses with roommates, trips, and friends.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/60 relative overflow-hidden">
      {/* Group Header */}
      <div className="px-4 py-3.5 bg-white border-b border-slate-200 shadow-2xs flex items-center justify-between gap-3 flex-shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Back to Group List Button */}
          {onBackToGroupsList && (
            <button
              onClick={onBackToGroupsList}
              className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Back to Groups"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Group Avatar */}
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-sm shadow-2xs flex-shrink-0 cursor-pointer"
            style={{ backgroundColor: activeGroup.avatarColor || '#0EA5E9' }}
            onClick={onToggleRightPane}
          >
            {activeGroup.name.substring(0, 2).toUpperCase()}
          </div>

          {/* Group Title & Members Subtitle */}
          <div className="min-w-0 cursor-pointer" onClick={onToggleRightPane}>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900 truncate">
                {activeGroup.name}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 hidden sm:inline-block">
                {activeGroup.category}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate font-medium">
              {activeGroup.members.length} members: <span className="text-slate-700">{memberNamesPreview}</span>
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Total Spend Badge */}
          <div className="flex flex-col items-end px-3 py-1 bg-slate-100 border border-slate-200 rounded-xl text-right">
            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Total Spend</span>
            <span className="text-xs font-black text-emerald-700 privacy-value">
              {activeGroup.currency}{totalGroupSpend.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Activity Timeline Scroll Container Wrapper */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          ref={activityContainerRef}
          onScroll={handleScroll}
          id="activity-flow-scroll-container"
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent bg-slate-50/50"
          tabIndex={0}
        >
        <div className="w-full max-w-4xl mx-auto space-y-6">
          {/* Empty Conversation / Event Stream */}
          {flowItems.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-10 text-center shadow-xs">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Receipt className="w-7 h-7" />
              </div>
              <h4 className="text-base font-extrabold text-slate-900">No expenses or activity yet</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Start sharing costs for villa bookings, food, cabs, or utilities. Bills will be split mathematically with instant debt settlement.
              </p>
              <div className="flex items-center justify-center gap-3 mt-5">
                <button
                  onClick={onOpenAddExpenseModal}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Expense</span>
                </button>
                <button
                  onClick={onToggleRightPane}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <Users2 className="w-4 h-4" />
                  <span>View Members</span>
                </button>
              </div>
            </div>
          ) : (
            /* WhatsApp Style Grouped Chat Flow */
            <div className="space-y-6">
              {groupedFlow.map((group, gIdx) => (
                <div key={`flow-date-group-${group.dateLabel}-${gIdx}`} className="space-y-3">
                  {/* Date Divider Pill (Centered WhatsApp Pill) */}
                  <div className="flex items-center justify-center my-4 sticky top-1 z-5">
                    <span className="bg-white/95 backdrop-blur-xs text-slate-600 text-[11px] font-bold px-3.5 py-1 rounded-full border border-slate-200 shadow-2xs select-none">
                      {group.dateLabel}
                    </span>
                  </div>

                  {/* Message Items */}
                  {group.items.map((item, itemIdx) => {
                    const isSystemAction =
                      item.type === 'member_joined' ||
                      item.type === 'member_left' ||
                      item.type === 'group_created' ||
                      item.type === 'tx_deleted' ||
                      item.type === 'system';

                    // 1. Render Centered System Notification (WhatsApp Pill)
                    if (isSystemAction) {
                      return (
                        <div key={`flow-sys-${item.id || itemIdx}-${gIdx}-${itemIdx}`} className="flex justify-center my-2.5">
                          <div className="bg-white/90 backdrop-blur-xs text-slate-700 text-xs font-medium px-4 py-1.5 rounded-full border border-slate-200/90 shadow-2xs flex items-center gap-2 max-w-md text-center">
                            {item.type === 'member_joined' && <UserPlus className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
                            {item.type === 'member_left' && <UserMinus className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />}
                            {item.type === 'group_created' && <Users2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                            {item.type === 'tx_deleted' && <Trash2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                            <span>{item.message}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    // 2. Render Settlement Message (Emerald styled chat card)
                    if (item.type === 'settlement') {
                      return (
                        <div key={`flow-settle-${item.id || itemIdx}-${gIdx}-${itemIdx}`} className="flex items-start space-x-3 my-3">
                          <div
                            className="w-9 h-9 rounded-2xl flex items-center justify-center text-white font-bold text-xs shadow-2xs flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: item.actorAvatarColor || '#10B981' }}
                          >
                            {item.actorName.substring(0, 2).toUpperCase()}
                          </div>

                          <div className="flex-1 bg-gradient-to-r from-emerald-50 to-teal-50/50 rounded-2xl p-4 border border-emerald-200/90 shadow-2xs max-w-xl">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs text-emerald-900">{item.actorName}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-200/60 text-emerald-800 flex items-center gap-1">
                                  <Check className="w-3 h-3 stroke-[2.5]" />
                                  <span>Settlement</span>
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <p className="text-xs font-semibold text-emerald-950">
                              {item.message}
                            </p>

                            {item.tx && (
                              <div className="mt-2 text-[11px] text-emerald-800 flex items-center gap-2">
                                <span className="font-bold">Amount:</span>
                                <span className="privacy-value font-extrabold text-emerald-900">
                                  {user.currency}{item.tx.amount.toLocaleString('en-IN')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // 3. Render Expense Bubble (Rich Chat Card with itemized split details & actions)
                    const tx = item.tx;
                    const amount = tx ? tx.amount : (item.details?.amount || 0);
                    const splitCount = tx?.splitDetails ? tx.splitDetails.filter(s => s.isSelected).length : activeGroup.members.length;
                    
                    // Check user's individual share in this expense
                    const userEmailNorm = (user?.email || '').trim().toLowerCase();
                    const userSplit = tx?.splitDetails?.find(s => 
                      s.memberId === 'mem-1' || 
                      (Boolean(s.memberEmail && userEmailNorm) && (s.memberEmail || '').trim().toLowerCase() === userEmailNorm) ||
                      (Boolean(s.memberName) && (s.memberName || '').toLowerCase().includes('you'))
                    );
                    const userShare = userSplit ? userSplit.shareAmount : (splitCount > 0 ? (amount / splitCount) : 0);
                    const isUserPayer = tx ? (
                      tx.paidByMemberId === 'mem-1' || 
                      (Boolean(tx.createdBy && userEmailNorm) && (tx.createdBy || '').trim().toLowerCase() === userEmailNorm)
                    ) : false;

                    return (
                      <div key={`flow-exp-${item.id || itemIdx}-${gIdx}-${itemIdx}`} className="flex items-start space-x-3 my-3 group">
                        {/* Actor Avatar */}
                        <div
                          className="w-9 h-9 rounded-2xl flex items-center justify-center text-white font-bold text-xs shadow-2xs flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: item.actorAvatarColor || '#3B82F6' }}
                        >
                          {item.actorName.substring(0, 2).toUpperCase()}
                        </div>

                        {/* Expense Card Bubble */}
                        <div className="flex-1 bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs max-w-xl transition hover:border-blue-300">
                          {/* Bubble Top Line: Actor + Time + Edit/Delete Actions */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-xs text-slate-900">{item.actorName}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                                <Receipt className="w-3 h-3" />
                                <span>Expense</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 font-medium mr-1">
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>

                              {/* Hover Action Buttons */}
                              {tx && (
                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => onOpenEditExpenseModal(tx)}
                                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                    title="Edit expense and split details"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to delete "${tx.title}"?`)) {
                                        onDeleteGroupExpense(activeGroup.id, tx.id);
                                      }
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                    title="Delete expense"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Expense Title & Big Amount Display */}
                          <div className="flex items-baseline justify-between gap-2 pb-2.5 border-b border-slate-100">
                            <div>
                              <h4 className="text-sm font-black text-slate-900">
                                {tx?.title || item.details?.txTitle || 'Expense'}
                              </h4>
                              {tx?.notes && (
                                <p className="text-[11px] text-slate-500 mt-0.5 italic">
                                  "{tx.notes}"
                                </p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="text-base font-black text-slate-900 privacy-value">
                                {user.currency}{amount.toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>

                          {/* Split Summary Breakdown */}
                          <div className="pt-2.5 space-y-2 text-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                              <span className="text-slate-600 font-medium">
                                Paid by <strong className="text-slate-900 font-bold">{item.actorName}</strong> • Split among <strong className="text-slate-900 font-bold">{splitCount} member{splitCount === 1 ? '' : 's'}</strong>
                              </span>

                              {/* Your Individual Share Pill */}
                              {userSplit?.isSelected !== false && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 text-[10px]">
                                  <span>Your share:</span>
                                  <span className="privacy-value font-black text-slate-900">{user.currency}{Math.round(userShare).toLocaleString('en-IN')}</span>
                                </span>
                              )}
                            </div>

                            {/* Itemized Member Shares Badges */}
                            {tx?.splitDetails && tx.splitDetails.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {tx.splitDetails.map((s, sIdx) => {
                                  const sName = s.memberName || 'Member';
                                  const splitKey = s.memberId ? `split-${s.memberId}-${sIdx}` : `split-idx-${sIdx}`;
                                  if (!s.isSelected) {
                                    return (
                                      <span key={splitKey} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 line-through">
                                        {sName.split(' ')[0]} (excluded)
                                      </span>
                                    );
                                  }
                                  return (
                                    <span key={splitKey} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200/70 flex items-center gap-1">
                                      <span className="font-semibold">{sName.split(' ')[0]}:</span>
                                      <span className="privacy-value font-bold text-slate-900">{user.currency}{Math.round(s.shareAmount).toLocaleString('en-IN')}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              {/* Messenger Bottom Anchor */}
              <div ref={messagesEndRef} className="h-1" />
            </div>
          )}
        </div>
      </div>

        {/* Floating Scroll to Bottom Button (only visible when scrolled up) */}
        {isScrolledUp && (
          <button
            type="button"
            onClick={() => scrollToBottom('smooth')}
            className="absolute right-6 bottom-4 z-20 p-2.5 bg-white text-slate-700 hover:text-blue-600 rounded-full shadow-lg border border-slate-200/90 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center group"
            title="Scroll to bottom"
            aria-label="Scroll to bottom"
          >
            <ArrowDown className="w-4 h-4 text-slate-600 group-hover:text-blue-600 transition-colors" />
          </button>
        )}
      </div>

      {/* WhatsApp Style Bottom Action & Input Bar */}
      <div className="p-3 bg-white border-t border-slate-200/90 shadow-xs flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSettleModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Record Settlement</span>
          </button>
        </div>

        {/* Primary Add Expense CTA */}
        <button
          onClick={onOpenAddExpenseModal}
          className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-extrabold shadow-sm transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ Add New Group Expense</span>
        </button>
      </div>
    </div>
  );
};
