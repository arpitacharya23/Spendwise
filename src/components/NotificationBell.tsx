import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  Calendar, 
  CreditCard, 
  Users, 
  CheckCheck, 
  X, 
  TrendingDown, 
  ArrowRight,
  ShieldAlert,
  Wallet
} from 'lucide-react';
import { Account, Group, GroupActivityLog, LoanEMI, Transaction, UserProfile } from '../types';

export interface AppNotification {
  id: string;
  type: 'emi_due' | 'emi_overdue' | 'low_balance' | 'credit_card_due' | 'group_expense' | 'group_activity';
  title: string;
  description: string;
  timestamp: string;
  severity: 'urgent' | 'warning' | 'info';
  actionTab?: string;
  actionPayload?: any;
  actionLabel?: string;
  isRead?: boolean;
}

interface NotificationBellProps {
  user: UserProfile;
  accounts: Account[];
  loans: LoanEMI[];
  groups: Group[];
  transactions: Transaction[];
  activityLogs: GroupActivityLog[];
  onNavigateTab: (tab: string, payload?: any) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  user,
  accounts,
  loans,
  groups,
  transactions,
  activityLogs,
  onNavigateTab,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'emi' | 'accounts' | 'groups'>('all');
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`spendwise_read_notifs_${user.email}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`spendwise_dismissed_notifs_${user.email}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`spendwise_read_notifs_${user.email}`, JSON.stringify(readNotificationIds));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [readNotificationIds, user.email]);

  useEffect(() => {
    try {
      localStorage.setItem(`spendwise_dismissed_notifs_${user.email}`, JSON.stringify(dismissedNotificationIds));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, [dismissedNotificationIds, user.email]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute live alerts based on user's current data
  const notifications: AppNotification[] = useMemo(() => {
    const list: AppNotification[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Check EMI / Loan Payments
    loans
      .filter(l => l.status === 'active')
      .forEach(loan => {
        if (!loan.nextDueDate) return;
        const dueDate = new Date(loan.nextDueDate);
        dueDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          list.push({
            id: `notif-emi-overdue-${loan.id}-${loan.nextDueDate}`,
            type: 'emi_overdue',
            title: `Overdue EMI: ${loan.name}`,
            description: `Payment of ${user.currency}${loan.monthlyEMI.toLocaleString('en-IN')} was due ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago (${loan.nextDueDate}).`,
            timestamp: loan.nextDueDate,
            severity: 'urgent',
            actionTab: 'loans',
            actionPayload: loan,
            actionLabel: 'Pay Installment',
          });
        } else if (diffDays <= 7) {
          list.push({
            id: `notif-emi-due-${loan.id}-${loan.nextDueDate}`,
            type: 'emi_due',
            title: `Upcoming EMI: ${loan.name}`,
            description: diffDays === 0 
              ? `Monthly installment of ${user.currency}${loan.monthlyEMI.toLocaleString('en-IN')} is due TODAY!`
              : `Monthly installment of ${user.currency}${loan.monthlyEMI.toLocaleString('en-IN')} is due in ${diffDays} day${diffDays === 1 ? '' : 's'} (${loan.nextDueDate}).`,
            timestamp: loan.nextDueDate,
            severity: diffDays <= 2 ? 'urgent' : 'warning',
            actionTab: 'loans',
            actionPayload: loan,
            actionLabel: 'View & Pay',
          });
        }
      });

    // 2. Check Low Bank / Cash Balances (< 2,500)
    accounts
      .filter(a => (a.type === 'bank' || a.type === 'cash') && !a.isArchived)
      .forEach(acc => {
        if (acc.balance < 2500) {
          const isNegative = acc.balance < 0;
          list.push({
            id: `notif-low-bal-${acc.id}`,
            type: 'low_balance',
            title: isNegative ? `Overdrawn Balance: ${acc.name}` : `Low Bank Balance: ${acc.name}`,
            description: isNegative 
              ? `Your account balance is negative at ${user.currency}${acc.balance.toLocaleString('en-IN')}. Immediate deposit recommended.`
              : `Available balance is low at ${user.currency}${acc.balance.toLocaleString('en-IN')} (threshold: ${user.currency}2,500).`,
            timestamp: acc.updatedAt || new Date().toISOString(),
            severity: isNegative ? 'urgent' : 'warning',
            actionTab: 'accounts',
            actionPayload: acc,
            actionLabel: 'Add Funds / Transfer',
          });
        }
      });

    // 3. Check Credit Card Payments Due & High Utilization
    accounts
      .filter(a => a.type === 'credit_card' && !a.isArchived)
      .forEach(card => {
        if (card.dueAmount && card.dueAmount > 0 && card.dueDate) {
          const dueDate = new Date(card.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays <= 7) {
            list.push({
              id: `notif-card-due-${card.id}-${card.dueDate}`,
              type: 'credit_card_due',
              title: `Card Bill Due: ${card.name}`,
              description: diffDays < 0 
                ? `Payment of ${user.currency}${card.dueAmount.toLocaleString('en-IN')} is overdue!`
                : `Payment of ${user.currency}${card.dueAmount.toLocaleString('en-IN')} is due in ${diffDays} day${diffDays === 1 ? '' : 's'} (${card.dueDate}).`,
              timestamp: card.dueDate,
              severity: diffDays <= 1 ? 'urgent' : 'warning',
              actionTab: 'accounts',
              actionPayload: card,
              actionLabel: 'Pay Card Bill',
            });
          }
        }

        // Credit limit check
        if (card.creditLimit && card.dueAmount && card.creditLimit > 0) {
          const utilRatio = (card.dueAmount / card.creditLimit) * 100;
          if (utilRatio > 80) {
            list.push({
              id: `notif-card-limit-${card.id}`,
              type: 'credit_card_due',
              title: `High Credit Utilization: ${card.name}`,
              description: `You have used ${utilRatio.toFixed(0)}% of your credit limit (${user.currency}${card.dueAmount.toLocaleString('en-IN')} of ${user.currency}${card.creditLimit.toLocaleString('en-IN')}).`,
              timestamp: card.updatedAt || new Date().toISOString(),
              severity: 'warning',
              actionTab: 'accounts',
              actionPayload: card,
              actionLabel: 'Manage Account',
            });
          }
        }
      });

    // 4. Check New Group Expenses & Activity
    const recentGroupTxs = transactions
      .filter(t => t.groupId)
      .slice(0, 6);

    recentGroupTxs.forEach(tx => {
      const group = groups.find(g => g.id === tx.groupId);
      const userEmailNorm = (user?.email || '').trim().toLowerCase();
      const payerEmail = (group?.members.find(m => m.id === tx.paidByMemberId)?.email || '').trim().toLowerCase();
      const creatorEmail = (tx.createdBy || '').trim().toLowerCase();
      const isPaidByMe = tx.paidByMemberId 
        ? Boolean(payerEmail && userEmailNorm && payerEmail === userEmailNorm)
        : Boolean(creatorEmail && userEmailNorm && creatorEmail === userEmailNorm);

      list.push({
        id: `notif-group-tx-${tx.id}`,
        type: 'group_expense',
        title: `Group Expense: ${group?.name || 'Splitwise Group'}`,
        description: `"${tx.title}" of ${user.currency}${tx.amount.toLocaleString('en-IN')} was added ${isPaidByMe ? 'by you' : ''}.`,
        timestamp: tx.date || tx.createdAt || new Date().toISOString(),
        severity: 'info',
        actionTab: 'groups',
        actionPayload: tx.groupId,
        actionLabel: 'View Split Details',
      });
    });

    // 5. Recent Activity Logs for Groups
    activityLogs.slice(0, 4).forEach(log => {
      if (log.actionType !== 'tx_added') {
        const group = groups.find(g => g.id === log.groupId);
        list.push({
          id: `notif-log-${log.id}`,
          type: 'group_activity',
          title: group?.name || 'Group Update',
          description: log.message,
          timestamp: log.timestamp,
          severity: 'info',
          actionTab: 'groups',
          actionPayload: log.groupId,
          actionLabel: 'Open Group',
        });
      }
    });

    // Filter out dismissed notifications
    const nonDismissed = list.filter(n => !dismissedNotificationIds.includes(n.id));

    // Sort: Urgent first, then warning, then date
    return nonDismissed.sort((a, b) => {
      const rank = { urgent: 0, warning: 1, info: 2 };
      if (rank[a.severity] !== rank[b.severity]) {
        return rank[a.severity] - rank[b.severity];
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [loans, accounts, groups, transactions, activityLogs, user, dismissedNotificationIds]);

  // Unread count
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !readNotificationIds.includes(n.id)).length;
  }, [notifications, readNotificationIds]);

  const hasUrgent = useMemo(() => {
    return notifications.some(n => n.severity === 'urgent' && !readNotificationIds.includes(n.id));
  }, [notifications, readNotificationIds]);

  // Filtered list
  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'emi') {
      return notifications.filter(n => n.type === 'emi_due' || n.type === 'emi_overdue');
    }
    if (activeFilter === 'accounts') {
      return notifications.filter(n => n.type === 'low_balance' || n.type === 'credit_card_due');
    }
    if (activeFilter === 'groups') {
      return notifications.filter(n => n.type === 'group_expense' || n.type === 'group_activity');
    }
    return notifications;
  }, [notifications, activeFilter]);

  const handleMarkAllRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadNotificationIds(Array.from(new Set([...readNotificationIds, ...allIds])));
  };

  const handleMarkAsRead = (id: string) => {
    if (!readNotificationIds.includes(id)) {
      setReadNotificationIds([...readNotificationIds, id]);
    }
  };

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedNotificationIds([...dismissedNotificationIds, id]);
  };

  const handleAction = (notif: AppNotification) => {
    handleMarkAsRead(notif.id);
    setIsOpen(false);
    if (notif.actionTab) {
      onNavigateTab(notif.actionTab, notif.actionPayload);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Trigger Button */}
      <button
        type="button"
        id="btn-header-notification-bell"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && unreadCount > 0) {
            // keep unread for explicit click or mark
          }
        }}
        aria-label="View Notifications"
        title="Alerts & Notifications"
        className={`relative flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-200 cursor-pointer active:scale-95 ${
          isOpen
            ? 'bg-blue-50 border-blue-300 text-blue-600 shadow-sm'
            : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs'
        }`}
      >
        <Bell className={`w-4 h-4 ${hasUrgent ? 'animate-bounce text-rose-600' : ''}`} />
        
        {/* Unread Badge Counter */}
        {unreadCount > 0 && (
          <span 
            id="notification-badge-count"
            className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black text-white flex items-center justify-center shadow-sm ${
              hasUrgent ? 'bg-rose-600 animate-pulse' : 'bg-blue-600'
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Flyout Dropdown */}
      {isOpen && (
        <div 
          id="notification-dropdown-panel"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col max-h-[85vh]"
        >
          {/* Panel Header */}
          <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-100/70 text-blue-700">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">Notifications & Alerts</h3>
                <p className="text-[11px] text-slate-500">
                  {unreadCount > 0 ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark read</span>
              </button>
            )}
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1 px-3 py-2 bg-white border-b border-slate-100 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('emi')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                activeFilter === 'emi'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>EMIs ({notifications.filter(n => n.type === 'emi_due' || n.type === 'emi_overdue').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('accounts')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                activeFilter === 'accounts'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Wallet className="w-3 h-3" />
              <span>Balances ({notifications.filter(n => n.type === 'low_balance' || n.type === 'credit_card_due').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('groups')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                activeFilter === 'groups'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>Splitwise</span>
            </button>
          </div>

          {/* Notifications List Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[380px]">
            {filteredNotifications.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
                  <CheckCheck className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-800">All clear & up to date!</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-[220px] mx-auto">
                  No pending EMI alerts, low bank balance warnings, or urgent group notices.
                </p>
              </div>
            ) : (
              filteredNotifications.map(notif => {
                const isRead = readNotificationIds.includes(notif.id);

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleMarkAsRead(notif.id)}
                    className={`p-3.5 transition group cursor-pointer flex items-start gap-3 relative ${
                      isRead ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/40 hover:bg-blue-50/70'
                    }`}
                  >
                    {/* Unread Dot Indicator */}
                    {!isRead && (
                      <span className="absolute left-1.5 top-5 w-1.5 h-1.5 rounded-full bg-blue-600" />
                    )}

                    {/* Icon based on notification type */}
                    <div className="flex-shrink-0 mt-0.5">
                      {notif.type === 'emi_overdue' && (
                        <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      )}
                      {notif.type === 'emi_due' && (
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                          <Calendar className="w-4 h-4" />
                        </div>
                      )}
                      {notif.type === 'low_balance' && (
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                          <TrendingDown className="w-4 h-4" />
                        </div>
                      )}
                      {notif.type === 'credit_card_due' && (
                        <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                          <CreditCard className="w-4 h-4" />
                        </div>
                      )}
                      {(notif.type === 'group_expense' || notif.type === 'group_activity') && (
                        <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
                          <Users className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-bold text-xs ${isRead ? 'text-slate-800' : 'text-slate-900'}`}>
                          {notif.title}
                        </span>
                        {notif.severity === 'urgent' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                            Urgent
                          </span>
                        )}
                        {notif.severity === 'warning' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                            Action Due
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        {notif.description}
                      </p>

                      {/* Action Button if actionable */}
                      {notif.actionLabel && (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(notif);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs transition active:scale-95 cursor-pointer"
                          >
                            <span>{notif.actionLabel}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Dismiss Button */}
                    <button
                      type="button"
                      onClick={(e) => handleDismiss(notif.id, e)}
                      className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 p-1 rounded-md transition opacity-60 group-hover:opacity-100 cursor-pointer"
                      title="Dismiss notification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with summary note */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>SpendWise Alert Center</span>
            <span className="text-[10px] text-slate-400">Real-time alerts active</span>
          </div>
        </div>
      )}
    </div>
  );
};
