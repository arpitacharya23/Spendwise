import React, { useState, useMemo } from 'react';
import { 
  Users2, 
  Plus, 
  Search, 
  X, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  Layers
} from 'lucide-react';
import { Group, GroupActivityLog, Transaction, UserProfile } from '../../types';

interface GroupListPaneProps {
  user: UserProfile;
  groups: Group[];
  selectedGroupId: string | null;
  activityLogs: GroupActivityLog[];
  transactions: Transaction[];
  onSelectGroup: (groupId: string) => void;
  onOpenCreateGroupModal: () => void;
}

// Category icon helper
const getCategoryIcon = (category: string) => {
  return <Layers className="w-3.5 h-3.5" />;
};

// Formats timestamp like WhatsApp (e.g., "10:45 AM", "Yesterday", "Aug 26")
const formatGroupTime = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

export const GroupListPane: React.FC<GroupListPaneProps> = ({
  user,
  groups,
  selectedGroupId,
  activityLogs,
  transactions,
  onSelectGroup,
  onOpenCreateGroupModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Compute stats for each group (Total Spend, Latest Activity, User's Net Balance)
  const groupStatsMap = useMemo(() => {
    const map: Record<string, {
      totalSpend: number;
      userNetBalance: number;
      lastActivitySnippet: string;
      lastActivityTime: string;
    }> = {};

    groups.forEach(group => {
      const groupTx = transactions.filter(t => t.groupId === group.id);
      const groupLogs = activityLogs.filter(l => l.groupId === group.id);

      // Total spend
      const totalSpend = groupTx.reduce((sum, t) => sum + t.amount, 0);

      // User Net Balance Calculation in this group
      // User's paid amount vs user's share
      let userPaid = 0;
      let userShare = 0;
      const userMemberId = group.members.find(m => 
        (Boolean(m?.email && user?.email) && (m.email || '').toLowerCase() === (user.email || '').toLowerCase()) || 
        (Boolean(m?.name) && (m.name || '').toLowerCase().includes('you')) ||
        m?.id === 'mem-1'
      )?.id || 'mem-1';

      groupTx.forEach(tx => {
        if (tx.splitDetails && tx.splitDetails.length > 0) {
          tx.splitDetails.forEach(s => {
            if (s.memberId === userMemberId) {
              userPaid += (s.paidAmount || 0);
              userShare += (s.shareAmount || 0);
            }
          });
        } else {
          // Equal split fallback
          const isPayer = (tx.paidByMemberId === userMemberId);
          if (isPayer) userPaid += tx.amount;
          if (group.members.length > 0) {
            userShare += (tx.amount / group.members.length);
          }
        }
      });

      const userNetBalance = userPaid - userShare;

      // Last activity snippet & timestamp
      let lastActivitySnippet = group.description || `${group.members.length} members`;
      let lastActivityTime = group.createdAt;

      // Check latest log or transaction
      const sortedLogs = [...groupLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const sortedTx = [...groupTx].sort((a, b) => new Date(b.updatedAt || b.date).getTime() - new Date(a.updatedAt || a.date).getTime());

      const latestLog = sortedLogs[0];
      const latestTx = sortedTx[0];

      if (latestTx && latestLog) {
        const txTime = new Date(latestTx.updatedAt || latestTx.date).getTime();
        const logTime = new Date(latestLog.timestamp).getTime();
        if (txTime >= logTime) {
          lastActivitySnippet = `${latestTx.title}: ${user.currency}${latestTx.amount.toLocaleString('en-IN')}`;
          lastActivityTime = latestTx.updatedAt || latestTx.date;
        } else {
          lastActivitySnippet = latestLog.message;
          lastActivityTime = latestLog.timestamp;
        }
      } else if (latestTx) {
        lastActivitySnippet = `${latestTx.title}: ${user.currency}${latestTx.amount.toLocaleString('en-IN')}`;
        lastActivityTime = latestTx.updatedAt || latestTx.date;
      } else if (latestLog) {
        lastActivitySnippet = latestLog.message;
        lastActivityTime = latestLog.timestamp;
      }

      map[group.id] = {
        totalSpend,
        userNetBalance,
        lastActivitySnippet,
        lastActivityTime,
      };
    });

    return map;
  }, [groups, transactions, activityLogs, user.email, user.currency]);

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(g => {
      return (
        (g.name ? g.name.toLowerCase().includes(q) : false) ||
        (g.description ? g.description.toLowerCase().includes(q) : false) ||
        (g.members ? g.members.some(m => m?.name && m.name.toLowerCase().includes(q)) : false)
      );
    });
  }, [groups, searchQuery]);

  return (
    <div className="w-full flex flex-col h-full bg-white text-slate-900">
      {/* Search Input Bar */}
      <div className="p-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search groups, members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Groups List (Chat Rows) */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {filteredGroups.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
              <Users2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700">No groups found</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {searchQuery ? 'Try matching another search term' : 'Create a group for trips, roommates, or projects'}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={onOpenCreateGroupModal}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              >
                + Create Group
              </button>
            )}
          </div>
        ) : (
          filteredGroups.map(group => {
            const isSelected = group.id === selectedGroupId;
            const stats = groupStatsMap[group.id] || {
              totalSpend: 0,
              userNetBalance: 0,
              lastActivitySnippet: group.description || `${group.members.length} members`,
              lastActivityTime: group.createdAt,
            };

            const isOwed = stats.userNetBalance > 0.01;
            const owes = stats.userNetBalance < -0.01;
            const formattedTime = formatGroupTime(stats.lastActivityTime);

            return (
              <button
                key={group.id}
                onClick={() => onSelectGroup(group.id)}
                id={`group-item-${group.id}`}
                className={`w-full p-3.5 text-left transition flex items-start gap-3 cursor-pointer group relative ${
                  isSelected
                    ? 'bg-blue-50/80 text-blue-900 border-l-4 border-blue-600 pl-3'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                {/* Group Avatar with Category Icon Badge */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white text-sm shadow-2xs"
                    style={{ backgroundColor: group.avatarColor || '#0EA5E9' }}
                  >
                    {group.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center text-[10px] shadow-2xs">
                    {getCategoryIcon(group.category)}
                  </div>
                </div>

                {/* Group Chat Info */}
                <div className="flex-1 min-w-0">
                  {/* Top line: Name & Timestamp */}
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h3 className={`text-xs font-bold truncate transition-colors ${
                      isSelected ? 'text-blue-950 font-extrabold' : 'text-slate-900 group-hover:text-blue-600'
                    }`}>
                      {group.name}
                    </h3>
                    <span className="text-[10px] text-slate-400 flex-shrink-0 font-medium">
                      {formattedTime}
                    </span>
                  </div>

                  {/* Second line: Last activity preview snippet */}
                  <p className="text-[11px] text-slate-500 truncate mb-1.5 leading-tight">
                    {stats.lastActivitySnippet}
                  </p>

                  {/* Bottom line: Member count + Personal Balance Pill */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                      <Users2 className="w-3 h-3 text-slate-400" />
                      <span>{group.members.length} members</span>
                    </span>

                    {/* Balance Status Pill */}
                    {isOwed ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shadow-2xs">
                        <TrendingUp className="w-2.5 h-2.5" />
                        <span>+{user.currency}{Math.round(stats.userNetBalance).toLocaleString('en-IN')}</span>
                      </span>
                    ) : owes ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full shadow-2xs">
                        <TrendingDown className="w-2.5 h-2.5" />
                        <span>-{user.currency}{Math.round(Math.abs(stats.userNetBalance)).toLocaleString('en-IN')}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">
                        <CheckCircle2 className="w-2.5 h-2.5 text-slate-400" />
                        <span>Settled</span>
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
