import React, { useState, useMemo } from 'react';
import { 
  Users2, 
  Plus, 
  X, 
  Check, 
  Search, 
  UserPlus, 
  UserCheck, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Receipt,
  HandCoins,
  Sparkles,
  ArrowRightLeft,
  Wallet,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { 
  Account, 
  Friend, 
  Group, 
  GroupActivityLog, 
  GroupMember, 
  SplitMemberShare, 
  Transaction, 
  UserProfile 
} from '../types';
import { SplitEditor, SplitMode } from './SplitEditor';
import { GroupListPane } from './groups/GroupListPane';
import { GroupChatPane } from './groups/GroupChatPane';
import { GroupDetailsPane } from './groups/GroupDetailsPane';

interface GroupsViewProps {
  user: UserProfile;
  groups: Group[];
  friends: Friend[];
  activityLogs: GroupActivityLog[];
  transactions: Transaction[];
  accounts: Account[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  onCreateGroup: (group: Partial<Group>) => void;
  onAddGroupExpense: (groupId: string, data: { title: string; amount: number; categoryId: string; accountId: string; paidByMemberId: string; splitDetails: SplitMemberShare[]; notes: string }) => void;
  onEditGroupExpense: (txId: string, data: { title: string; amount: number; date?: string; accountId?: string; paidByMemberId?: string; splitDetails: SplitMemberShare[]; notes: string }) => void;
  onDeleteGroupExpense: (groupId: string, txId: string) => void;
  onAddGroupMember: (groupId: string, name: string, email: string) => void;
  onRemoveGroupMember: (groupId: string, memberId: string, memberName: string) => void;
  onSettleGroupDebt: (groupId: string, fromMemberId: string, toMemberId: string, amount: number, accountId: string) => void;
  onAddFriend?: (friend: Partial<Friend>) => void;
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
  friends,
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
  onAddFriend,
}) => {
  // Current active group
  const activeGroup = groups.find(g => g.id === selectedGroupId) || groups[0] || null;

  // Responsive / View state
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [isRightPaneOpen, setIsRightPaneOpen] = useState<boolean>(false);

  // Modals state
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // New Group Form State
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupCat, setNewGroupCat] = useState<'Trip' | 'Home' | 'Project' | 'Friends' | 'Other'>('Trip');
  const [newGroupColor, setNewGroupColor] = useState('#0EA5E9');
  const [selectedInitialFriendIds, setSelectedInitialFriendIds] = useState<string[]>([]);
  const [friendSearchCreate, setFriendSearchCreate] = useState('');

  // Add Expense Form State
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPaidBy, setExpPaidBy] = useState('mem-1');
  const [expAccountId, setExpAccountId] = useState('');
  const [expNotes, setExpNotes] = useState('');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [exactShares, setExactShares] = useState<Record<string, number>>({});
  const [percentageShares, setPercentageShares] = useState<Record<string, number>>({});

  // Add Member Form State
  const [addMemberTab, setAddMemberTab] = useState<'global_friends' | 'manual'>('global_friends');
  const [selectedFriendIdsToAdd, setSelectedFriendIdsToAdd] = useState<string[]>([]);
  const [friendSearchAdd, setFriendSearchAdd] = useState('');
  const [saveToGlobalFriends, setSaveToGlobalFriends] = useState(true);
  const [newMemName, setNewMemName] = useState('');
  const [newMemEmail, setNewMemEmail] = useState('');

  // Settle Debt Form State
  const [settleFrom, setSettleFrom] = useState('');
  const [settleTo, setSettleTo] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleAccount, setSettleAccount] = useState('');

  // Edit Expense Form State
  const [editExpTitle, setEditExpTitle] = useState('');
  const [editExpAmount, setEditExpAmount] = useState('');
  const [editExpDate, setEditExpDate] = useState('');
  const [editExpPaidBy, setEditExpPaidBy] = useState('');
  const [editExpAccountId, setEditExpAccountId] = useState('');
  const [editExpNotes, setEditExpNotes] = useState('');
  const [editSplitMode, setEditSplitMode] = useState<SplitMode>('equal');
  const [editSelectedMemberIds, setEditSelectedMemberIds] = useState<string[]>([]);
  const [editExactShares, setEditExactShares] = useState<Record<string, number>>({});
  const [editPercentageShares, setEditPercentageShares] = useState<Record<string, number>>({});

  // Filter transactions for the active group
  const groupTransactions = useMemo(() => {
    if (!activeGroup) return [];
    return transactions.filter(t => t.groupId === activeGroup.id);
  }, [transactions, activeGroup]);

  // Total Group Spend
  const totalGroupSpend = useMemo(() => {
    return groupTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [groupTransactions]);

  // Unadded Global Friends (Friends who are NOT in the active group yet)
  const unaddedFriends = useMemo(() => {
    if (!activeGroup || !friends) return [];
    const groupMemberEmails = new Set(
      activeGroup.members
        .filter(m => Boolean(m?.email))
        .map(m => (m.email || '').trim().toLowerCase())
    );
    const groupMemberNames = new Set(
      activeGroup.members
        .filter(m => Boolean(m?.name))
        .map(m => (m.name || '').trim().toLowerCase())
    );
    return friends.filter(f => {
      const emailMatch = Boolean(f.email) && groupMemberEmails.has((f.email || '').trim().toLowerCase());
      const nameMatch = Boolean(f.name) && groupMemberNames.has((f.name || '').trim().toLowerCase());
      return !emailMatch && !nameMatch;
    });
  }, [activeGroup, friends]);

  // Generate WhatsApp Style Timeline Flow Items (merged logs + transactions)
  const flowItems = useMemo(() => {
    if (!activeGroup) return [];

    const groupLogs = activityLogs.filter(l => l.groupId === activeGroup.id);
    const items: FlowItem[] = [];
    const processedTxIds = new Set<string>();

    groupLogs.forEach(log => {
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

    // Add any group transactions not present in the activity logs
    groupTransactions.forEach(tx => {
      if (!processedTxIds.has(tx.id)) {
        const payer = activeGroup.members.find(m => m.id === tx.paidByMemberId) || activeGroup.members[0];
        const isSettlement = tx.type === 'settlement' || tx.categoryId === 'cat-10' || (tx.title || '').toLowerCase().includes('settlement');
        
        items.push({
          id: `flow-tx-${tx.id}`,
          type: isSettlement ? 'settlement' : 'expense',
          timestamp: tx.updatedAt || tx.date,
          actorName: payer?.name || user.name,
          actorAvatarColor: payer?.avatarColor || '#3B82F6',
          message: isSettlement 
            ? `${payer?.name || user.name} settled ${user.currency}${tx.amount.toLocaleString('en-IN')}`
            : `${payer?.name || user.name} added "${tx.title}" (${user.currency}${tx.amount.toLocaleString('en-IN')})`,
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

    // Sort chronologically (oldest at top, latest at bottom like messenger chat apps)
    return items.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      if (timeA !== timeB) return timeA - timeB;
      return (a.id || '').localeCompare(b.id || '');
    });
  }, [activeGroup, activityLogs, groupTransactions, user.currency, user.name]);

  // Group flow items by date for WhatsApp separators
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
  const memberBalances = useMemo(() => {
    const balances: Record<string, { paid: number; share: number; net: number; member: GroupMember }> = {};
    if (!activeGroup) return balances;

    activeGroup.members.forEach(m => {
      balances[m.id] = { paid: 0, share: 0, net: 0, member: m };
    });

    groupTransactions.forEach(tx => {
      if (tx.splitDetails && tx.splitDetails.length > 0) {
        tx.splitDetails.forEach(split => {
          if (balances[split.memberId]) {
            balances[split.memberId].paid += (split.paidAmount || 0);
            balances[split.memberId].share += (split.shareAmount || 0);
          }
        });
      } else {
        const payerId = tx.paidByMemberId || activeGroup.members[0].id;
        if (balances[payerId]) {
          balances[payerId].paid += tx.amount;
        }
        const perPerson = activeGroup.members.length > 0 ? (tx.amount / activeGroup.members.length) : 0;
        activeGroup.members.forEach(m => {
          if (balances[m.id]) {
            balances[m.id].share += perPerson;
          }
        });
      }
    });

    Object.keys(balances).forEach(id => {
      balances[id].net = balances[id].paid - balances[id].share;
    });

    return balances;
  }, [activeGroup, groupTransactions]);

  // Simplified Debts algorithm (Greedy matching)
  const simplifiedDebts = useMemo(() => {
    if (!activeGroup) return [];
    const debts: { from: GroupMember; to: GroupMember; amount: number }[] = [];
    
    const dList: { member: GroupMember; amount: number }[] = [];
    const cList: { member: GroupMember; amount: number }[] = [];

    const balanceValues = Object.values(memberBalances) as { paid: number; share: number; net: number; member: GroupMember }[];
    balanceValues.forEach(b => {
      if (b.net < -0.01) {
        dList.push({ member: b.member, amount: Math.abs(b.net) });
      } else if (b.net > 0.01) {
        cList.push({ member: b.member, amount: b.net });
      }
    });

    let i = 0;
    let j = 0;

    while (i < dList.length && j < cList.length) {
      const debtor = dList[i];
      const creditor = cList[j];
      const settleAmt = Math.min(debtor.amount, creditor.amount);

      if (settleAmt > 0.01) {
        debts.push({
          from: debtor.member,
          to: creditor.member,
          amount: Math.round(settleAmt),
        });
      }

      debtor.amount -= settleAmt;
      creditor.amount -= settleAmt;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return debts;
  }, [activeGroup, memberBalances]);

  // Overall group metrics across all groups
  const overallGroupStats = useMemo(() => {
    let totalSpendAll = 0;
    let totalYouAreOwed = 0;
    let totalYouOwe = 0;
    const uniqueMemberKeys = new Set<string>();

    groups.forEach(g => {
      const gTxs = transactions.filter(t => t.groupId === g.id);
      const gSpend = gTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      totalSpendAll += gSpend;

      g.members.forEach(m => {
        if (m.email) uniqueMemberKeys.add(m.email.toLowerCase());
        else if (m.name) uniqueMemberKeys.add(m.name.toLowerCase());
      });

      // Calculate user balance in this group
      const balances: Record<string, { paid: number; share: number; net: number }> = {};
      g.members.forEach(m => {
        balances[m.id] = { paid: 0, share: 0, net: 0 };
      });

      gTxs.forEach(tx => {
        const txAmt = Number(tx.amount) || 0;
        if (tx.splitDetails && tx.splitDetails.length > 0) {
          const payerId = tx.paidByMemberId || g.members[0]?.id;
          if (payerId && balances[payerId]) {
            balances[payerId].paid += txAmt;
          }
          tx.splitDetails.forEach(s => {
            if (s.isSelected && balances[s.memberId]) {
              balances[s.memberId].share += Number(s.shareAmount) || 0;
            }
          });
        } else {
          const payerId = tx.paidByMemberId || g.members[0]?.id;
          if (payerId && balances[payerId]) {
            balances[payerId].paid += txAmt;
          }
          const perPerson = g.members.length > 0 ? (txAmt / g.members.length) : 0;
          g.members.forEach(m => {
            if (balances[m.id]) {
              balances[m.id].share += perPerson;
            }
          });
        }
      });

      // Find current user in this group
      const userMember = g.members.find(m => 
        (m.name && m.name.includes('(You)')) ||
        (m.email && user.email && m.email.toLowerCase() === user.email.toLowerCase()) ||
        m.id === 'mem-1'
      );
      if (userMember && balances[userMember.id]) {
        const net = balances[userMember.id].paid - balances[userMember.id].share;
        if (net > 0.01) {
          totalYouAreOwed += net;
        } else if (net < -0.01) {
          totalYouOwe += Math.abs(net);
        }
      }
    });

    return {
      totalSpendAll,
      totalYouAreOwed,
      totalYouOwe,
      groupsCount: groups.length,
      membersCount: uniqueMemberKeys.size || groups.reduce((acc, g) => acc + g.members.length, 0),
    };
  }, [groups, transactions, user.email]);

  // Modal Open Handlers
  const handleOpenAddExpense = () => {
    if (!activeGroup) return;
    setExpTitle('');
    setExpAmount('');
    setExpPaidBy('mem-1');
    setExpAccountId(accounts[0]?.id || 'acc-1');
    setExpNotes('');
    setSplitMode('equal');
    setSelectedMemberIds(activeGroup.members.map(m => m.id));
    setExactShares({});
    setPercentageShares({});
    setIsAddExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (tx: Transaction) => {
    if (!activeGroup) return;
    setEditingTx(tx);
    setEditExpTitle(tx.title);
    setEditExpAmount(String(tx.amount));
    const txDateStr = tx.date || new Date().toISOString().split('T')[0];
    setEditExpDate(txDateStr.includes('T') ? txDateStr.split('T')[0] : txDateStr);
    setEditExpPaidBy(tx.paidByMemberId || activeGroup.members[0]?.id || 'mem-1');
    setEditExpAccountId(tx.accountId || accounts[0]?.id || 'acc-1');
    setEditExpNotes(tx.notes || '');

    if (tx.splitDetails && tx.splitDetails.length > 0) {
      const selectedIds = tx.splitDetails.filter(s => s.isSelected).map(s => s.memberId);
      setEditSelectedMemberIds(selectedIds.length > 0 ? selectedIds : activeGroup.members.map(m => m.id));
      
      const exacts: Record<string, number> = {};
      const pcts: Record<string, number> = {};
      tx.splitDetails.forEach(s => {
        exacts[s.memberId] = s.shareAmount;
        if (tx.amount > 0) {
          pcts[s.memberId] = Math.round((s.shareAmount / tx.amount) * 100);
        }
      });
      setEditExactShares(exacts);
      setEditPercentageShares(pcts);
      setEditSplitMode('equal');
    } else {
      setEditSelectedMemberIds(activeGroup.members.map(m => m.id));
      setEditExactShares({});
      setEditPercentageShares({});
      setEditSplitMode('equal');
    }
  };

  const handleOpenSettleModal = (fromId?: string, toId?: string, amount?: number) => {
    if (!activeGroup) return;
    const defaultFrom = fromId || (activeGroup.members.find(m => memberBalances[m.id]?.net < -0.01)?.id || 'mem-1');
    const defaultTo = toId || (activeGroup.members.find(m => memberBalances[m.id]?.net > 0.01 && m.id !== defaultFrom)?.id || activeGroup.members.find(m => m.id !== defaultFrom)?.id || 'mem-1');
    
    setSettleFrom(defaultFrom);
    setSettleTo(defaultTo);
    setSettleAmount(amount ? String(amount) : '');
    setSettleAccount(accounts[0]?.id || 'acc-1');
    setIsSettleModalOpen(true);
  };

  // Direct Settle from Debt Matrix or Member card
  const handleDirectSettle = (fromMemberId: string, toMemberId: string, amount: number) => {
    handleOpenSettleModal(fromMemberId, toMemberId, amount);
  };

  // Save Expense Handler
  const totalAmountNum = Number(expAmount) || 0;
  const activeCount = selectedMemberIds.length;
  const perPersonShare = activeCount > 0 ? Math.round((totalAmountNum / activeCount) * 100) / 100 : 0;

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle || !totalAmountNum || activeCount === 0 || !activeGroup) return;

    const splitDetails: SplitMemberShare[] = activeGroup.members.map(m => {
      const isSelected = selectedMemberIds.includes(m.id);
      const isPayer = m.id === expPaidBy;
      let share = 0;
      if (isSelected) {
        if (splitMode === 'equal') {
          share = perPersonShare;
        } else if (splitMode === 'exact') {
          share = exactShares[m.id] !== undefined ? exactShares[m.id] : perPersonShare;
        } else if (splitMode === 'percentage') {
          const pct = percentageShares[m.id] !== undefined ? percentageShares[m.id] : (activeCount > 0 ? (100 / activeCount) : 0);
          share = Math.round(((pct / 100) * totalAmountNum) * 100) / 100;
        }
      }

      return {
        memberId: m.id,
        memberName: m.name,
        memberEmail: m.email,
        shareAmount: Math.max(0, share),
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

  // Save Edit Expense Handler
  const editTotalAmountNum = Number(editExpAmount) || 0;
  const editActiveCount = editSelectedMemberIds.length;

  const handleSaveEditExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !activeGroup) return;
    const amount = Number(editExpAmount) || editingTx.amount;
    const activeSelected = editSelectedMemberIds.length;
    if (activeSelected === 0 || amount <= 0) return;
    const equalShare = Math.round((amount / activeSelected) * 100) / 100;

    const splitDetails: SplitMemberShare[] = activeGroup.members.map(m => {
      const isSelected = editSelectedMemberIds.includes(m.id);
      const isPayer = m.id === editExpPaidBy;
      let share = 0;
      if (isSelected) {
        if (editSplitMode === 'equal') {
          share = equalShare;
        } else if (editSplitMode === 'exact') {
          share = editExactShares[m.id] !== undefined ? editExactShares[m.id] : equalShare;
        } else if (editSplitMode === 'percentage') {
          const pct = editPercentageShares[m.id] !== undefined ? editPercentageShares[m.id] : (activeSelected > 0 ? (100 / activeSelected) : 0);
          share = Math.round(((pct / 100) * amount) * 100) / 100;
        }
      }

      return {
        memberId: m.id,
        memberName: m.name,
        memberEmail: m.email,
        shareAmount: Math.max(0, share),
        paidAmount: isPayer ? amount : 0,
        isSelected,
      };
    });

    onEditGroupExpense(editingTx.id, {
      title: editExpTitle,
      amount,
      date: editExpDate,
      accountId: editExpAccountId,
      paidByMemberId: editExpPaidBy,
      splitDetails,
      notes: editExpNotes,
    });

    setEditingTx(null);
  };

  // Create Group Handler
  const handleCreateNewGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName) return;

    const selectedFriends = (friends || []).filter(f => selectedInitialFriendIds.includes(f.id));
    const initialMembers: GroupMember[] = [
      {
        id: 'mem-1',
        name: user.name,
        email: user.email,
        avatarColor: user.avatarColor || '#3B82F6',
        role: 'admin',
        joinedAt: new Date().toISOString().split('T')[0],
      },
      ...selectedFriends.map((f, idx) => ({
        id: `mem-f-${Date.now()}-${idx}`,
        name: f.name,
        email: f.email || `${(f.name || 'member').toLowerCase().replace(/\s+/g, '')}@example.com`,
        avatarColor: f.avatarColor || '#10B981',
        role: 'member' as const,
        joinedAt: new Date().toISOString().split('T')[0],
      })),
    ];

    onCreateGroup({
      name: newGroupName,
      description: newGroupDesc || 'Shared expenses',
      category: newGroupCat,
      avatarColor: newGroupColor,
      currency: user.currency,
      members: initialMembers,
    });

    setIsCreateGroupModalOpen(false);
    setNewGroupName('');
    setNewGroupDesc('');
    setSelectedInitialFriendIds([]);
    setFriendSearchCreate('');
  };

  // Quick Add friend to active group
  const handleQuickAddFriendToGroup = (friend: Friend) => {
    if (!activeGroup) return;
    onAddGroupMember(activeGroup.id, friend.name, friend.email);
  };

  // Batch Add friends to active group
  const handleBatchAddFriendsToGroup = () => {
    if (!activeGroup || selectedFriendIdsToAdd.length === 0) return;
    const friendsToAdd = (friends || []).filter(f => selectedFriendIdsToAdd.includes(f.id));
    friendsToAdd.forEach(f => {
      onAddGroupMember(activeGroup.id, f.name, f.email);
    });
    setSelectedFriendIdsToAdd([]);
    setFriendSearchAdd('');
    setIsAddMemberModalOpen(false);
  };

  // Add Member Submit
  const handleAddMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !newMemName || !newMemEmail) return;

    onAddGroupMember(activeGroup.id, newMemName, newMemEmail);

    if (saveToGlobalFriends && onAddFriend) {
      onAddFriend({
        name: newMemName,
        email: newMemEmail,
        phone: '',
        avatarColor: '#3B82F6',
      });
    }

    setIsAddMemberModalOpen(false);
    setNewMemName('');
    setNewMemEmail('');
    setFriendSearchAdd('');
    setSelectedFriendIdsToAdd([]);
  };

  // Execute Settle Debt
  const handleExecuteSettleDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !settleFrom || !settleTo || !settleAmount) return;
    onSettleGroupDebt(activeGroup.id, settleFrom, settleTo, Number(settleAmount), settleAccount || accounts[0]?.id || 'acc-1');
    setIsSettleModalOpen(false);
    setSettleAmount('');
  };

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const toggleEditMemberSelection = (memberId: string) => {
    setEditSelectedMemberIds(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  // Select Group handler with mobile view transition
  const handleSelectGroup = (groupId: string | null) => {
    onSelectGroup(groupId);
    setMobileView('chat');
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Unified Top Toolbar: Metrics Cards + Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 flex-wrap">
        {/* Left Side: Compact Metric Cards (same button height) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Total Shared Spend Pill */}
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200/90 rounded-xl text-xs shadow-2xs">
            <Receipt className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <span className="text-slate-500 font-medium">Shared Spend:</span>
            <span className="font-bold text-slate-900 privacy-value">
              {user.currency}{Math.round(overallGroupStats.totalSpendAll).toLocaleString('en-IN')}
            </span>
          </div>

          {/* You are Owed Pill */}
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50/80 border border-emerald-200 text-emerald-900 rounded-xl text-xs shadow-2xs">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span className="text-emerald-700 font-medium">You are owed:</span>
            <span className="font-bold text-emerald-800 privacy-value">
              +{user.currency}{Math.round(overallGroupStats.totalYouAreOwed).toLocaleString('en-IN')}
            </span>
          </div>

          {/* You Owe Pill */}
          <div className="flex items-center gap-2 px-3 py-2 bg-rose-50/80 border border-rose-200 text-rose-900 rounded-xl text-xs shadow-2xs">
            <TrendingDown className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
            <span className="text-rose-700 font-medium">You owe:</span>
            <span className="font-bold text-rose-800 privacy-value">
              -{user.currency}{Math.round(overallGroupStats.totalYouOwe).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsCreateGroupModalOpen(true)}
            id="btn-top-create-group"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Group</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      {groups.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-2xs">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Shared Groups Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Create groups for apartment expenses, vacations, group dinners, or office projects to split costs with precision and settle up anytime.
          </p>
          <button
            onClick={() => setIsCreateGroupModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Group</span>
          </button>
        </div>
      ) : (
        <>
          <div className="w-full h-[calc(100vh-170px)] min-h-[640px] bg-white rounded-2xl border border-slate-200 shadow-2xs flex overflow-hidden">
            {/* COLUMN 1: Groups List Sidebar */}
            <div className={`w-full md:w-80 lg:w-84 xl:w-96 flex-shrink-0 h-full border-r border-slate-200 flex flex-col ${
              mobileView === 'list' ? 'flex' : 'hidden md:flex'
            }`}>
              <GroupListPane
                user={user}
                groups={groups}
                selectedGroupId={activeGroup?.id || null}
                activityLogs={activityLogs}
                transactions={transactions}
                onSelectGroup={handleSelectGroup}
                onOpenCreateGroupModal={() => setIsCreateGroupModalOpen(true)}
              />
            </div>

            {/* COLUMN 2: Center Activity & Expense Flow */}
            <div className={`flex-1 min-w-0 h-full flex flex-col ${
              mobileView === 'chat' ? 'flex' : 'hidden md:flex'
            }`}>
              <GroupChatPane
                user={user}
                activeGroup={activeGroup}
                flowItems={flowItems}
                groupedFlow={groupedFlow}
                totalGroupSpend={totalGroupSpend}
                isRightPaneOpen={isRightPaneOpen}
                onToggleRightPane={() => setIsRightPaneOpen(prev => !prev)}
                onOpenAddExpenseModal={handleOpenAddExpense}
                onOpenSettleModal={() => handleOpenSettleModal()}
                onOpenEditExpenseModal={handleOpenEditExpense}
                onDeleteGroupExpense={onDeleteGroupExpense}
                onBackToGroupsList={() => setMobileView('list')}
              />
            </div>

            {/* COLUMN 3: Right Group Details & Debt Simplification (XL Screens) */}
            {activeGroup && isRightPaneOpen && (
              <div className="hidden xl:flex w-80 lg:w-84 xl:w-96 flex-shrink-0 h-full border-l border-slate-200 flex-col">
                <GroupDetailsPane
                  user={user}
                  activeGroup={activeGroup}
                  memberBalances={memberBalances}
                  simplifiedDebts={simplifiedDebts}
                  totalGroupSpend={totalGroupSpend}
                  unaddedFriends={unaddedFriends}
                  onClose={() => setIsRightPaneOpen(false)}
                  onOpenAddMemberModal={(tab) => {
                    setAddMemberTab(tab || 'global_friends');
                    setIsAddMemberModalOpen(true);
                  }}
                  onQuickAddFriend={handleQuickAddFriendToGroup}
                  onRemoveMember={onRemoveGroupMember}
                  onDirectSettle={handleDirectSettle}
                />
              </div>
            )}
          </div>

          {/* Mobile/Tablet Slide-over for Group Details when toggled */}
          {activeGroup && isRightPaneOpen && (
            <div className="xl:hidden fixed inset-0 z-40 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
              <div className="w-full max-w-sm h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
                <GroupDetailsPane
                  user={user}
                  activeGroup={activeGroup}
                  memberBalances={memberBalances}
                  simplifiedDebts={simplifiedDebts}
                  totalGroupSpend={totalGroupSpend}
                  unaddedFriends={unaddedFriends}
                  onClose={() => setIsRightPaneOpen(false)}
                  onOpenAddMemberModal={(tab) => {
                    setAddMemberTab(tab || 'global_friends');
                    setIsAddMemberModalOpen(true);
                  }}
                  onQuickAddFriend={handleQuickAddFriendToGroup}
                  onRemoveMember={onRemoveGroupMember}
                  onDirectSettle={handleDirectSettle}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL 1: Add Group Expense with Advanced SplitEditor */}
      {isAddExpenseModalOpen && activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-xl font-black text-slate-900">Add Group Expense</h2>
                <p className="text-xs text-slate-600">
                  Group: <strong>{activeGroup.name}</strong> • Split equally, by exact amount, or percentages.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddExpenseModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4 mt-2">
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

              {/* Advanced Split Editor */}
              <SplitEditor
                members={activeGroup.members}
                totalAmount={totalAmountNum}
                currency={user.currency}
                splitMode={splitMode}
                selectedMemberIds={selectedMemberIds}
                exactShares={exactShares}
                percentageShares={percentageShares}
                onChangeSplitMode={setSplitMode}
                onSplitModeChange={setSplitMode}
                onToggleMember={toggleMemberSelection}
                onSelectAll={() => setSelectedMemberIds(activeGroup.members.map(m => m.id))}
                onDeselectAll={() => {
                  if (activeGroup.members.length > 0) {
                    setSelectedMemberIds([expPaidBy || activeGroup.members[0].id]);
                  }
                }}
                onSelectAllMembers={() => setSelectedMemberIds(activeGroup.members.map(m => m.id))}
                onDeselectAllMembers={() => {
                  if (activeGroup.members.length > 0) {
                    setSelectedMemberIds([expPaidBy || activeGroup.members[0].id]);
                  }
                }}
                onChangeExactShares={setExactShares}
                onExactShareChange={(memId, val) => {
                  setExactShares(prev => ({ ...prev, [memId]: val }));
                }}
                onChangePercentageShares={setPercentageShares}
                onPercentageShareChange={(memId, val) => {
                  setPercentageShares(prev => ({ ...prev, [memId]: val }));
                }}
              />

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
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={activeCount === 0 || !totalAmountNum}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm cursor-pointer"
                >
                  Save & Split Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Group with Global Friends picker */}
      {isCreateGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-xl font-black text-slate-900">Create New Group</h2>
                <p className="text-xs text-slate-600">Set up a group for a trip, house rent, or shared project.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateGroupModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewGroup} className="space-y-4 mt-2">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Category</label>
                  <select
                    value={newGroupCat}
                    onChange={(e) => setNewGroupCat(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  >
                    <option value="Trip">Trip</option>
                    <option value="Home">Home</option>
                    <option value="Project">Project</option>
                    <option value="Friends">Friends</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Group Color</label>
                  <div className="flex items-center gap-1.5 pt-1">
                    {['#0EA5E9', '#10B981', '#EC4899', '#8B5CF6', '#F59E0B', '#EF4444'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewGroupColor(c)}
                        className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${newGroupColor === c ? 'scale-125 ring-2 ring-slate-900' : 'hover:scale-110'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Initial Global Friends Selector */}
              {friends && friends.length > 0 && (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase text-slate-700">
                      Add Members from Friends ({selectedInitialFriendIds.length} selected)
                    </label>
                    {selectedInitialFriendIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedInitialFriendIds([])}
                        className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search friends by name..."
                      value={friendSearchCreate}
                      onChange={(e) => setFriendSearchCreate(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {friends
                      .filter(f => (f.name || '').toLowerCase().includes((friendSearchCreate || '').toLowerCase()) || (f.email && f.email.toLowerCase().includes((friendSearchCreate || '').toLowerCase())))
                      .map(friend => {
                        const isSelected = selectedInitialFriendIds.includes(friend.id);
                        return (
                          <div
                            key={friend.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedInitialFriendIds(selectedInitialFriendIds.filter(id => id !== friend.id));
                              } else {
                                setSelectedInitialFriendIds([...selectedInitialFriendIds, friend.id]);
                              }
                            }}
                            className={`p-2 rounded-xl flex items-center justify-between cursor-pointer border transition ${
                              isSelected
                                ? 'bg-blue-50 border-blue-300 text-blue-900'
                                : 'bg-white border-slate-100 hover:border-slate-200 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                style={{ backgroundColor: friend.avatarColor || '#3B82F6' }}
                              >
                                {friend.name.substring(0, 1).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-xs font-bold">{friend.name}</p>
                                {friend.email && <p className="text-[10px] text-slate-500">{friend.email}</p>}
                              </div>
                            </div>
                            <div className={`w-4 h-4 rounded flex items-center justify-center ${isSelected ? 'bg-blue-600 text-white' : 'border border-slate-300'}`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateGroupModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm cursor-pointer"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Group Member from Global Friends or Manual */}
      {isAddMemberModalOpen && activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-xl font-black text-slate-900">Add Member to Group</h2>
                <p className="text-xs text-slate-600">
                  Group: <strong>{activeGroup.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMemberModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab selector between Global Friends and Manual */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAddMemberTab('global_friends')}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  addMemberTab === 'global_friends'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users2 className="w-3.5 h-3.5" />
                <span>From Global Friends ({unaddedFriends.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setAddMemberTab('manual')}
                className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  addMemberTab === 'manual'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>New Person</span>
              </button>
            </div>

            {addMemberTab === 'global_friends' ? (
              <div className="space-y-4">
                {unaddedFriends.length > 0 ? (
                  <>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search global friends..."
                        value={friendSearchAdd}
                        onChange={(e) => setFriendSearchAdd(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                      {unaddedFriends
                        .filter(f => (f.name || '').toLowerCase().includes((friendSearchAdd || '').toLowerCase()) || (f.email && f.email.toLowerCase().includes((friendSearchAdd || '').toLowerCase())))
                        .map(friend => {
                          const isSelected = selectedFriendIdsToAdd.includes(friend.id);
                          return (
                            <div
                              key={friend.id}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedFriendIdsToAdd(selectedFriendIdsToAdd.filter(id => id !== friend.id));
                                } else {
                                  setSelectedFriendIdsToAdd([...selectedFriendIdsToAdd, friend.id]);
                                }
                              }}
                              className={`p-2.5 rounded-2xl flex items-center justify-between cursor-pointer border transition ${
                                isSelected
                                  ? 'bg-blue-50 border-blue-400 shadow-xs'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                  style={{ backgroundColor: friend.avatarColor || '#3B82F6' }}
                                >
                                  {friend.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-900">{friend.name}</p>
                                  <p className="text-[11px] text-slate-500">{friend.email || friend.phone || 'No email provided'}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickAddFriendToGroup(friend);
                                    setIsAddMemberModalOpen(false);
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-blue-600 text-slate-700 hover:text-white font-bold text-xs rounded-lg transition cursor-pointer"
                                >
                                  Add Now
                                </button>
                                <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs text-white ${isSelected ? 'bg-blue-600' : 'border border-slate-300'}`}>
                                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setIsAddMemberModalOpen(false)}
                        className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={selectedFriendIdsToAdd.length === 0}
                        onClick={handleBatchAddFriendsToGroup}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm cursor-pointer"
                      >
                        Add {selectedFriendIdsToAdd.length > 0 ? `(${selectedFriendIdsToAdd.length})` : ''} to Group
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 space-y-3">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                      <UserCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">All global friends are already in this group!</p>
                      <p className="text-xs text-slate-500 mt-1">You can add a new person or switch to manual entry.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddMemberTab('manual')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 cursor-pointer"
                    >
                      Enter New Friend Details
                    </button>
                  </div>
                )}
              </div>
            ) : (
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

                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="saveGlobalFriendCheck"
                    checked={saveToGlobalFriends}
                    onChange={(e) => setSaveToGlobalFriends(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <label htmlFor="saveGlobalFriendCheck" className="text-xs font-medium text-blue-950 cursor-pointer">
                    Also save to my <strong>Global Friends</strong> directory so I can reuse them in other groups.
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsAddMemberModalOpen(false)}
                    className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm cursor-pointer"
                  >
                    Add Member
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 4: Settle Group Debt */}
      {isSettleModalOpen && activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h2 className="text-xl font-black text-slate-900 mb-1">Record Group Settlement</h2>
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
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm cursor-pointer"
                >
                  Record Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Edit Group Expense with Advanced SplitEditor */}
      {editingTx && activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-xl font-black text-slate-900">Edit Group Expense</h2>
                <p className="text-xs text-slate-600">
                  Group: <strong>{activeGroup.name}</strong> • Adjust title, amount, payer, or split details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditExpense} className="space-y-4 mt-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Expense Title / Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scuba Diving, Dinner Bill, Villa Rental"
                  value={editExpTitle}
                  onChange={(e) => setEditExpTitle(e.target.value)}
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
                    value={editExpAmount}
                    onChange={(e) => setEditExpAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Expense Date</label>
                  <input
                    type="date"
                    value={editExpDate}
                    onChange={(e) => setEditExpDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Paid By</label>
                  <select
                    value={editExpPaidBy}
                    onChange={(e) => setEditExpPaidBy(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  >
                    {activeGroup.members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Debit From Account</label>
                  <select
                    value={editExpAccountId}
                    onChange={(e) => setEditExpAccountId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type === 'credit_card' ? `Credit Card • Due ${a.currency}${a.dueAmount}` : `Bank • Balance ${a.currency}${a.balance}`})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Advanced Split Editor for Edit Mode */}
              <SplitEditor
                members={activeGroup.members}
                totalAmount={editTotalAmountNum}
                currency={user.currency}
                splitMode={editSplitMode}
                selectedMemberIds={editSelectedMemberIds}
                exactShares={editExactShares}
                percentageShares={editPercentageShares}
                onChangeSplitMode={setEditSplitMode}
                onSplitModeChange={setEditSplitMode}
                onToggleMember={toggleEditMemberSelection}
                onSelectAll={() => setEditSelectedMemberIds(activeGroup.members.map(m => m.id))}
                onDeselectAll={() => {
                  if (activeGroup.members.length > 0) {
                    setEditSelectedMemberIds([editExpPaidBy || activeGroup.members[0].id]);
                  }
                }}
                onSelectAllMembers={() => setEditSelectedMemberIds(activeGroup.members.map(m => m.id))}
                onDeselectAllMembers={() => {
                  if (activeGroup.members.length > 0) {
                    setEditSelectedMemberIds([editExpPaidBy || activeGroup.members[0].id]);
                  }
                }}
                onChangeExactShares={setEditExactShares}
                onExactShareChange={(memId, val) => {
                  setEditExactShares(prev => ({ ...prev, [memId]: val }));
                }}
                onChangePercentageShares={setEditPercentageShares}
                onPercentageShareChange={(memId, val) => {
                  setEditPercentageShares(prev => ({ ...prev, [memId]: val }));
                }}
              />

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Notes / Description of edit</label>
                <input
                  type="text"
                  placeholder="e.g. Corrected final bill amount and excluded David"
                  value={editExpNotes}
                  onChange={(e) => setEditExpNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editActiveCount === 0 || !editTotalAmountNum}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
