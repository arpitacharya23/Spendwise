import { TransactionRule } from '../types';

export const initialRules: TransactionRule[] = [
  {
    id: 'rule-1',
    name: 'Coffee & Cafes',
    keyword: 'starbucks, cafe, coffee, barista, dunkin, costa, blue tokai, third wave',
    matchType: 'contains',
    categoryId: 'cat-1', // Food & Dining
    transactionType: 'expense',
    isEnabled: true,
    createdAt: '2026-01-01',
    matchCount: 14,
  },
  {
    id: 'rule-2',
    name: 'Rideshare & Taxis',
    keyword: 'uber, ola, lyft, grab, cab, taxi, rapido',
    matchType: 'contains',
    categoryId: 'cat-4', // Transport & Fuel
    transactionType: 'expense',
    isEnabled: true,
    createdAt: '2026-01-02',
    matchCount: 22,
  },
  {
    id: 'rule-3',
    name: 'Food Delivery & Restaurants',
    keyword: 'swiggy, zomato, doordash, mcdonalds, dominos, pizza, burger, dining, restaurant, subway',
    matchType: 'contains',
    categoryId: 'cat-1', // Food & Dining
    transactionType: 'expense',
    isEnabled: true,
    createdAt: '2026-01-03',
    matchCount: 31,
  },
  {
    id: 'rule-4',
    name: 'Online Shopping',
    keyword: 'amazon, flipkart, myntra, zara, ebay, ajio, meesho, target, walmart',
    matchType: 'contains',
    categoryId: 'cat-2', // Shopping & Electronics
    accountId: 'acc-2', // Default to Credit Card
    transactionType: 'expense',
    isEnabled: true,
    createdAt: '2026-01-05',
    matchCount: 18,
  },
  {
    id: 'rule-5',
    name: 'Entertainment & Streaming',
    keyword: 'netflix, spotify, prime video, hotstar, youtube, cinema, pvr, inox, movies, steam, playstation',
    matchType: 'contains',
    categoryId: 'cat-5', // Entertainment & Trips
    transactionType: 'expense',
    isEnabled: true,
    createdAt: '2026-01-06',
    matchCount: 9,
  },
  {
    id: 'rule-6',
    name: 'Groceries & Daily Essentials',
    keyword: 'grocery, blinkit, zepto, instamart, supermarket, bigbasket, nature basket, costco, traders joe',
    matchType: 'contains',
    categoryId: 'cat-1', // Food & Dining
    transactionType: 'expense',
    isEnabled: true,
    createdAt: '2026-01-08',
    matchCount: 12,
  },
  {
    id: 'rule-7',
    name: 'Fuel & Gas Stations',
    keyword: 'shell, petrol, diesel, fuel, chevron, bp, exxon, gas station, indian oil, hpcl, bharat petroleum',
    matchType: 'contains',
    categoryId: 'cat-4', // Transport & Fuel
    transactionType: 'expense',
    isEnabled: true,
    createdAt: '2026-01-10',
    matchCount: 7,
  },
  {
    id: 'rule-8',
    name: 'Salary & Earnings',
    keyword: 'salary, payroll, stipend, client payment, consulting fee, freelance payout, dividend',
    matchType: 'contains',
    categoryId: 'cat-8', // Salary & Invoicing
    transactionType: 'income',
    isEnabled: true,
    createdAt: '2026-01-12',
    matchCount: 4,
  },
  {
    id: 'rule-9',
    name: 'Housing & Rent',
    keyword: 'rent, maintenance, landlord, apartment, society dues',
    matchType: 'contains',
    categoryId: 'cat-3', // Housing & Rent
    transactionType: 'expense',
    isEnabled: true,
    createdAt: '2026-01-15',
    matchCount: 3,
  },
  {
    id: 'rule-10',
    name: 'Utilities & Bills',
    keyword: 'electricity, water bill, wifi, broadband, airtel, jio, verizon, at&t, gas bill',
    matchType: 'contains',
    categoryId: 'cat-7', // Utilities & Bills
    transactionType: 'expense',
    isEnabled: true,
    createdAt: '2026-01-18',
    matchCount: 8,
  },
];
