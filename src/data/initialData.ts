import { Account, Category, Friend, Group, GroupActivityLog, LoanEMI, Transaction, UserProfile } from '../types';

export const currentUser: UserProfile = {
  name: 'User',
  email: '',
  currency: '₹',
  avatarColor: '#3B82F6',
  monthlyBudget: 50000,
};

export const initialCategories: Category[] = [
  { id: 'cat-1', name: 'Food & Dining', icon: 'Utensils', color: '#F97316', type: 'expense' },
  { id: 'cat-2', name: 'Shopping & Electronics', icon: 'ShoppingBag', color: '#8B5CF6', type: 'expense' },
  { id: 'cat-3', name: 'Housing & Rent', icon: 'Home', color: '#EC4899', type: 'expense' },
  { id: 'cat-4', name: 'Transport & Fuel', icon: 'Car', color: '#06B6D4', type: 'expense' },
  { id: 'cat-5', name: 'Entertainment & Trips', icon: 'Film', color: '#EAB308', type: 'expense' },
  { id: 'cat-6', name: 'EMI & Loan Repayment', icon: 'CreditCard', color: '#EF4444', type: 'expense' },
  { id: 'cat-7', name: 'Utilities & Bills', icon: 'Zap', color: '#10B981', type: 'expense' },
  { id: 'cat-8', name: 'Salary & Invoicing', icon: 'Briefcase', color: '#22C55E', type: 'income' },
  { id: 'cat-9', name: 'Investments & Returns', icon: 'TrendingUp', color: '#6366F1', type: 'income' },
  { id: 'cat-10', name: 'Friend Settlement', icon: 'Users', color: '#64748B', type: 'expense' },
];

export const initialAccounts: Account[] = [];
export const initialLoans: LoanEMI[] = [];
export const initialGroups: Group[] = [];
export const initialGroupActivityLogs: GroupActivityLog[] = [];
export const initialFriends: Friend[] = [];
export const initialTransactions: Transaction[] = [];
