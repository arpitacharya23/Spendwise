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
    'transactions',
    'rules',
    'budgets'
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
export interface FoundUserResult {
  name: string;
  email: string;
  avatarColor?: string;
  phone?: string;
  countryCode?: string;
  isRegistered: boolean;
}

export function isPhoneExactMatch(p1?: string | null, p2?: string | null): boolean {
  if (!p1 || !p2) return false;
  const n1 = p1.replace(/\D/g, '');
  const n2 = p2.replace(/\D/g, '');
  if (!n1 || !n2) return false;
  // If digits are exactly equal
  if (n1 === n2) return true;
  // If standard 10-digit phone number matches exactly (e.g., +91 9876543210 vs 9876543210)
  if (n1.length >= 10 && n2.length >= 10 && n1.slice(-10) === n2.slice(-10)) {
    return true;
  }
  return false;
}

export async function findUserByEmail(email: string): Promise<FoundUserResult | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('name, email, avatar_color, phone, country_code')
      .ilike('email', normalized)
      .maybeSingle();

    if (!error && data && data.name && (data.email || '').toLowerCase() === normalized) {
      return {
        name: data.name,
        email: data.email || normalized,
        avatarColor: data.avatar_color || '#3B82F6',
        phone: data.phone || undefined,
        countryCode: data.country_code || undefined,
        isRegistered: true,
      };
    }

    // Secondary fallback: check if id is stored as email
    const { data: dataById, error: errById } = await supabase
      .from('profiles')
      .select('name, email, avatar_color, phone, country_code')
      .ilike('id', normalized)
      .maybeSingle();

    if (!errById && dataById && dataById.name && ((dataById.email || '').toLowerCase() === normalized || (dataById as any).id?.toLowerCase() === normalized)) {
      return {
        name: dataById.name,
        email: dataById.email || normalized,
        avatarColor: dataById.avatar_color || '#3B82F6',
        phone: dataById.phone || undefined,
        countryCode: dataById.country_code || undefined,
        isRegistered: true,
      };
    }
  } catch (err) {
    console.warn('findUserByEmail lookup note:', err);
  }

  return null;
}

export async function findUserByPhone(phoneQuery: string): Promise<FoundUserResult | null> {
  const rawClean = phoneQuery.trim();
  const digitsOnly = rawClean.replace(/\D/g, '');
  // Exact phone match requires a complete 10-digit number
  if (!digitsOnly || digitsOnly.length < 10) return null;

  const last10 = digitsOnly.slice(-10);

  try {
    // 1. Try exact match on raw phone string
    const { data: exactMatch, error: exactErr } = await supabase
      .from('profiles')
      .select('name, email, avatar_color, phone, country_code')
      .eq('phone', rawClean)
      .maybeSingle();

    if (!exactErr && exactMatch && exactMatch.name && isPhoneExactMatch(exactMatch.phone, rawClean)) {
      return {
        name: exactMatch.name,
        email: exactMatch.email,
        avatarColor: exactMatch.avatar_color || '#3B82F6',
        phone: exactMatch.phone || undefined,
        countryCode: exactMatch.country_code || undefined,
        isRegistered: true,
      };
    }

    // 2. Fetch candidates matching the exact 10-digit suffix and verify exact match
    const { data: list, error: listErr } = await supabase
      .from('profiles')
      .select('name, email, avatar_color, phone, country_code')
      .ilike('phone', `%${last10}%`)
      .limit(10);

    if (!listErr && list && list.length > 0) {
      // Strictly find the exact match (no partial/substring matches)
      const matched = list.find(item => isPhoneExactMatch(item.phone, rawClean));

      if (matched && matched.name) {
        return {
          name: matched.name,
          email: matched.email,
          avatarColor: matched.avatar_color || '#3B82F6',
          phone: matched.phone || undefined,
          countryCode: matched.country_code || undefined,
          isRegistered: true,
        };
      }
    }
  } catch (err) {
    console.warn('findUserByPhone lookup note:', err);
  }

  return null;
}

export async function findUserByEmailOrPhone(query: string): Promise<FoundUserResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    return findUserByEmail(trimmed);
  }

  const digitsCount = (trimmed.match(/\d/g) || []).length;
  if (digitsCount >= 10) {
    return findUserByPhone(trimmed);
  }

  return null;
}

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
      avatarUrl: data.avatar_url || null,
      phone: data.phone || undefined,
      countryCode: data.country_code || undefined,
      monthlyBudget: data.monthly_budget ? Number(data.monthly_budget) : 50000,
    };
  } catch {
    return null;
  }
}

export async function saveSupabaseProfile(
  profile: UserProfile,
  customId?: string
): Promise<boolean> {
  try {
    console.log("========== saveSupabaseProfile ==========");
    console.log("Incoming profile:", profile);

    const idToUse = customId || profile.email;

    const profilePayload = {
      id: idToUse,
      name: profile.name,
      email: profile.email,
      currency: profile.currency,
      avatar_color: profile.avatarColor,
      avatar_url: profile.avatarUrl ?? null,
      phone: profile.phone ?? null,
      country_code: profile.countryCode ?? "+91",
      monthly_budget: profile.monthlyBudget,
      updated_at: new Date().toISOString(),
    };

    console.log("Payload being sent to Supabase:");
    console.table(profilePayload);

    const { data, error } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "email" })
      .select();

    console.log("Upsert response:");
    console.log("Data:", data);
    console.log("Error:", error);

    if (!error) {
      console.log("✅ Upsert successful");
      return true;
    }

    console.warn("⚠️ Upsert failed:", error);

    console.log("Looking for existing profile...");

    const { data: existingRow, error: lookupError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", profile.email)
      .maybeSingle();

    console.log("Existing row:", existingRow);
    console.log("Lookup error:", lookupError);

    if (lookupError) {
      console.error("❌ Lookup failed:", lookupError);
      return false;
    }

    if (existingRow) {
      console.log("Updating existing row...");

      const { data: updateData, error: updateError } = await supabase
        .from("profiles")
        .update(profilePayload)
        .eq("email", profile.email)
        .select();

      console.log("Update result:", updateData);
      console.log("Update error:", updateError);

      return !updateError;
    }

    console.log("Inserting new row...");

    const { data: insertData, error: insertError } = await supabase
      .from("profiles")
      .insert(profilePayload)
      .select();

    console.log("Insert result:", insertData);
    console.log("Insert error:", insertError);

    return !insertError;
  } catch (err) {
    console.error("❌ Exception inside saveSupabaseProfile:", err);
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
        type: category.type ?? null,
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
// -----------------------------------------------------------------------------
// ACCOUNTS
// -----------------------------------------------------------------------------
export async function getSupabaseAccounts(userEmail?: string): Promise<Account[] | null> {
  try {
    const query = supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true });

    const { data, error } = await query;

    if (error || !data) return null;

    let filteredData = data;
    if (userEmail) {
      const normalizedEmail = userEmail.trim().toLowerCase();
      filteredData = data.filter((acc: any) => {
        const ownerMatch = (acc.owner_email || '').trim().toLowerCase() === normalizedEmail;
        const sharedMatch = Array.isArray(acc.shared_with) && acc.shared_with.some((p: any) => (p?.email || '').trim().toLowerCase() === normalizedEmail);
        return ownerMatch || sharedMatch;
      });
    }

    return filteredData.map((acc: any) => ({
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
      ownerEmail: acc.owner_email || userEmail || '',
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
export async function getSupabaseTransactions(userEmail?: string, accessibleAccountIds?: string[]): Promise<Transaction[] | null> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    if (error || !data) return null;

    let filteredData = data;
    if (userEmail) {
      const normalizedEmail = userEmail.trim().toLowerCase();
      const accessibleSet = new Set<string>(accessibleAccountIds || []);

      // If accessibleAccountIds was not provided, lookup all accounts owned by or shared with this user
      if (!accessibleAccountIds || accessibleAccountIds.length === 0) {
        try {
          const { data: accountsData } = await supabase.from('accounts').select('id, owner_email, shared_with');
          if (accountsData) {
            accountsData.forEach((acc: any) => {
              const isOwner = (acc.owner_email || '').trim().toLowerCase() === normalizedEmail;
              const isShared = Array.isArray(acc.shared_with) && acc.shared_with.some(
                (p: any) => (p?.email || '').trim().toLowerCase() === normalizedEmail
              );
              if (isOwner || isShared) {
                accessibleSet.add(acc.id);
              }
            });
          }
        } catch {
          // ignore lookup error and fallback
        }
      }

      filteredData = data.filter((t: any) => {
        const creatorMatch = (t.created_by || '').trim().toLowerCase() === normalizedEmail;
        const accountMatch = (t.account_id && accessibleSet.has(t.account_id)) || (t.to_account_id && accessibleSet.has(t.to_account_id));
        const splitMatch = Array.isArray(t.split_details) && t.split_details.some((s: any) => (s?.memberEmail || '').trim().toLowerCase() === normalizedEmail);
        return creatorMatch || accountMatch || splitMatch;
      });
    }

    return filteredData.map((t: any) => ({
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
      createdBy: t.created_by || userEmail || '',
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
export async function getSupabaseLoans(userEmail?: string): Promise<LoanEMI[] | null> {
  try {
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !data) return null;

    let filteredData = data;
    if (userEmail) {
      const normalizedEmail = userEmail.trim().toLowerCase();
      filteredData = data.filter((l: any) => {
        const email = (l.user_email || l.owner_email || '').trim().toLowerCase();
        return !email || email === normalizedEmail;
      });
    }

    return filteredData.map((l: any) => ({
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
      userEmail: l.user_email || l.owner_email || userEmail || '',
      ownerEmail: l.owner_email || l.user_email || userEmail || '',
    }));
  } catch {
    return null;
  }
}

export async function saveSupabaseLoan(loan: LoanEMI): Promise<boolean> {
  try {
    const userEmailToSave = loan.userEmail || loan.ownerEmail || '';
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
        user_email: userEmailToSave,
        owner_email: userEmailToSave,
        updated_at: new Date().toISOString(),
      });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteSupabaseLoan(loanId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('loans')
      .delete()
      .eq('id', loanId);
    return !error;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// GROUPS & ACTIVITY LOGS
// -----------------------------------------------------------------------------
export async function getSupabaseGroups(userEmail?: string): Promise<Group[] | null> {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return null;

    let filteredData = data;
    if (userEmail) {
      const normalizedEmail = userEmail.trim().toLowerCase();
      filteredData = data.filter((g: any) => {
        const creatorMatch = (g.created_by || '').trim().toLowerCase() === normalizedEmail;
        const memberMatch = Array.isArray(g.members) && g.members.some((m: any) => (m?.email || '').trim().toLowerCase() === normalizedEmail);
        return creatorMatch || memberMatch;
      });
    }

    return filteredData.map((g: any) => ({
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

export async function deleteSupabaseGroup(groupId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);
    return !error;
  } catch {
    return false;
  }
}

export async function getSupabaseActivityLogs(userGroupIds?: string[]): Promise<GroupActivityLog[] | null> {
  try {
    let query = supabase
      .from('group_activity_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (userGroupIds && userGroupIds.length > 0) {
      query = query.in('group_id', userGroupIds);
    }

    const { data, error } = await query;

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
// FRIENDS (Bidirectional Sync)
// -----------------------------------------------------------------------------
export async function getSupabaseFriends(userEmail?: string): Promise<Friend[] | null> {
  try {
    const { data: allFriends, error } = await supabase
      .from('friends')
      .select('*')
      .order('name', { ascending: true });

    if (error || !allFriends) return null;

    if (!userEmail) {
      return allFriends.map((f: any) => ({
        id: f.id,
        name: f.name,
        email: f.email || '',
        phone: f.phone || undefined,
        avatarColor: f.avatar_color || '#10B981',
        netBalance: Number(f.net_balance) || 0,
        lastActivity: f.last_activity || new Date().toISOString().split('T')[0],
        userEmail: f.user_email || f.owner_email || '',
        ownerEmail: f.owner_email || f.user_email || '',
      }));
    }

    const normalizedEmail = userEmail.trim().toLowerCase();
    const resultFriendsMap = new Map<string, Friend>();

    // 1. Direct friends added by this user
    const directRows = allFriends.filter((f: any) => {
      const email = (f.user_email || f.owner_email || '').trim().toLowerCase();
      return email === normalizedEmail;
    });

    for (const f of directRows) {
      const frEmail = (f.email || '').trim().toLowerCase();
      if (!frEmail) continue;
      resultFriendsMap.set(frEmail, {
        id: f.id,
        name: f.name,
        email: f.email || '',
        phone: f.phone || undefined,
        avatarColor: f.avatar_color || '#10B981',
        netBalance: Number(f.net_balance) || 0,
        lastActivity: f.last_activity || new Date().toISOString().split('T')[0],
        userEmail: normalizedEmail,
        ownerEmail: normalizedEmail,
      });
    }

    // 2. Inbound friends (other registered users who added this user)
    const inboundRows = allFriends.filter((f: any) => {
      const targetEmail = (f.email || '').trim().toLowerCase();
      const creatorEmail = (f.user_email || f.owner_email || '').trim().toLowerCase();
      return targetEmail === normalizedEmail && creatorEmail !== normalizedEmail && creatorEmail.length > 0;
    });

    if (inboundRows.length > 0) {
      // Fetch profiles of creator users who added this user to get their authentic names and avatar colors
      const creatorEmails = Array.from(new Set(inboundRows.map((r: any) => (r.user_email || r.owner_email || '').trim().toLowerCase())));
      let profileMap = new Map<string, { name: string; avatarColor: string; phone?: string }>();
      
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('email, name, avatar_color, phone');
        if (profiles) {
          for (const p of profiles) {
            if (p.email) {
              profileMap.set(p.email.trim().toLowerCase(), {
                name: p.name,
                avatarColor: p.avatar_color || '#3B82F6',
                phone: p.phone || undefined,
              });
            }
          }
        }
      } catch (err) {
        console.warn('Profile batch fetch warning:', err);
      }

      for (const inRow of inboundRows) {
        const creatorEmail = (inRow.user_email || inRow.owner_email || '').trim().toLowerCase();
        if (!creatorEmail) continue;

        // If not already in result map, synthesize reciprocal friend
        if (!resultFriendsMap.has(creatorEmail)) {
          const profile = profileMap.get(creatorEmail);
          const reciprocalName = profile?.name || inferNameFromEmailFallback(creatorEmail);
          const reciprocalAvatar = profile?.avatarColor || '#3B82F6';
          const reciprocalNetBalance = - (Number(inRow.net_balance) || 0);
          const reciprocalId = `fr-recip-${normalizedEmail.replace(/[^a-z0-9]/g, '_')}_${creatorEmail.replace(/[^a-z0-9]/g, '_')}`;

          const reciprocalFriend: Friend = {
            id: reciprocalId,
            name: reciprocalName,
            email: creatorEmail,
            phone: profile?.phone || undefined,
            avatarColor: reciprocalAvatar,
            netBalance: reciprocalNetBalance,
            lastActivity: inRow.last_activity || new Date().toISOString().split('T')[0],
            userEmail: normalizedEmail,
            ownerEmail: normalizedEmail,
          };

          resultFriendsMap.set(creatorEmail, reciprocalFriend);

          // Asynchronously persist reciprocal record in database
          supabase
            .from('friends')
            .upsert({
              id: reciprocalId,
              name: reciprocalName,
              email: creatorEmail,
              phone: profile?.phone ?? null,
              avatar_color: reciprocalAvatar,
              net_balance: reciprocalNetBalance,
              last_activity: reciprocalFriend.lastActivity,
              user_email: normalizedEmail,
              owner_email: normalizedEmail,
            })
            .then(({ error }) => {
              if (error) console.warn('Reciprocal friend upsert note:', error.message);
            });
        }
      }
    }

    return Array.from(resultFriendsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('getSupabaseFriends error:', err);
    return null;
  }
}

function inferNameFromEmailFallback(email: string): string {
  if (!email || typeof email !== 'string') return 'Friend';
  const username = email.split('@')[0] || 'Friend';
  const cleaned = username.replace(/[0-9_.-]+$/g, '').replace(/^[0-9_.-]+/g, '');
  const parts = (cleaned || username).split(/[._\-+]+/).filter(Boolean);
  if (parts.length === 0) return 'Friend';
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

export async function saveSupabaseFriend(friend: Friend, currentUser?: Partial<UserProfile>): Promise<boolean> {
  try {
    const userEmailToSave = (friend.userEmail || friend.ownerEmail || currentUser?.email || '').trim().toLowerCase();
    const targetFriendEmail = (friend.email || '').trim().toLowerCase();

    // 1. Save primary friend record for userEmailToSave
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
        user_email: userEmailToSave,
        owner_email: userEmailToSave,
      });

    if (error) {
      console.warn('saveSupabaseFriend primary error:', error);
      return false;
    }

    // 2. Bidirectional / Reciprocal Sync:
    // If target friend has a valid email different from current user, create/update reciprocal record on their account
    if (targetFriendEmail && userEmailToSave && targetFriendEmail !== userEmailToSave) {
      try {
        const reciprocalId = `fr-recip-${targetFriendEmail.replace(/[^a-z0-9]/g, '_')}_${userEmailToSave.replace(/[^a-z0-9]/g, '_')}`;
        
        let creatorName = currentUser?.name;
        let creatorAvatar = currentUser?.avatarColor || '#3B82F6';
        let creatorPhone = currentUser?.phone;

        // If creator details are missing, look up profile from DB
        if (!creatorName) {
          const { data: creatorProfile } = await supabase
            .from('profiles')
            .select('name, avatar_color, phone')
            .ilike('email', userEmailToSave)
            .maybeSingle();

          if (creatorProfile && creatorProfile.name) {
            creatorName = creatorProfile.name;
            creatorAvatar = creatorProfile.avatar_color || creatorAvatar;
            creatorPhone = creatorProfile.phone || creatorPhone;
          }
        }

        const finalCreatorName = creatorName || inferNameFromEmailFallback(userEmailToSave);
        const reciprocalNetBalance = - (Number(friend.netBalance) || 0);

        await supabase
          .from('friends')
          .upsert({
            id: reciprocalId,
            name: finalCreatorName,
            email: userEmailToSave,
            phone: creatorPhone ?? null,
            avatar_color: creatorAvatar,
            net_balance: reciprocalNetBalance,
            last_activity: friend.lastActivity || new Date().toISOString().split('T')[0],
            user_email: targetFriendEmail,
            owner_email: targetFriendEmail,
          });
      } catch (recipErr) {
        console.warn('Reciprocal friend sync warning:', recipErr);
      }
    }

    return true;
  } catch (err) {
    console.error('saveSupabaseFriend unexpected error:', err);
    return false;
  }
}

export async function deleteSupabaseFriend(
  friendId: string,
  userEmail?: string,
  friendEmail?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('friends')
      .delete()
      .eq('id', friendId);

    // Also clean up reverse reciprocal record if emails are provided
    if (userEmail && friendEmail) {
      const normUser = userEmail.trim().toLowerCase();
      const normFriend = friendEmail.trim().toLowerCase();
      const reciprocalId = `fr-recip-${normFriend.replace(/[^a-z0-9]/g, '_')}_${normUser.replace(/[^a-z0-9]/g, '_')}`;
      
      await supabase
        .from('friends')
        .delete()
        .eq('id', reciprocalId);
    }

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
      userEmail: user.email,
      ownerEmail: user.email,
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
      { id: 'fr-1', name: 'Rohan Sharma', email: 'rohan@example.com', avatarColor: '#10B981', netBalance: 2400, lastActivity: '2026-08-20', userEmail: user.email, ownerEmail: user.email },
      { id: 'fr-2', name: 'Pooja Verma', email: 'pooja@example.com', avatarColor: '#EC4899', netBalance: -1200, lastActivity: '2026-08-18', userEmail: user.email, ownerEmail: user.email },
      { id: 'fr-3', name: 'Kabir Mehta', email: 'kabir@example.com', avatarColor: '#F59E0B', netBalance: 0, lastActivity: '2026-08-15', userEmail: user.email, ownerEmail: user.email }
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
