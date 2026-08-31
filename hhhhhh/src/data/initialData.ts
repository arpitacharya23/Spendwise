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
  { id: 'cat-1-1', name: 'Groceries & Provisions', icon: 'ShoppingBag', color: '#F97316', parentId: 'cat-1', budgetLimit: 6000 },
  { id: 'cat-1-2', name: 'Restaurants & Dining Out', icon: 'Coffee', color: '#FB923C', parentId: 'cat-1', budgetLimit: 4000 },
  { id: 'cat-1-3', name: 'Online Food Delivery', icon: 'Utensils', color: '#EA580C', parentId: 'cat-1', budgetLimit: 2000 },

  { id: 'cat-2', name: 'Shopping & Electronics', icon: 'ShoppingBag', color: '#8B5CF6', budgetLimit: 8000 },
  { id: 'cat-2-1', name: 'Clothing & Footwear', icon: 'Shirt', color: '#8B5CF6', parentId: 'cat-2' },
  { id: 'cat-2-2', name: 'Electronics & Gadgets', icon: 'Smartphone', color: '#A855F7', parentId: 'cat-2' },

  { id: 'cat-3', name: 'Housing & Rent', icon: 'Home', color: '#EC4899', budgetLimit: 20000 },
  { id: 'cat-3-1', name: 'Rent & Lease', icon: 'Home', color: '#EC4899', parentId: 'cat-3' },
  { id: 'cat-3-2', name: 'Home Maintenance & Repair', icon: 'Wrench', color: '#F43F5E', parentId: 'cat-3' },

  { id: 'cat-4', name: 'Transport & Fuel', icon: 'Car', color: '#06B6D4', budgetLimit: 5000 },
  { id: 'cat-4-1', name: 'Fuel & Petrol', icon: 'Fuel', color: '#06B6D4', parentId: 'cat-4' },
  { id: 'cat-4-2', name: 'Cab & Auto (Uber/Ola)', icon: 'Car', color: '#0891B2', parentId: 'cat-4' },
  { id: 'cat-4-3', name: 'Public Transit & Metro', icon: 'Bus', color: '#0EA5E9', parentId: 'cat-4' },

  { id: 'cat-5', name: 'Entertainment & Trips', icon: 'Film', color: '#EAB308', budgetLimit: 4000 },
  { id: 'cat-5-1', name: 'Movies & Concerts', icon: 'Film', color: '#EAB308', parentId: 'cat-5' },
  { id: 'cat-5-2', name: 'Subscriptions & OTT', icon: 'Tv', color: '#F59E0B', parentId: 'cat-5' },

  { id: 'cat-6', name: 'EMI & Loan Repayment', icon: 'CreditCard', color: '#EF4444' },
  { id: 'cat-7', name: 'Utilities & Bills', icon: 'Zap', color: '#10B981', budgetLimit: 6000 },
  { id: 'cat-7-1', name: 'Electricity & Water', icon: 'Zap', color: '#10B981', parentId: 'cat-7' },
  { id: 'cat-7-2', name: 'WiFi & Mobile Phone', icon: 'Wifi', color: '#059669', parentId: 'cat-7' },

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
