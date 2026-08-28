export type AccountType = 'bank' | 'credit_card' | 'cash' | 'investment';

export interface AccountPermission {
  email: string;
  name?: string;
  role: 'view' | 'edit' | 'admin';
  addedAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number; // Current balance (for credit cards, this is usually 0 or negative/positive based on due)
  creditLimit?: number; // For credit cards
  dueAmount?: number; // For credit cards
  dueDate?: string; // For credit cards
  currency: string;
  accountNumberLast4?: string;
  bankName?: string;
  color: string;
  ownerEmail: string;
  sharedWith: AccountPermission[];
  isArchived?: boolean;
}

export interface SplitMemberShare {
  memberId: string;
  memberName: string;
  memberEmail: string;
  shareAmount: number;
  paidAmount: number;
  isSelected: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  title: string;
  amount: number;
  type: 'expense' | 'income' | 'transfer' | 'settlement' | 'emi_payment';
  accountId: string;
  toAccountId?: string; // For transfers
  categoryId: string;
  notes?: string;
  emiId?: string; // Linked Loan/EMI ID
  groupId?: string; // Linked Group ID
  paidByMemberId?: string;
  splitDetails?: SplitMemberShare[];
  createdBy: string;
  updatedAt: string;
}

export interface LoanEMI {
  id: string;
  name: string;
  lender: string;
  totalPrincipal: number;
  remainingPrincipal: number;
  interestRate: number; // in percentage e.g. 8.5
  monthlyEMI: number;
  totalTenureMonths: number;
  paidTenureMonths: number;
  linkedAccountId: string; // Account from which EMI is deducted
  startDate: string;
  nextDueDate: string;
  category: string;
  notes?: string;
  status: 'active' | 'completed' | 'foreclosed';
  userEmail: string; // Linked to the user profile
  ownerEmail?: string;
}

export interface GroupMember {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  role: 'admin' | 'member';
  joinedAt: string;
}

export type ActivityActionType = 
  | 'tx_added' 
  | 'tx_edited' 
  | 'tx_deleted' 
  | 'member_joined' 
  | 'member_left' 
  | 'settlement_made' 
  | 'group_created';

export interface GroupActivityLog {
  id: string;
  groupId: string;
  actionType: ActivityActionType;
  actorName: string;
  actorEmail: string;
  message: string;
  timestamp: string;
  details?: {
    txId?: string;
    txTitle?: string;
    amount?: number;
    currency?: string;
    targetMemberName?: string;
  };
}

export interface Group {
  id: string;
  name: string;
  description: string;
  category: 'Trip' | 'Home' | 'Project' | 'Friends' | 'Other';
  avatarColor: string;
  currency: string;
  createdBy: string;
  createdAt: string;
  members: GroupMember[];
}

export interface Friend {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarColor: string;
  netBalance: number; // positive: they owe me, negative: I owe them
  lastActivity: string;
  userEmail: string; // Linked to the user who added this friend
  ownerEmail?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
  budgetLimit?: number;
}

export interface UserProfile {
  name: string;
  email: string;
  currency: string;
  avatarColor: string;
  phone?: string;
  monthlyBudget?: number;
}

export interface SimplifiedDebt {
  fromMemberId: string;
  fromName: string;
  toMemberId: string;
  toName: string;
  amount: number;
}

export type RuleMatchType = 'contains' | 'starts_with' | 'exact';

export interface TransactionRule {
  id: string;
  name: string;
  keyword: string; // word or comma-separated words/phrases to match (e.g. "starbucks, cafe, coffee")
  matchType: RuleMatchType;
  categoryId: string; // Target category to assign
  accountId?: string; // Optional target payment account (e.g. Credit Card)
  transactionType?: 'expense' | 'income'; // Optional transaction type override
  isEnabled: boolean;
  createdAt: string;
  matchCount?: number;
}

export type DashboardCardId = 
  | 'kpi_metrics'
  | 'account_pills'
  | 'credit_card_dues'
  | 'loans_emi'
  | 'splitwise_groups'
  | 'friends_balances'
  | 'category_breakdown'
  | 'recent_transactions';

export interface DashboardCardConfig {
  id: DashboardCardId;
  name: string;
  description: string;
  category: 'overview' | 'accounts' | 'debt' | 'social' | 'activity';
  isEnabled: boolean;
  order: number;
}
