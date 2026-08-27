import { supabase } from './supabase';
import { 
  Account, 
  Category, 
  Friend, 
  Group, 
  GroupActivityLog, 
  LoanEMI, 
  Transaction, 
  UserProfile 
} from '../types';

export interface SupabaseHealthStatus {
  connected: boolean;
  tableStatuses: Record<string, { exists: boolean; count: number; error?: string }>;
  lastChecked: string;
}

// -----------------------------------------------------------------------------
// Health & Schema Checker
// -----------------------------------------------------------------------------
export async function checkSupabaseHealth(): Promise<SupabaseHealthStatus> {
  const tables = [
    'profiles',
    'categories',
    'accounts',
    'loans',
    'groups',
    'group_activity_logs',
    'friends',
    'transactions'
  ];

  const tableStatuses: Record<string, { exists: boolean; count: number; error?: string }> = {};
  let anySuccess = false;

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        tableStatuses[table] = { exists: false, count: 0, error: error.message };
      } else {
        tableStatuses[table] = { exists: true, count: count ?? 0 };
        anySuccess = true;
      }
    } catch (err: any) {
      tableStatuses[table] = { exists: false, count: 0, error: err?.message || 'Network error' };
    }
  }

  return {
    connected: anySuccess,
    tableStatuses,
    lastChecked: new Date().toLocaleTimeString(),
  };
}

// -----------------------------------------------------------------------------
// PROFILES
// -----------------------------------------------------------------------------
export async function getSupabaseProfile(email: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !data) return null;

    return {
      name: data.name,
      email: data.email,
      currency: data.currency || '₹',
      avatarColor: data.avatar_color || '#3B82F6',
      monthlyBudget: data.monthly_budget ? Number(data.monthly_budget) : 50000,
    };
  } catch {
    return null;
  }
}

export async function saveSupabaseProfile(profile: UserProfile, customId?: string): Promise<boolean> {
  try {
    const idToUse = customId || profile.email;
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: idToUse,
        name: profile.name,
        email: profile.email,
        currency: profile.currency,
        avatar_color: profile.avatarColor,
        monthly_budget: profile.monthlyBudget,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });

    if (error) {
      console.warn('saveSupabaseProfile upsert notice:', error.message);
      // Fallback attempt without specifying onConflict
      const { error: err2 } = await supabase
        .from('profiles')
        .upsert({
          id: idToUse,
          name: profile.name,
          email: profile.email,
          currency: profile.currency,
          avatar_color: profile.avatarColor,
          monthly_budget: profile.monthlyBudget,
          updated_at: new Date().toISOString(),
        });
      return !err2;
    }
    return true;
  } catch (err) {
    console.error('saveSupabaseProfile exception:', err);
    return false;
  }
}

// -----------------------------------------------------------------------------
// CATEGORIES
// -----------------------------------------------------------------------------
export async function getSupabaseCategories(): Promise<Category[] | null> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('id', { ascending: true });

    if (error || !data || data.length === 0) return null;

    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      icon: item.icon,
      color: item.color,
      type: item.type,
      budgetLimit: item.budget_limit ? Number(item.budget_limit) : undefined,
    }));
  } catch {
    return null;
  }
}

export async function saveSupabaseCategory(category: Category): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('categories')
      .upsert({
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        type: category.type,
        budget_limit: category.budgetLimit ?? null,
      });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteSupabaseCategory(categoryId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);
    return !error;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// ACCOUNTS
// -----------------------------------------------------------------------------
export async function getSupabaseAccounts(): Promise<Account[] | null> {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !data) return null;

    return data.map((acc: any) => ({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      balance: Number(acc.balance) || 0,
      creditLimit: acc.credit_limit ? Number(acc.credit_limit) : undefined,
      dueAmount: acc.due_amount ? Number(acc.due_amount) : undefined,
      dueDate: acc.due_date || undefined,
      currency: acc.currency || '₹',
      accountNumberLast4: acc.account_number_last4 || undefined,
      bankName: acc.bank_name || undefined,
      color: acc.color || '#1E40AF',
      ownerEmail: acc.owner_email,
      sharedWith: Array.isArray(acc.shared_with) ? acc.shared_with : [],
      isArchived: acc.is_archived || false,
    }));
  } catch {
    return null;
  }
}

export async function saveSupabaseAccount(account: Account): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('accounts')
      .upsert({
        id: account.id,
        name: account.name,
        type: account.type,
        balance: account.balance,
        credit_limit: account.creditLimit ?? null,
        due_amount: account.dueAmount ?? null,
        due_date: account.dueDate ?? null,
        currency: account.currency,
        account_number_last4: account.accountNumberLast4 ?? null,
        bank_name: account.bankName ?? null,
        color: account.color,
        owner_email: account.ownerEmail,
        shared_with: account.sharedWith || [],
        is_archived: account.isArchived || false,
        updated_at: new Date().toISOString(),
      });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteSupabaseAccount(accountId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', accountId);
    return !error;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// TRANSACTIONS
// -----------------------------------------------------------------------------
export async function getSupabaseTransactions(): Promise<Transaction[] | null> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    if (error || !data) return null;

    return data.map((t: any) => ({
      id: t.id,
      date: t.date,
      title: t.title,
      amount: Number(t.amount) || 0,
      type: t.type,
      accountId: t.account_id,
      toAccountId: t.to_account_id || undefined,
      categoryId: t.category_id,
      notes: t.notes || undefined,
      emiId: t.emi_id || undefined,
      groupId: t.group_id || undefined,
      paidByMemberId: t.paid_by_member_id || undefined,
      splitDetails: Array.isArray(t.split_details) ? t.split_details : undefined,
      createdBy: t.created_by,
      updatedAt: t.updated_at || new Date().toISOString(),
    }));
  } catch {
    return null;
  }
}

export async function saveSupabaseTransaction(transaction: Transaction): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('transactions')
      .upsert({
        id: transaction.id,
        date: transaction.date,
        title: transaction.title,
        amount: transaction.amount,
        type: transaction.type,
        account_id: transaction.accountId,
        to_account_id: transaction.toAccountId ?? null,
        category_id: transaction.categoryId,
        notes: transaction.notes ?? null,
        emi_id: transaction.emiId ?? null,
        group_id: transaction.groupId ?? null,
        paid_by_member_id: transaction.paidByMemberId ?? null,
        split_details: transaction.splitDetails ?? [],
        created_by: transaction.createdBy,
        updated_at: transaction.updatedAt || new Date().toISOString(),
      });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteSupabaseTransaction(transactionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId);
    return !error;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// LOANS & EMI
// -----------------------------------------------------------------------------
export async function getSupabaseLoans(): Promise<LoanEMI[] | null> {
  try {
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !data) return null;

    return data.map((l: any) => ({
      id: l.id,
      name: l.name,
      lender: l.lender,
      totalPrincipal: Number(l.total_principal) || 0,
      remainingPrincipal: Number(l.remaining_principal) || 0,
      interestRate: Number(l.interest_rate) || 0,
      monthlyEMI: Number(l.monthly_emi) || 0,
      totalTenureMonths: Number(l.total_tenure_months) || 12,
      paidTenureMonths: Number(l.paid_tenure_months) || 0,
      linkedAccountId: l.linked_account_id || '',
      startDate: l.start_date,
      nextDueDate: l.next_due_date,
      category: l.category || 'General',
      notes: l.notes || undefined,
      status: l.status || 'active',
    }));
  } catch {
    return null;
  }
}

export async function saveSupabaseLoan(loan: LoanEMI): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('loans')
      .upsert({
        id: loan.id,
        name: loan.name,
        lender: loan.lender,
        total_principal: loan.totalPrincipal,
        remaining_principal: loan.remainingPrincipal,
        interest_rate: loan.interestRate,
        monthly_emi: loan.monthlyEMI,
        total_tenure_months: loan.totalTenureMonths,
        paid_tenure_months: loan.paidTenureMonths,
        linked_account_id: loan.linkedAccountId || null,
        start_date: loan.startDate,
        next_due_date: loan.nextDueDate,
        category: loan.category,
        notes: loan.notes ?? null,
        status: loan.status,
        updated_at: new Date().toISOString(),
      });
    return !error;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// GROUPS & ACTIVITY LOGS
// -----------------------------------------------------------------------------
export async function getSupabaseGroups(): Promise<Group[] | null> {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return null;

    return data.map((g: any) => ({
      id: g.id,
      name: g.name,
      description: g.description || '',
      category: g.category || 'Trip',
      avatarColor: g.avatar_color || '#0EA5E9',
      currency: g.currency || '₹',
      createdBy: g.created_by,
      createdAt: g.created_at,
      members: Array.isArray(g.members) ? g.members : [],
    }));
  } catch {
    return null;
  }
}

export async function saveSupabaseGroup(group: Group): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('groups')
      .upsert({
        id: group.id,
        name: group.name,
        description: group.description,
        category: group.category,
        avatar_color: group.avatarColor,
        currency: group.currency,
        created_by: group.createdBy,
        created_at: group.createdAt,
        members: group.members || [],
        updated_at: new Date().toISOString(),
      });
    return !error;
  } catch {
    return false;
  }
}

export async function getSupabaseActivityLogs(): Promise<GroupActivityLog[] | null> {
  try {
    const { data, error } = await supabase
      .from('group_activity_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error || !data) return null;

    return data.map((log: any) => ({
      id: log.id,
      groupId: log.group_id,
      actionType: log.action_type,
      actorName: log.actor_name,
      actorEmail: log.actor_email || '',
      message: log.message,
      timestamp: log.timestamp,
      details: log.details || undefined,
    }));
  } catch {
    return null;
  }
}

export async function saveSupabaseActivityLog(log: GroupActivityLog): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('group_activity_logs')
      .upsert({
        id: log.id,
        group_id: log.groupId,
        action_type: log.actionType,
        actor_name: log.actorName,
        actor_email: log.actorEmail,
        message: log.message,
        timestamp: log.timestamp,
        details: log.details || {},
      });
    return !error;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// FRIENDS
// -----------------------------------------------------------------------------
export async function getSupabaseFriends(): Promise<Friend[] | null> {
  try {
    const { data, error } = await supabase
      .from('friends')
      .select('*')
      .order('name', { ascending: true });

    if (error || !data) return null;

    return data.map((f: any) => ({
      id: f.id,
      name: f.name,
      email: f.email || '',
      phone: f.phone || undefined,
      avatarColor: f.avatar_color || '#10B981',
      netBalance: Number(f.net_balance) || 0,
      lastActivity: f.last_activity || new Date().toISOString().split('T')[0],
    }));
  } catch {
    return null;
  }
}

export async function saveSupabaseFriend(friend: Friend): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('friends')
      .upsert({
        id: friend.id,
        name: friend.name,
        email: friend.email,
        phone: friend.phone ?? null,
        avatar_color: friend.avatarColor,
        net_balance: friend.netBalance,
        last_activity: friend.lastActivity,
      });
    return !error;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// SEED DEFAULT DEMO DATA TO SUPABASE
// -----------------------------------------------------------------------------
export async function seedSupabaseInitialData(user: UserProfile): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Profile
    await saveSupabaseProfile(user);

    // 2. Sample Bank & Credit Card accounts
    const sampleAccounts: Account[] = [
      {
        id: 'acc-hdfc-01',
        name: 'HDFC Salary Account',
        type: 'bank',
        balance: 78500,
        currency: user.currency,
        bankName: 'HDFC Bank',
        accountNumberLast4: '4829',
        color: '#1E40AF',
        ownerEmail: user.email,
        sharedWith: [],
      },
      {
        id: 'acc-icici-card',
        name: 'ICICI Sapphiro Credit Card',
        type: 'credit_card',
        balance: 0,
        creditLimit: 300000,
        dueAmount: 18450,
        dueDate: '2026-09-15',
        currency: user.currency,
        bankName: 'ICICI Bank',
        accountNumberLast4: '9102',
        color: '#9333EA',
        ownerEmail: user.email,
        sharedWith: [],
      },
      {
        id: 'acc-cash',
        name: 'Physical Cash Wallet',
        type: 'cash',
        balance: 6200,
        currency: user.currency,
        color: '#059669',
        ownerEmail: user.email,
        sharedWith: [],
      }
    ];

    for (const acc of sampleAccounts) {
      await saveSupabaseAccount(acc);
    }

    // 3. Sample Loan
    const sampleLoan: LoanEMI = {
      id: 'emi-macbook',
      name: 'Apple MacBook Pro M3 EMI',
      lender: 'HDFC Consumer Finance',
      totalPrincipal: 150000,
      remainingPrincipal: 90000,
      interestRate: 0,
      monthlyEMI: 15000,
      totalTenureMonths: 10,
      paidTenureMonths: 4,
      linkedAccountId: 'acc-hdfc-01',
      startDate: '2026-04-05',
      nextDueDate: '2026-09-05',
      category: 'Electronics',
      status: 'active',
    };
    await saveSupabaseLoan(sampleLoan);

    // 4. Sample Group
    const sampleGroup: Group = {
      id: 'grp-goa-2026',
      name: 'Goa Weekend Getaway 🏖️',
      description: 'Trip to South Goa with college buddies',
      category: 'Trip',
      avatarColor: '#0EA5E9',
      currency: user.currency,
      createdBy: user.email,
      createdAt: '2026-08-01',
      members: [
        { id: 'mem-1', name: user.name, email: user.email, avatarColor: user.avatarColor, role: 'admin', joinedAt: '2026-08-01' },
        { id: 'mem-2', name: 'Rohan Sharma', email: 'rohan@example.com', avatarColor: '#10B981', role: 'member', joinedAt: '2026-08-01' },
        { id: 'mem-3', name: 'Pooja Verma', email: 'pooja@example.com', avatarColor: '#EC4899', role: 'member', joinedAt: '2026-08-01' },
        { id: 'mem-4', name: 'Kabir Mehta', email: 'kabir@example.com', avatarColor: '#F59E0B', role: 'member', joinedAt: '2026-08-01' }
      ]
    };
    await saveSupabaseGroup(sampleGroup);

    // 5. Sample Friends
    const sampleFriends: Friend[] = [
      { id: 'fr-1', name: 'Rohan Sharma', email: 'rohan@example.com', avatarColor: '#10B981', netBalance: 2400, lastActivity: '2026-08-20' },
      { id: 'fr-2', name: 'Pooja Verma', email: 'pooja@example.com', avatarColor: '#EC4899', netBalance: -1200, lastActivity: '2026-08-18' },
      { id: 'fr-3', name: 'Kabir Mehta', email: 'kabir@example.com', avatarColor: '#F59E0B', netBalance: 0, lastActivity: '2026-08-15' }
    ];
    for (const fr of sampleFriends) {
      await saveSupabaseFriend(fr);
    }

    // 6. Sample Transactions
    const today = new Date().toISOString().split('T')[0];
    const sampleTransactions: Transaction[] = [
      {
        id: 'tx-seed-1',
        date: today,
        title: 'Monthly Salary Credit',
        amount: 110000,
        type: 'income',
        accountId: 'acc-hdfc-01',
        categoryId: 'cat-8',
        createdBy: user.email,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tx-seed-2',
        date: today,
        title: 'Organic Groceries & Supplies',
        amount: 3450,
        type: 'expense',
        accountId: 'acc-icici-card',
        categoryId: 'cat-1',
        createdBy: user.email,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tx-seed-3',
        date: today,
        title: 'MacBook Pro EMI Installment',
        amount: 15000,
        type: 'emi_payment',
        accountId: 'acc-hdfc-01',
        categoryId: 'cat-6',
        emiId: 'emi-macbook',
        createdBy: user.email,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tx-seed-4',
        date: today,
        title: 'Villa Booking Deposit',
        amount: 12000,
        type: 'expense',
        accountId: 'acc-hdfc-01',
        categoryId: 'cat-5',
        groupId: 'grp-goa-2026',
        paidByMemberId: 'mem-1',
        createdBy: user.email,
        updatedAt: new Date().toISOString(),
      }
    ];

    for (const tx of sampleTransactions) {
      await saveSupabaseTransaction(tx);
    }

    return { success: true, message: 'Default demo data successfully seeded to Supabase!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error seeding database' };
  }
}
