import React, { useState, useMemo } from 'react';
import { 
  Users2, 
  Plus, 
  Receipt, 
  MessageSquare, 
  History, 
  UserPlus, 
  UserMinus, 
  DollarSign, 
  Check, 
  X, 
  ChevronRight, 
  AlertCircle, 
  ArrowRight, 
  Sparkles,
  Calendar,
  Layers,
  Edit2,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { Account, Group, GroupActivityLog, GroupMember, SplitMemberShare, Transaction, UserProfile } from '../types';

interface GroupsViewProps {
  user: UserProfile;
  groups: Group[];
  activityLogs: GroupActivityLog[];
  transactions: Transaction[];
  accounts: Account[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  onCreateGroup: (group: Partial<Group>) => void;
  onAddGroupExpense: (groupId: string, data: { title: string; amount: number; categoryId: string; accountId: string; paidByMemberId: string; splitDetails: SplitMemberShare[]; notes: string }) => void;
  onEditGroupExpense: (txId: string, data: { title: string; amount: number; splitDetails: SplitMemberShare[]; notes: string }) => void;
  onDeleteGroupExpense: (groupId: string, txId: string) => void;
  onAddGroupMember: (groupId: string, name: string, email: string) => void;
  onRemoveGroupMember: (groupId: string, memberId: string, memberName: string) => void;
  onSettleGroupDebt: (groupId: string, fromMemberId: string, toMemberId: string, amount: number, accountId: string) => void;
}

interface FlowItem {
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

// Helper to format date headers (e.g. "Today", "Yesterday", or "Aug 26, 2026")
function formatFlowDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;

    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateString;
  }
}

export const GroupsView: React.FC<GroupsViewProps> = ({
  user,
  groups,
  activityLogs,
  transactions,
  accounts,
  selectedGroupId,
  onSelectGroup,
  onCreateGroup,
  onAddGroupExpense,
  onEditGroupExpense,
  onDeleteGroupExpense,
  onAddGroupMember,
  onRemoveGroupMember,
  onSettleGroupDebt,
}) => {
  const activeGroup = groups.find(g => g.id === selectedGroupId) || groups[0];

  // Sub-tabs in active group
  const [groupTab, setGroupTab] = useState<'expenses_activity' | 'members'>('expenses_activity');

  // Modals state
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // New Group Form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupCat, setNewGroupCat] = useState<'Trip' | 'Home' | 'Project' | 'Friends' | 'Other'>('Trip');
  const [newGroupColor, setNewGroupColor] = useState('#0EA5E9');

  // Add Expense Form
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPaidBy, setExpPaidBy] = useState('mem-1');
  const [expAccountId, setExpAccountId] = useState('');
  const [expNotes, setExpNotes] = useState('');
  // Member split selections
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [customShares, setCustomShares] = useState<Record<string, number>>({});
  const [isCustomSplit, setIsCustomSplit] = useState(false);

  // Add Member Form
  const [newMemName, setNewMemName] = useState('');
  const [newMemEmail, setNewMemEmail] = useState('');

  // Settle Debt Form
  const [settleFrom, setSettleFrom] = useState('');
  const [settleTo, setSettleTo] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleAccount, setSettleAccount] = useState('');

  // When opening add expense, initialize all members as selected
  const openAddExpenseModal = () => {
    if (activeGroup) {
      const allIds = activeGroup.members.map(m => m.id);
      setSelectedMemberIds(allIds);
      setExpPaidBy(activeGroup.members[0]?.id || 'mem-1');
      setExpAccountId(accounts[0]?.id || 'acc-1');
      setExpTitle('');
      setExpAmount('');
      setExpNotes('');
      setIsCustomSplit(false);
      setCustomShares({});
    }
    setIsAddExpenseModalOpen(true);
  };

  const openEditExpenseModal = (tx: Transaction) => {
    setEditingTx(tx);
    setExpTitle(tx.title);
    setExpAmount(String(tx.amount));
    setExpNotes(tx.notes || '');
    if (tx.splitDetails) {
      setSelectedMemberIds(tx.splitDetails.filter(s => s.isSelected).map(s => s.memberId));
      const sharesMap: Record<string, number> = {};
      tx.splitDetails.forEach(s => { sharesMap[s.memberId] = s.shareAmount; });
      setCustomShares(sharesMap);
    }
  };

  // Toggle member selection in split (allows deselecting persons)
  const toggleMemberSelection = (memberId: string) => {
    if (selectedMemberIds.includes(memberId)) {
      if (selectedMemberIds.length === 1) return; // Must have at least 1 person selected
      setSelectedMemberIds(selectedMemberIds.filter(id => id !== memberId));
    } else {
      setSelectedMemberIds([...selectedMemberIds, memberId]);
    }
  };

  // Group-specific transactions and logs
  const groupTransactions = transactions.filter(t => t.groupId === activeGroup?.id);
  const groupLogs = activityLogs
    .filter(l => l.groupId === activeGroup?.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Total group spending
  const totalGroupSpend = groupTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Unified Chat / Event Flow Feed (Chronological Stream)
  const flowItems = useMemo<FlowItem[]>(() => {
    if (!activeGroup) return [];

    const items: FlowItem[] = [];
    const processedTxIds = new Set<string>();

    // 1. Process activity logs for this group
    const logs = activityLogs.filter(l => l.groupId === activeGroup.id);

    logs.forEach(log => {
      const member = activeGroup.members.find(m => m.name === log.actorName || m.email === log.actorEmail);
      const avatarColor = member?.avatarColor || '#3B82F6';

      if (log.actionType === 'tx_added') {
        const tx = groupTransactions.find(t => t.id === log.details?.txId);
        if (tx) processedTxIds.add(tx.id);

        items.push({
          id: log.id,
          type: 'expense',
          timestamp: log.timestamp,
          actorName: log.actorName,
          actorAvatarColor: avatarColor,
          message: log.message,
          tx: tx || undefined,
          details: log.details,
        });
      } else if (log.actionType === 'tx_edited') {
        const tx = groupTransactions.find(t => t.id === log.details?.txId);
        if (tx) processedTxIds.add(tx.id);

        items.push({
          id: log.id,
          type: 'tx_edited',
          timestamp: log.timestamp,
          actorName: log.actorName,
          actorAvatarColor: avatarColor,
          message: log.message,
          tx: tx || undefined,
          details: log.details,
        });
      } else if (log.actionType === 'settlement_made') {
        const tx = groupTransactions.find(t => t.id === log.details?.txId);
        if (tx) processedTxIds.add(tx.id);

        items.push({
          id: log.id,
          type: 'settlement',
          timestamp: log.timestamp,
          actorName: log.actorName,
          actorAvatarColor: avatarColor,
          message: log.message,
          tx: tx || undefined,
          details: log.details,
        });
      } else if (log.actionType === 'member_joined') {
        items.push({
          id: log.id,
          type: 'member_joined',
          timestamp: log.timestamp,
          actorName: log.actorName,
          actorAvatarColor: avatarColor,
          message: log.message,
        });
      } else if (log.actionType === 'member_left') {
        items.push({
          id: log.id,
          type: 'member_left',
          timestamp: log.timestamp,
          actorName: log.actorName,
          actorAvatarColor: avatarColor,
          message: log.message,
        });
      } else if (log.actionType === 'group_created') {
        items.push({
          id: log.id,
          type: 'group_created',
          timestamp: log.timestamp,
          actorName: log.actorName,
          actorAvatarColor: avatarColor,
          message: log.message,
        });
      } else if (log.actionType === 'tx_deleted') {
        items.push({
          id: log.id,
          type: 'tx_deleted',
          timestamp: log.timestamp,
          actorName: log.actorName,
          actorAvatarColor: avatarColor,
          message: log.message,
        });
      } else {
        items.push({
          id: log.id,
          type: 'system',
          timestamp: log.timestamp,
          actorName: log.actorName,
          actorAvatarColor: avatarColor,
          message: log.message,
        });
      }
    });

    // 2. Add any group transactions that weren't matched in the logs
    groupTransactions.forEach(tx => {
      if (!processedTxIds.has(tx.id)) {
        const payer = activeGroup.members.find(m => m.id === tx.paidByMemberId) || activeGroup.members[0];
        const isSettlement = tx.type === 'settlement' || tx.categoryId === 'cat-10' || tx.title.toLowerCase().includes('settlement');
        
        items.push({
          id: `flow-tx-${tx.id}`,
          type: isSettlement ? 'settlement' : 'expense',
          timestamp: tx.updatedAt || tx.date,
          actorName: payer?.name || user.name,
          actorAvatarColor: payer?.avatarColor || '#3B82F6',
          message: isSettlement 
            ? `${payer?.name || user.name} settled ${user.currency}${tx.amount.toLocaleString()}`
            : `${payer?.name || user.name} added "${tx.title}" (${user.currency}${tx.amount.toLocaleString()})`,
          tx,
          details: {
            txId: tx.id,
            txTitle: tx.title,
            amount: tx.amount,
            currency: user.currency,
          }
        });
      }
    });

    // 3. Sort chronologically (oldest to newest for natural chat timeline)
    return items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [activeGroup, activityLogs, groupTransactions, user.currency, user.name]);

  // Group flow items by date
  const groupedFlow = useMemo(() => {
    const groupsMap: { dateLabel: string; items: FlowItem[] }[] = [];
    let currentDateLabel = '';
    let currentGroup: FlowItem[] = [];

    flowItems.forEach(item => {
      const label = formatFlowDate(item.timestamp);
      if (label !== currentDateLabel) {
        if (currentGroup.length > 0) {
          groupsMap.push({ dateLabel: currentDateLabel, items: currentGroup });
        }
        currentDateLabel = label;
        currentGroup = [item];
      } else {
        currentGroup.push(item);
      }
    });

    if (currentGroup.length > 0) {
      groupsMap.push({ dateLabel: currentDateLabel, items: currentGroup });
    }

    return groupsMap;
  }, [flowItems]);

  // Group Balance Matrix Calculation (Who paid what vs who consumed what)
  const memberBalances: Record<string, { paid: number; share: number; net: number; member: GroupMember }> = {};
  if (activeGroup) {
    activeGroup.members.forEach(m => {
      memberBalances[m.id] = { paid: 0, share: 0, net: 0, member: m };
    });

    groupTransactions.forEach(tx => {
      if (tx.splitDetails && tx.splitDetails.length > 0) {
        tx.splitDetails.forEach(split => {
          if (memberBalances[split.memberId]) {
            memberBalances[split.memberId].paid += (split.paidAmount || 0);
            memberBalances[split.memberId].share += (split.shareAmount || 0);
          }
        });
      } else {
        // Equal fallback
        const payerId = tx.paidByMemberId || activeGroup.members[0].id;
        if (memberBalances[payerId]) {
          memberBalances[payerId].paid += tx.amount;
        }
        const perPerson = tx.amount / activeGroup.members.length;
        activeGroup.members.forEach(m => {
          if (memberBalances[m.id]) memberBalances[m.id].share += perPerson;
        });
      }
    });

    // Compute net balance: Net = Paid - Share (positive means others owe you, negative means you owe others)
    Object.keys(memberBalances).forEach(id => {
      memberBalances[id].net = memberBalances[id].paid - memberBalances[id].share;
    });
  }

  // Simplified Debts algorithm
  const debtors: { id: string; name: string; amount: number }[] = [];
  const creditors: { id: string; name: string; amount: number }[] = [];

  if (activeGroup) {
    Object.values(memberBalances).forEach(b => {
      if (b.net < -0.01) {
        debtors.push({ id: b.member.id, name: b.member.name, amount: Math.abs(b.net) });
      } else if (b.net > 0.01) {
        creditors.push({ id: b.member.id, name: b.member.name, amount: b.net });
      }
    });
  }

  // Compute equal split dynamically for the modal
  const totalAmountNum = Number(expAmount) || 0;
  const activeCount = selectedMemberIds.length;
  const perPersonShare = activeCount > 0 ? Math.round((totalAmountNum / activeCount) * 100) / 100 : 0;

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle || !totalAmountNum || activeCount === 0 || !activeGroup) return;

    const splitDetails: SplitMemberShare[] = activeGroup.members.map(m => {
      const isSelected = selectedMemberIds.includes(m.id);
      const isPayer = m.id === expPaidBy;
      return {
        memberId: m.id,
        memberName: m.name,
        memberEmail: m.email,
        shareAmount: isSelected ? (isCustomSplit ? (customShares[m.id] || 0) : perPersonShare) : 0,
        paidAmount: isPayer ? totalAmountNum : 0,
        isSelected,
      };
    });

    onAddGroupExpense(activeGroup.id, {
      title: expTitle,
      amount: totalAmountNum,
      categoryId: 'cat-5',
      accountId: expAccountId || accounts[0]?.id || 'acc-1',
      paidByMemberId: expPaidBy,
      splitDetails,
      notes: expNotes,
    });

    setIsAddExpenseModalOpen(false);
  };

  const handleSaveEditExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !activeGroup) return;
    const amount = Number(expAmount) || editingTx.amount;
    const activeSelected = selectedMemberIds.length;
    const perShare = activeSelected > 0 ? Math.round((amount / activeSelected) * 100) / 100 : 0;

    const splitDetails: SplitMemberShare[] = activeGroup.members.map(m => {
      const isSelected = selectedMemberIds.includes(m.id);
      return {
        memberId: m.id,
        memberName: m.name,
        memberEmail: m.email,
        shareAmount: isSelected ? perShare : 0,
        paidAmount: m.id === (editingTx.paidByMemberId || 'mem-1') ? amount : 0,
        isSelected,
      };
    });

    onEditGroupExpense(editingTx.id, {
      title: expTitle,
      amount,
      splitDetails,
      notes: expNotes,
    });

    setEditingTx(null);
  };

  const handleCreateNewGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName) return;

    onCreateGroup({
      name: newGroupName,
      description: newGroupDesc || 'Shared expenses',
      category: newGroupCat,
      avatarColor: newGroupColor,
      currency: user.currency,
      members: [
        { id: 'mem-1', name: `${user.name} (You)`, email: user.email, avatarColor: user.avatarColor, role: 'admin', joinedAt: new Date().toISOString().split('T')[0] }
      ],
    });

    setIsCreateGroupModalOpen(false);
    setNewGroupName('');
    setNewGroupDesc('');
  };

  const handleAddMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !newMemName || !newMemEmail) return;
    onAddGroupMember(activeGroup.id, newMemName, newMemEmail);
    setIsAddMemberModalOpen(false);
    setNewMemName('');
    setNewMemEmail('');
  };

  const handleExecuteSettleDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !settleFrom || !settleTo || !settleAmount) return;
    onSettleGroupDebt(activeGroup.id, settleFrom, settleTo, Number(settleAmount), settleAccount || accounts[0]?.id || 'acc-1');
    setIsSettleModalOpen(false);
    setSettleAmount('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Splitwise
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateGroupModalOpen(true)}
            id="btn-create-group"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-sm transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Group</span>
          </button>
        </div>
      </div>

      {/* Groups Horizontal Selector Tabs */}
      {groups.length > 0 && (
        <div className="flex items-center space-x-3 overflow-x-auto pb-2 scrollbar-none">
          {groups.map((grp) => {
            const isSelected = grp.id === activeGroup?.id;
            return (
              <button
                key={grp.id}
                onClick={() => onSelectGroup(grp.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl border text-sm font-semibold transition whitespace-nowrap shadow-xs ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{grp.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${isSelected ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                  {grp.members.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Active Group Details Card */}
      {activeGroup ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Group Header Banner */}
          <div className="p-6 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Created {activeGroup.createdAt}</span>
                <span>•</span>
                <span>{activeGroup.members.length} members</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-1">{activeGroup.name}</h2>
              {activeGroup.description && (
                <p className="text-xs text-slate-300 mt-1">{activeGroup.description}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="group bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700 text-right">
                <span className="text-[10px] uppercase text-slate-400 block font-medium">Total Group Spend</span>
                <span className="text-lg font-bold text-emerald-400 privacy-value">{activeGroup.currency}{totalGroupSpend.toLocaleString()}</span>
              </div>

              <button
                onClick={openAddExpenseModal}
                id="btn-group-add-expense"
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Expense</span>
              </button>
            </div>
          </div>

          {/* Group Navigation Sub-tabs */}
          <div className="px-6 border-b border-slate-200 flex items-center space-x-6 bg-slate-50/50">
            {[
              { id: 'expenses_activity', label: 'Activity Flow', count: flowItems.length, icon: MessageSquare },
              { id: 'members', label: 'Members', count: activeGroup.members.length, icon: Users2 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = groupTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setGroupTab(tab.id as any)}
                  className={`py-3.5 flex items-center space-x-2 text-xs font-bold border-b-2 transition cursor-pointer ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* UNIFIED CHAT-STYLE SINGLE FLOW (Expenses, Member Updates, Settlements) */}
          {groupTab === 'expenses_activity' && (
            <div className="p-4 sm:p-6 bg-slate-50/40">
              <div className="max-w-3xl mx-auto space-y-6">
                
                {/* Empty State */}
                {flowItems.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-2xs">
                    <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-base font-bold text-slate-900">Start the group conversation</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Add your first shared expense, split bills with roommates or travel buddies, and log settlements in real-time.
                    </p>
                    <button
                      onClick={openAddExpenseModal}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                    >
                      Record First Expense
                    </button>
                  </div>
                ) : (
                  /* Chat Timeline Stream */
                  <div className="space-y-6">
                    {groupedFlow.map((group, gIdx) => (
                      <div key={gIdx} className="space-y-3">
                        {/* Date Divider Pill */}
                        <div className="flex items-center justify-center my-4">
                          <span className="bg-slate-200/90 text-slate-700 text-[11px] font-bold px-3 py-0.5 rounded-full border border-slate-300/50 shadow-2xs select-none">
                            {group.dateLabel}
                          </span>
                        </div>

                        {/* Event Messages */}
                        {group.items.map((item) => {
                          const isSystemAction =
                            item.type === 'member_joined' ||
                            item.type === 'member_left' ||
                            item.type === 'group_created' ||
                            item.type === 'tx_deleted' ||
                            item.type === 'system';

                          // Render System Notification (Centered WhatsApp Pill)
                          if (isSystemAction) {
                            return (
                              <div key={item.id} className="flex justify-center my-2.5">
                                <div className="bg-white text-slate-700 text-xs font-medium px-4 py-1.5 rounded-full border border-slate-200/90 shadow-2xs flex items-center gap-2 max-w-md text-center">
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

                          // Render Settlement Message
                          if (item.type === 'settlement') {
                            return (
                              <div key={item.id} className="flex items-start space-x-3 my-3">
                                <div
                                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-2xs flex-shrink-0 mt-0.5"
                                  style={{ backgroundColor: item.actorAvatarColor || '#10B981' }}
                                >
                                  {item.actorName.substring(0, 2).toUpperCase()}
                                </div>

                                <div className="flex-1 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 shadow-2xs p-4 hover:border-emerald-300 transition">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-xs text-slate-900">{item.actorName}</span>
                                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        settled debt
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>

                                  <div className="mt-2 p-2.5 bg-white rounded-xl border border-emerald-100 flex items-center justify-between gap-3">
                                    <p className="text-xs font-semibold text-slate-900">{item.message}</p>
                                    {item.details?.amount && (
                                      <span className="text-sm font-extrabold text-emerald-700 privacy-value">
                                        {user.currency}{item.details.amount.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // Render Expense Message Card (Added or Edited)
                          const payer = item.tx
                            ? (activeGroup.members.find(m => m.id === item.tx?.paidByMemberId) || activeGroup.members[0])
                            : null;
                          const selectedCount = item.tx?.splitDetails?.filter(s => s.isSelected).length || activeGroup.members.length;
                          const deselectedMembers = item.tx?.splitDetails?.filter(s => !s.isSelected) || [];
                          const amount = item.tx?.amount || item.details?.amount || 0;
                          const title = item.tx?.title || item.details?.txTitle || 'Expense';

                          return (
                            <div key={item.id} className="flex items-start space-x-3 my-3">
                              {/* Member Avatar */}
                              <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-2xs flex-shrink-0 mt-0.5"
                                style={{ backgroundColor: item.actorAvatarColor || '#3B82F6' }}
                              >
                                {item.actorName.substring(0, 2).toUpperCase()}
                              </div>

                              {/* Chat Bubble Card */}
                              <div className="flex-1 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 hover:border-slate-300 transition group">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-xs text-slate-900">{item.actorName}</span>
                                    <span className="text-[11px] text-slate-500 font-medium">
                                      {item.type === 'tx_edited' ? 'updated expense' : 'added an expense'}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>

                                {/* Expense Details Row */}
                                <div className="mt-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                                      <Receipt className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <h4 className="font-bold text-sm text-slate-900">{title}</h4>
                                      <p className="text-xs text-slate-600 mt-0.5">
                                        Paid by <strong className="text-slate-900">{payer?.name || item.actorName}</strong> • Split among <strong className="text-slate-900">{selectedCount} members</strong>
                                      </p>
                                      {item.tx?.notes && (
                                        <p className="text-xs text-slate-500 italic mt-0.5">"{item.tx.notes}"</p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end flex-shrink-0">
                                    <span className="text-base font-extrabold text-slate-900 privacy-value">
                                      {user.currency}{amount.toLocaleString()}
                                    </span>

                                    {/* Action Buttons */}
                                    {item.tx && (
                                      <div className="flex items-center gap-1 mt-1.5">
                                        <button
                                          onClick={() => openEditExpenseModal(item.tx!)}
                                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-200/60 rounded-md transition cursor-pointer"
                                          title="Edit Expense"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => onDeleteGroupExpense(activeGroup.id, item.tx!.id)}
                                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-100/60 rounded-md transition cursor-pointer"
                                          title="Delete Expense"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Deselected warning tag if any member was excluded */}
                                {deselectedMembers.length > 0 && (
                                  <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md inline-flex">
                                    <AlertCircle className="w-3 h-3" />
                                    <span>Excluded from split: {deselectedMembers.map(m => m.memberName).join(', ')}</span>
                                  </div>
                                )}

                                {/* Member Split Pills */}
                                {item.tx?.splitDetails && (
                                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                                    {item.tx.splitDetails.map((split) => (
                                      <span
                                        key={split.memberId}
                                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                          split.isSelected
                                            ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                                            : 'bg-slate-100 text-slate-400 line-through'
                                        }`}
                                      >
                                        {split.memberName.split(' ')[0]}: <span className="privacy-value">{user.currency}{split.shareAmount}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* TAB: GROUP MEMBERS WITH AMOUNT OWED & NET POSITION */}
          {groupTab === 'members' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Group Members ({activeGroup.members.length})</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Individual shares, total paid, and net balance owed.</p>
                </div>
                <button
                  onClick={() => setIsAddMemberModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Member</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {activeGroup.members.map((mem) => {
                  const balance = memberBalances[mem.id];
                  const net = balance ? balance.net : 0;
                  const isOwed = net > 0.01;
                  const owes = net < -0.01;

                  return (
                    <div key={mem.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-2xs flex-shrink-0"
                          style={{ backgroundColor: mem.avatarColor }}
                        >
                          {mem.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{mem.name}</span>
                            {mem.role === 'admin' && (
                              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded">
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {mem.email} • Paid: <span className="privacy-value font-medium text-slate-700">{user.currency}{balance ? Math.round(balance.paid).toLocaleString() : 0}</span> • Share: <span className="privacy-value font-medium text-slate-700">{user.currency}{balance ? Math.round(balance.share).toLocaleString() : 0}</span>
                          </p>
                        </div>
                      </div>

                      {/* Amount owed against member + Settle / Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 pl-13 sm:pl-0">
                        {/* Net status pill */}
                        <div>
                          {isOwed ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full">
                              <span>+{user.currency}{Math.round(net).toLocaleString()}</span>
                              <span className="text-[10px] font-medium opacity-80">(gets back)</span>
                            </span>
                          ) : owes ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200/80 px-2.5 py-1 rounded-full">
                              <span>-{user.currency}{Math.round(Math.abs(net)).toLocaleString()}</span>
                              <span className="text-[10px] font-medium opacity-80">(owes)</span>
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                              Settled (₹0)
                            </span>
                          )}
                        </div>

                        {/* Settle button if member owes */}
                        {owes && (
                          <button
                            onClick={() => {
                              setSettleFrom(mem.id);
                              const bestCreditor = creditors[0];
                              setSettleTo(bestCreditor?.id || (mem.id === 'mem-1' ? (activeGroup.members.find(m => m.id !== 'mem-1')?.id || '') : 'mem-1'));
                              setSettleAmount(String(Math.round(Math.abs(net))));
                              setIsSettleModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs transition cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Settle</span>
                          </button>
                        )}

                        {mem.id !== 'mem-1' && (
                          <button
                            onClick={() => onRemoveGroupMember(activeGroup.id, mem.id, mem.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Remove member from group"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Groups Created Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Create groups for roommates, road trips, weekend parties, or office projects to split expenses seamlessly with itemized person exclusion.
          </p>
          <button
            onClick={() => setIsCreateGroupModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Group</span>
          </button>
        </div>
      )}

      {/* MODAL 1: Add Group Expense with Person Deselection */}
      {isAddExpenseModalOpen && activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Add Group Expense</h2>
            <p className="text-xs text-slate-700 mb-4">
              Group: <strong>{activeGroup.name}</strong> • Deselect any person who did not participate in this expense.
            </p>

            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Expense Title / Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scuba Diving, Dinner Bill, Villa Rental"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Total Amount ({user.currency})</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 12000"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Paid By</label>
                  <select
                    value={expPaidBy}
                    onChange={(e) => setExpPaidBy(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  >
                    {activeGroup.members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Debit From Account</label>
                <select
                  value={expAccountId}
                  onChange={(e) => setExpAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type === 'credit_card' ? `Credit Card • Due ${a.currency}${a.dueAmount}` : `Bank • Balance ${a.currency}${a.balance}`})
                    </option>
                  ))}
                </select>
              </div>

              {/* Person Deselection & Custom Split Matrix */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-slate-700">
                    Split with ({activeCount} of {activeGroup.members.length} members selected)
                  </span>
                  <span className="text-xs font-bold text-blue-600">
                    {activeCount > 0 ? `${user.currency}${perPersonShare}/person` : 'Select at least 1'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-700">
                  Tap any member to include or exclude them from this bill:
                </p>

                <div className="space-y-2">
                  {activeGroup.members.map((m) => {
                    const isSelected = selectedMemberIds.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleMemberSelection(m.id)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                          isSelected
                            ? 'bg-white border-blue-500 shadow-xs'
                            : 'bg-slate-100/60 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs text-white ${isSelected ? 'bg-blue-600' : 'bg-slate-300'}`}>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <span className={`text-xs font-bold ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                            {m.name}
                          </span>
                        </div>

                        <div className="text-xs font-bold">
                          {isSelected ? (
                            <span className="text-blue-700">{user.currency}{perPersonShare}</span>
                          ) : (
                            <span className="text-slate-400">Excluded (₹0)</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Notes / Why someone was excluded</label>
                <input
                  type="text"
                  placeholder="e.g. David skipped scuba diving; split among remaining 4"
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={activeCount === 0 || !totalAmountNum}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm"
                >
                  Save & Split Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Group */}
      {isCreateGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Create New Splitwise Group</h2>
            <p className="text-xs text-slate-700 mb-4">Set up a group for a trip, house rent, or shared project.</p>

            <form onSubmit={handleCreateNewGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Manali Road Trip, Apartment 201"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Fuel, hotels, dining, rentals"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Group Color</label>
                <div className="flex items-center gap-2">
                  {['#0EA5E9', '#10B981', '#EC4899', '#8B5CF6', '#F59E0B', '#EF4444'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewGroupColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${newGroupColor === c ? 'scale-125 ring-2 ring-slate-900' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateGroupModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Group Member */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Add Member to Group</h2>
            <p className="text-xs text-slate-700 mb-4">
              This will also log a <code>member_joined</code> event into the WhatsApp-style activity feed.
            </p>

            <form onSubmit={handleAddMemberSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Member Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Seth"
                  value={newMemName}
                  onChange={(e) => setNewMemName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="vikram.seth@example.com"
                  value={newMemEmail}
                  onChange={(e) => setNewMemEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddMemberModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Settle Group Debt */}
      {isSettleModalOpen && activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Record Group Settlement</h2>
            <p className="text-xs text-slate-700 mb-4">
              Record a payment between two group members to clear or reduce debt.
            </p>

            <form onSubmit={handleExecuteSettleDebt} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Who is Paying?</label>
                <select
                  required
                  value={settleFrom}
                  onChange={(e) => setSettleFrom(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                >
                  <option value="">Select payer</option>
                  {activeGroup.members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Who is Receiving?</label>
                <select
                  required
                  value={settleTo}
                  onChange={(e) => setSettleTo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                >
                  <option value="">Select receiver</option>
                  {activeGroup.members.filter(m => m.id !== settleFrom).map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Settlement Amount ({user.currency})</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 4500"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Recorded Against Account</label>
                <select
                  value={settleAccount}
                  onChange={(e) => setSettleAccount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm"
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
