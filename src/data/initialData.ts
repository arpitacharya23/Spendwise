import { Account, Category, Friend, Group, GroupActivityLog, LoanEMI, Transaction, UserProfile } from '../types';

export const currentUser: UserProfile = {
  name: 'User',
  email: '',
  currency: '₹',
  avatarColor: '#3B82F6',
  monthlyBudget: 50000,
};

export const initialCategories: Category[] = [
  { id: 'cat-1', name: 'Food & Dining', icon: 'Utensils', color: '#F97316', budgetLimit: 12000 },
  { id: 'cat-2', name: 'Shopping & Electronics', icon: 'ShoppingBag', color: '#8B5CF6', budgetLimit: 8000 },
  { id: 'cat-3', name: 'Housing & Rent', icon: 'Home', color: '#EC4899', budgetLimit: 20000 },
  { id: 'cat-4', name: 'Transport & Fuel', icon: 'Car', color: '#06B6D4', budgetLimit: 5000 },
  { id: 'cat-5', name: 'Entertainment & Trips', icon: 'Film', color: '#EAB308', budgetLimit: 4000 },
  { id: 'cat-6', name: 'EMI & Loan Repayment', icon: 'CreditCard', color: '#EF4444' },
  { id: 'cat-7', name: 'Utilities & Bills', icon: 'Zap', color: '#10B981', budgetLimit: 6000 },
  { id: 'cat-8', name: 'Salary & Invoicing', icon: 'Briefcase', color: '#22C55E' },
  { id: 'cat-9', name: 'Investments & Returns', icon: 'TrendingUp', color: '#6366F1' },
  { id: 'cat-10', name: 'Friend Settlement', icon: 'Users', color: '#64748B' },
];

export const initialAccounts: Account[] = [];
export const initialLoans: LoanEMI[] = [];
export const initialGroups: Group[] = [];
export const initialGroupActivityLogs: GroupActivityLog[] = [];
export const initialFriends: Friend[] = [];
export const initialTransactions: Transaction[] = [];
