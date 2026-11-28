import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  Account,
  AccountPermission,
  AccountType,
  Category,
  LoanEMI,
  Transaction,
  TransactionRule,
  UserProfile,
} from "../src/types";
import { findMatchingRule } from "../src/lib/ruleEngine";

export const SUPABASE_URL =
  process.env.SUPABASE_URL?.trim() ||
  process.env.VITE_SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  "https://kdjptkhfvzvsevzbcmik.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY?.trim() ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  "sb_publishable_U073qwpspSpADzBXfs55dA_h842lmUO";

export interface SupabaseAccessContext {
  userEmail: string;
  userToken?: string;
  useServiceRole?: boolean;
}

export class SupabaseServerConfigError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 503) {
    super(message);
    this.name = "SupabaseServerConfigError";
    this.statusCode = statusCode;
  }
}

export interface ServerAccountAccess {
  role: "owner" | "admin" | "edit" | "view" | "none";
  canView: boolean;
  canEdit: boolean;
  canArchive: boolean;
  canTransact: boolean;
}

export function getStrictAccountAccess(
  account: Account | null | undefined,
  userEmail: string
): ServerAccountAccess {
  const email = userEmail.trim().toLowerCase();
  if (!account || !email) {
    return { role: "none", canView: false, canEdit: false, canArchive: false, canTransact: false };
  }

  const ownerEmail = (account.ownerEmail || "").trim().toLowerCase();
  if (ownerEmail && ownerEmail === email) {
    return { role: "owner", canView: true, canEdit: true, canArchive: true, canTransact: true };
  }

  const shared = Array.isArray(account.sharedWith)
    ? account.sharedWith.find((p) => (p?.email || "").trim().toLowerCase() === email)
    : undefined;

  if (!shared) {
    return { role: "none", canView: false, canEdit: false, canArchive: false, canTransact: false };
  }

  if (shared.role === "admin") {
    return { role: "admin", canView: true, canEdit: true, canArchive: false, canTransact: true };
  }
  if (shared.role === "edit") {
    return { role: "edit", canView: true, canEdit: true, canArchive: false, canTransact: true };
  }
  return { role: "view", canView: true, canEdit: false, canArchive: false, canTransact: false };
}

export function createScopedSupabaseClient(ctx: SupabaseAccessContext): SupabaseClient {
  if (ctx.userToken) {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${ctx.userToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  if (ctx.useServiceRole) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceRoleKey) {
      throw new SupabaseServerConfigError(
        "SUPABASE_SERVICE_ROLE_KEY is not configured on the server for headless WhatsApp webhook database access.",
        503
      );
    }
    return createClient(SUPABASE_URL, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  throw new SupabaseServerConfigError(
    "Missing user session token or server service role credentials for Supabase access.",
    401
  );
}

export function tryCreateServiceRoleClient(): SupabaseClient | null {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) return null;
  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function mapAccountRow(row: any): Account {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    type: (row.type as AccountType) || "bank",
    balance: Number(row.balance) || 0,
    creditLimit: row.credit_limit !== null && row.credit_limit !== undefined ? Number(row.credit_limit) : undefined,
    dueAmount: row.due_amount !== null && row.due_amount !== undefined ? Number(row.due_amount) : undefined,
    dueDate: row.due_date || undefined,
    currency: row.currency || "₹",
    accountNumberLast4: row.account_number_last4 || undefined,
    bankName: row.bank_name || undefined,
    color: row.color || "#1E40AF",
    ownerEmail: String(row.owner_email || "").toLowerCase(),
    sharedWith: Array.isArray(row.shared_with) ? (row.shared_with as AccountPermission[]) : [],
    isArchived: Boolean(row.is_archived),
  };
}

function mapTransactionRow(row: any): Transaction {
  return {
    id: String(row.id),
    date: String(row.date),
    time: row.time || undefined,
    title: String(row.title || ""),
    amount: Number(row.amount) || 0,
    type: row.type,
    accountId: String(row.account_id || ""),
    toAccountId: row.to_account_id || undefined,
    categoryId: String(row.category_id || ""),
    notes: row.notes || undefined,
    emiId: row.emi_id || undefined,
    groupId: row.group_id || undefined,
    paidByMemberId: row.paid_by_member_id || undefined,
    splitDetails: Array.isArray(row.split_details) ? row.split_details : undefined,
    createdBy: String(row.created_by || "").toLowerCase(),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

function mapLoanRow(row: any): LoanEMI {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    lender: String(row.lender || ""),
    totalPrincipal: Number(row.total_principal) || 0,
    remainingPrincipal: Number(row.remaining_principal) || 0,
    interestRate: Number(row.interest_rate) || 0,
    monthlyEMI: Number(row.monthly_emi) || 0,
    totalTenureMonths: Number(row.total_tenure_months) || 12,
    paidTenureMonths: Number(row.paid_tenure_months) || 0,
    linkedAccountId: String(row.linked_account_id || ""),
    startDate: String(row.start_date || ""),
    nextDueDate: String(row.next_due_date || ""),
    category: String(row.category || "General"),
    notes: row.notes || undefined,
    status: row.status || "active",
    userEmail: String(row.user_email || row.owner_email || "").toLowerCase(),
    ownerEmail: String(row.owner_email || row.user_email || "").toLowerCase(),
  };
}

function mapCategoryRow(row: any): Category {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    icon: String(row.icon || "Tag"),
    color: String(row.color || "#3B82F6"),
    type: row.type || "expense",
    budgetLimit: row.budget_limit !== null && row.budget_limit !== undefined ? Number(row.budget_limit) : undefined,
    parentId: row.parent_id || undefined,
    userEmail: row.user_email ? String(row.user_email).toLowerCase() : undefined,
    isGlobal: Boolean(row.is_global),
  };
}

function mapRuleRow(row: any): TransactionRule {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    keyword: row.keyword || (Array.isArray(row.keywords) ? row.keywords.join(", ") : ""),
    matchType: row.match_type === "starts_with" || row.match_type === "exact" ? row.match_type : "contains",
    categoryId: String(row.category_id || ""),
    accountId: row.account_id || undefined,
    transactionType: row.transaction_type === "income" || row.transaction_type === "expense" ? row.transaction_type : undefined,
    isEnabled: Boolean(row.is_enabled ?? row.is_active ?? true),
    createdAt: String(row.created_at || new Date().toISOString()),
    matchCount: Number(row.match_count) || 0,
    userEmail: row.user_email ? String(row.user_email).toLowerCase() : undefined,
    isGlobal: Boolean(row.is_global),
  };
}

export async function getServerUserProfile(
  ctx: SupabaseAccessContext
): Promise<(UserProfile & { whatsappVerified?: boolean; whatsappPhone?: string; whatsappLinkedAt?: string }) | null> {
  const client = createScopedSupabaseClient(ctx);
  const email = ctx.userEmail.trim().toLowerCase();
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) return null;
  return {
    name: data.name || email.split("@")[0],
    email: data.email || email,
    currency: data.currency || "₹",
    avatarColor: data.avatar_color || "#3B82F6",
    avatarUrl: data.avatar_url || undefined,
    phone: data.phone || undefined,
    countryCode: data.country_code || undefined,
    monthlyBudget: data.monthly_budget !== null && data.monthly_budget !== undefined ? Number(data.monthly_budget) : 50000,
    whatsappVerified: Boolean(data.whatsapp_verified),
    whatsappPhone: data.whatsapp_phone || undefined,
    whatsappLinkedAt: data.whatsapp_linked_at || undefined,
  };
}

export async function syncProfileWhatsAppStatus(
  ctx: SupabaseAccessContext,
  input: {
    verified: boolean;
    phoneLocalOrFull?: string | null;
    countryCode?: string | null;
    whatsappDisplayPhone?: string | null;
  }
): Promise<boolean> {
  try {
    const client = createScopedSupabaseClient(ctx);
    const email = ctx.userEmail.trim().toLowerCase();
    const nowIso = new Date().toISOString();

    const basePatch: Record<string, unknown> = {
      updated_at: nowIso,
    };
    if (input.phoneLocalOrFull !== undefined) {
      basePatch.phone = input.phoneLocalOrFull;
    }
    if (input.countryCode !== undefined) {
      basePatch.country_code = input.countryCode;
    }

    const fullPatch: Record<string, unknown> = {
      ...basePatch,
      whatsapp_verified: input.verified,
      whatsapp_phone: input.verified ? input.whatsappDisplayPhone || null : null,
      whatsapp_linked_at: input.verified ? nowIso : null,
    };

    const { error } = await client.from("profiles").update(fullPatch).eq("email", email);
    if (!error) return true;

    // Fallback if optional migration columns aren't added yet on the user's Supabase project
    const { error: fallbackErr } = await client.from("profiles").update(basePatch).eq("email", email);
    return !fallbackErr;
  } catch {
    return false;
  }
}

export async function listUserAccounts(
  ctx: SupabaseAccessContext,
  options?: { includeArchived?: boolean }
): Promise<Array<Account & { access: ServerAccountAccess }>> {
  const client = createScopedSupabaseClient(ctx);
  const email = ctx.userEmail.trim().toLowerCase();

  let query = client.from("accounts").select("*").order("created_at", { ascending: true });
  if (!options?.includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch accounts from Supabase: ${error.message}`);
  }

  const results: Array<Account & { access: ServerAccountAccess }> = [];
  for (const row of data || []) {
    const mapped = mapAccountRow(row);
    const access = getStrictAccountAccess(mapped, email);
    if (access.canView) {
      results.push({ ...mapped, access });
    }
  }
  return results;
}

export type AccountResolutionResult =
  | { status: "resolved"; account: Account & { access: ServerAccountAccess }; fromContext: boolean }
  | { status: "ambiguous"; query: string; matches: Account[] }
  | { status: "not_found"; query: string; availableAccounts: Account[] }
  | { status: "missing"; availableAccounts: Account[] };

export function matchAccountQuery(
  accounts: Array<Account & { access: ServerAccountAccess }>,
  query?: string | null,
  activeContextAccountId?: string | null
): AccountResolutionResult {
  const cleanQuery = (query || "").trim();

  if (!cleanQuery) {
    if (activeContextAccountId) {
      const ctxAcc = accounts.find((a) => a.id === activeContextAccountId);
      if (ctxAcc) {
        return { status: "resolved", account: ctxAcc, fromContext: true };
      }
    }
    return { status: "missing", availableAccounts: accounts };
  }

  const q = cleanQuery
    .toLowerCase()
    .replace(/\b(account|a\/c|acc|my|the|in|from|via|on)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const normalizedQuery = q || cleanQuery.toLowerCase();

  // 1. Exact ID or exact name match
  const exactMatches = accounts.filter(
    (a) =>
      a.id.toLowerCase() === cleanQuery.toLowerCase() ||
      a.name.toLowerCase() === cleanQuery.toLowerCase() ||
      a.name.toLowerCase() === normalizedQuery
  );
  if (exactMatches.length === 1) {
    return { status: "resolved", account: exactMatches[0], fromContext: false };
  }
  if (exactMatches.length > 1) {
    return { status: "ambiguous", query: cleanQuery, matches: exactMatches };
  }

  // 2. Token-based scoring across name, bankName, type, last4
  const queryTokens = normalizedQuery
    .replace(/credit\s*card/g, "credit_card")
    .replace(/savings\s*account/g, "savings")
    .split(/\s+/)
    .filter(Boolean);

  const scored: Array<{ acc: Account & { access: ServerAccountAccess }; score: number }> = [];

  for (const acc of accounts) {
    const typeAliases =
      acc.type === "credit_card"
        ? "credit card credit_card card"
        : acc.type === "bank"
        ? "bank savings checking current"
        : acc.type === "cash"
        ? "cash wallet"
        : "investment demat mutual fund";
    const haystack = [acc.name, acc.bankName || "", typeAliases, acc.accountNumberLast4 || ""]
      .join(" ")
      .toLowerCase();

    if (queryTokens.length > 0 && queryTokens.every((t) => haystack.includes(t))) {
      let score = queryTokens.length * 10;
      if (acc.name.toLowerCase().includes(normalizedQuery)) score += 15;
      if ((acc.bankName || "").toLowerCase().includes(normalizedQuery)) score += 8;
      if (acc.accountNumberLast4 && normalizedQuery.includes(acc.accountNumberLast4.toLowerCase())) {
        score += 20;
      }
      scored.push({ acc, score });
    }
  }

  if (scored.length === 1) {
    return { status: "resolved", account: scored[0].acc, fromContext: false };
  }

  if (scored.length > 1) {
    scored.sort((a, b) => b.score - a.score);
    // If one candidate has a clear dominant exact-substring advantage on name and others don't, check tie
    const topScore = scored[0].score;
    const topGroup = scored.filter((s) => s.score === topScore);
    // Never silently guess if multiple accounts match the query bank/type (e.g., two HDFC accounts)!
    if (topGroup.length === 1 && scored[0].acc.name.toLowerCase() === normalizedQuery) {
      return { status: "resolved", account: scored[0].acc, fromContext: false };
    }
    return { status: "ambiguous", query: cleanQuery, matches: scored.map((s) => s.acc) };
  }

  return { status: "not_found", query: cleanQuery, availableAccounts: accounts };
}

export async function createUserAccount(
  ctx: SupabaseAccessContext,
  input: {
    name: string;
    type: AccountType;
    openingBalance: number;
    bankName?: string;
    creditLimit?: number;
    dueAmount?: number;
    dueDate?: string;
    accountNumberLast4?: string;
    currency?: string;
    color?: string;
  }
): Promise<{ created: boolean; duplicate?: Account; account?: Account; error?: string }> {
  const client = createScopedSupabaseClient(ctx);
  const email = ctx.userEmail.trim().toLowerCase();

  const existing = await listUserAccounts(ctx, { includeArchived: true });
  const normName = input.name.trim().toLowerCase();
  const duplicate = existing.find((a) => {
    if (a.name.trim().toLowerCase() === normName) return true;
    if (
      input.accountNumberLast4 &&
      a.accountNumberLast4 &&
      a.accountNumberLast4 === input.accountNumberLast4 &&
      (a.bankName || "").toLowerCase() === (input.bankName || "").toLowerCase() &&
      a.type === input.type
    ) {
      return true;
    }
    return false;
  });

  if (duplicate) {
    return {
      created: false,
      duplicate,
      error: `An account named "${duplicate.name}" already exists.`,
    };
  }

  const profile = await getServerUserProfile(ctx);
  const currency = input.currency || profile?.currency || "₹";
  const newId = `acc-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;
  const nowIso = new Date().toISOString();

  const payload = {
    id: newId,
    name: input.name.trim(),
    type: input.type,
    balance: input.type === "credit_card" ? 0 : Number(input.openingBalance) || 0,
    credit_limit: input.type === "credit_card" ? Number(input.creditLimit) || 0 : null,
    due_amount: input.type === "credit_card" ? Number(input.dueAmount ?? input.openingBalance) || 0 : null,
    due_date: input.type === "credit_card" ? input.dueDate || null : null,
    currency,
    account_number_last4: input.accountNumberLast4?.trim() || null,
    bank_name: input.bankName?.trim() || (input.type === "cash" ? "Cash" : null),
    color: input.color || (input.type === "credit_card" ? "#9333EA" : input.type === "cash" ? "#059669" : "#1E40AF"),
    owner_email: email,
    shared_with: [],
    is_archived: false,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data, error } = await client.from("accounts").insert(payload).select().single();
  if (error || !data) {
    return { created: false, error: error?.message || "Failed to create account in Supabase." };
  }

  return { created: true, account: mapAccountRow(data) };
}

export async function updateUserAccount(
  ctx: SupabaseAccessContext,
  accountId: string,
  patch: {
    name?: string;
    bankName?: string;
    type?: AccountType;
    creditLimit?: number;
    dueDate?: string;
    accountNumberLast4?: string;
    isArchived?: boolean;
  }
): Promise<{ updated: boolean; account?: Account; error?: string }> {
  const accounts = await listUserAccounts(ctx, { includeArchived: true });
  const target = accounts.find((a) => a.id === accountId);
  if (!target) {
    return { updated: false, error: "Account not found or access denied." };
  }
  if (!target.access.canEdit) {
    return { updated: false, error: `You only have "${target.access.role}" access on ${target.name}.` };
  }

  if (patch.name) {
    const dup = accounts.find(
      (a) => a.id !== accountId && a.name.trim().toLowerCase() === patch.name!.trim().toLowerCase()
    );
    if (dup) {
      return { updated: false, error: `Another account named "${dup.name}" already exists.` };
    }
  }

  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) dbPatch.name = patch.name.trim();
  if (patch.bankName !== undefined) dbPatch.bank_name = patch.bankName.trim() || null;
  if (patch.type !== undefined) dbPatch.type = patch.type;
  if (patch.creditLimit !== undefined) dbPatch.credit_limit = Number(patch.creditLimit) || 0;
  if (patch.dueDate !== undefined) dbPatch.due_date = patch.dueDate || null;
  if (patch.accountNumberLast4 !== undefined) dbPatch.account_number_last4 = patch.accountNumberLast4.trim() || null;
  if (patch.isArchived !== undefined) dbPatch.is_archived = Boolean(patch.isArchived);

  const client = createScopedSupabaseClient(ctx);
  const { data, error } = await client
    .from("accounts")
    .update(dbPatch)
    .eq("id", accountId)
    .select()
    .single();

  if (error || !data) {
    return { updated: false, error: error?.message || "Failed to update account." };
  }
  return { updated: true, account: mapAccountRow(data) };
}

export async function archiveUserAccount(
  ctx: SupabaseAccessContext,
  accountId: string
): Promise<{ archived: boolean; account?: Account; error?: string }> {
  const accounts = await listUserAccounts(ctx, { includeArchived: true });
  const target = accounts.find((a) => a.id === accountId);
  if (!target) {
    return { archived: false, error: "Account not found or access denied." };
  }
  if (!target.access.canArchive) {
    return {
      archived: false,
      error: "Only the account owner can archive/deactivate a financial account.",
    };
  }
  const res = await updateUserAccount(ctx, accountId, { isArchived: true });
  return { archived: res.updated, account: res.account, error: res.error };
}

export async function listUserCategories(ctx: SupabaseAccessContext): Promise<Category[]> {
  const client = createScopedSupabaseClient(ctx);
  const email = ctx.userEmail.trim().toLowerCase();
  const { data, error } = await client
    .from("categories")
    .select("*")
    .or(`user_email.eq.${email},is_global.eq.true,user_email.is.null`)
    .order("id", { ascending: true });

  if (error || !data) return [];
  const mapped = data.map(mapCategoryRow);
  const userOwned = mapped.filter((c) => c.userEmail === email);
  return userOwned.length > 0 ? userOwned : mapped;
}

export async function listUserRules(ctx: SupabaseAccessContext): Promise<TransactionRule[]> {
  const client = createScopedSupabaseClient(ctx);
  const email = ctx.userEmail.trim().toLowerCase();
  const { data, error } = await client
    .from("rules")
    .select("*")
    .or(`user_email.eq.${email},is_global.eq.true,user_email.is.null`)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  const mapped = data.map(mapRuleRow);
  const userOwned = mapped.filter((r) => r.userEmail === email);
  return userOwned.length > 0 ? userOwned : mapped;
}

export async function createUserTransaction(
  ctx: SupabaseAccessContext,
  input: {
    accountId: string;
    title: string;
    amount: number;
    type: "expense" | "income" | "transfer" | "emi_payment";
    categoryHint?: string;
    date?: string;
    time?: string;
    notes?: string;
    toAccountId?: string;
    emiId?: string;
  }
): Promise<{
  created: boolean;
  transaction?: Transaction;
  updatedAccount?: Account;
  matchedCategoryName?: string;
  matchedRuleName?: string;
  error?: string;
}> {
  const accounts = await listUserAccounts(ctx, { includeArchived: true });
  const sourceAccount = accounts.find((a) => a.id === input.accountId);
  if (!sourceAccount) {
    return { created: false, error: "Target account was not found or access denied." };
  }
  if (!sourceAccount.access.canTransact) {
    return {
      created: false,
      error: `You only have "${sourceAccount.access.role}" access on ${sourceAccount.name} and cannot add transactions.`,
    };
  }
  if (sourceAccount.isArchived) {
    return {
      created: false,
      error: `${sourceAccount.name} is archived. Unarchive it before adding transactions.`,
    };
  }

  let destAccount: (Account & { access: ServerAccountAccess }) | undefined;
  if (input.type === "transfer") {
    if (!input.toAccountId) {
      return { created: false, error: "Destination account is required for transfers." };
    }
    destAccount = accounts.find((a) => a.id === input.toAccountId);
    if (!destAccount || !destAccount.access.canTransact) {
      return { created: false, error: "Destination account not found or lacks transaction permission." };
    }
  }

  const amount = Math.round(Math.abs(Number(input.amount)) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { created: false, error: "Transaction amount must be a positive number." };
  }

  const [categories, rules] = await Promise.all([listUserCategories(ctx), listUserRules(ctx)]);
  const ruleMatch = findMatchingRule(input.title, rules);

  let matchedCategory: Category | undefined;
  if (input.categoryHint) {
    const hint = input.categoryHint.trim().toLowerCase();
    matchedCategory =
      categories.find((c) => c.name.toLowerCase() === hint) ||
      categories.find((c) => c.name.toLowerCase().includes(hint));
  }
  if (!matchedCategory && ruleMatch?.suggestedCategoryId) {
    matchedCategory = categories.find((c) => c.id === ruleMatch.suggestedCategoryId);
  }
  if (!matchedCategory) {
    matchedCategory =
      categories.find((c) =>
        input.type === "income" ? c.type === "income" : input.type === "emi_payment" ? c.id.includes("6") : c.type === "expense"
      ) || categories[0];
  }

  const client = createScopedSupabaseClient(ctx);
  const email = ctx.userEmail.trim().toLowerCase();
  const now = new Date();
  const nowIso = now.toISOString();
  const txDate = input.date || nowIso.split("T")[0];
  const txTime =
    input.time || now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  const txId = `tx-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;

  const txPayload = {
    id: txId,
    date: txDate,
    time: txTime,
    title: input.title.trim().slice(0, 140),
    amount,
    type: input.type,
    account_id: sourceAccount.id,
    to_account_id: destAccount?.id || null,
    category_id: matchedCategory?.id || null,
    notes: input.notes || "Logged via SpendWise WhatsApp Assistant",
    emi_id: input.emiId || null,
    group_id: null,
    paid_by_member_id: null,
    split_details: [],
    created_by: email,
    updated_at: nowIso,
  };

  const { data: insertedTx, error: txErr } = await client
    .from("transactions")
    .insert(txPayload)
    .select()
    .single();

  if (txErr || !insertedTx) {
    return { created: false, error: txErr?.message || "Failed to insert transaction in Supabase." };
  }

  // Atomically update source account balance/due_amount
  const sourcePatch: Record<string, unknown> = { updated_at: nowIso };
  if (sourceAccount.type === "credit_card") {
    const curDue = sourceAccount.dueAmount || 0;
    sourcePatch.due_amount =
      input.type === "income" ? Math.max(0, curDue - amount) : curDue + amount;
  } else {
    sourcePatch.balance =
      input.type === "income" ? sourceAccount.balance + amount : sourceAccount.balance - amount;
  }

  const { data: updatedSourceRow, error: accUpdateErr } = await client
    .from("accounts")
    .update(sourcePatch)
    .eq("id", sourceAccount.id)
    .select()
    .single();

  if (accUpdateErr) {
    return {
      created: true,
      transaction: mapTransactionRow(insertedTx),
      matchedCategoryName: matchedCategory?.name,
      matchedRuleName: ruleMatch?.rule.name,
      error: `Transaction saved, but account balance update failed: ${accUpdateErr.message}`,
    };
  }

  if (destAccount) {
    const destPatch: Record<string, unknown> = { updated_at: nowIso };
    if (destAccount.type === "credit_card") {
      destPatch.due_amount = Math.max(0, (destAccount.dueAmount || 0) - amount);
    } else {
      destPatch.balance = destAccount.balance + amount;
    }
    await client.from("accounts").update(destPatch).eq("id", destAccount.id);
  }

  if (input.emiId) {
    const { data: loanRow } = await client
      .from("loans")
      .select("remaining_principal, paid_tenure_months")
      .eq("id", input.emiId)
      .maybeSingle();
    if (loanRow) {
      await client
        .from("loans")
        .update({
          remaining_principal: Math.max(0, (Number(loanRow.remaining_principal) || 0) - amount),
          paid_tenure_months: (Number(loanRow.paid_tenure_months) || 0) + 1,
          updated_at: nowIso,
        })
        .eq("id", input.emiId);
    }
  }

  if (ruleMatch?.rule?.id && ruleMatch.rule.userEmail === email) {
    await client
      .from("rules")
      .update({
        match_count: (ruleMatch.rule.matchCount || 0) + 1,
        updated_at: nowIso,
      })
      .eq("id", ruleMatch.rule.id);
  }

  return {
    created: true,
    transaction: mapTransactionRow(insertedTx),
    updatedAccount: updatedSourceRow ? mapAccountRow(updatedSourceRow) : undefined,
    matchedCategoryName: matchedCategory?.name,
    matchedRuleName: ruleMatch?.rule.name,
  };
}

export async function listAccountTransactions(
  ctx: SupabaseAccessContext,
  filters: {
    accountId: string;
    startDate?: string;
    endDate?: string;
    type?: string;
    categoryName?: string;
    minAmount?: number;
    maxAmount?: number;
    searchText?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{
  transactions: Array<Transaction & { categoryName?: string }>;
  totalCount: number;
  currency: string;
}> {
  const accounts = await listUserAccounts(ctx, { includeArchived: true });
  const targetAccount = accounts.find((a) => a.id === filters.accountId);
  if (!targetAccount) {
    throw new Error("Account not found or access denied.");
  }

  const client = createScopedSupabaseClient(ctx);
  const categories = await listUserCategories(ctx);
  const categoryById = new Map(categories.map((c) => [c.id, c.name]));

  let query = client
    .from("transactions")
    .select("*")
    .or(`account_id.eq.${filters.accountId},to_account_id.eq.${filters.accountId}`)
    .order("date", { ascending: false })
    .order("updated_at", { ascending: false });

  if (filters.startDate) query = query.gte("date", filters.startDate);
  if (filters.endDate) query = query.lte("date", filters.endDate);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.minAmount !== undefined) query = query.gte("amount", filters.minAmount);
  if (filters.maxAmount !== undefined) query = query.lte("amount", filters.maxAmount);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }

  let rows = (data || []).map((row) => {
    const tx = mapTransactionRow(row);
    return {
      ...tx,
      categoryName: categoryById.get(tx.categoryId) || undefined,
    };
  });

  if (filters.categoryName) {
    const catQ = filters.categoryName.trim().toLowerCase();
    rows = rows.filter((t) => (t.categoryName || "").toLowerCase().includes(catQ));
  }

  if (filters.searchText) {
    const q = filters.searchText.trim().toLowerCase();
    rows = rows.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.notes || "").toLowerCase().includes(q) ||
        (t.categoryName || "").toLowerCase().includes(q)
    );
  }

  const totalCount = rows.length;
  const offset = Math.max(0, filters.offset || 0);
  const limit = Math.min(25, Math.max(1, filters.limit || 10));

  return {
    transactions: rows.slice(offset, offset + limit),
    totalCount,
    currency: targetAccount.currency || "₹",
  };
}

export function resolveDatePeriodRange(period?: string): {
  label: string;
  startDate: string;
  endDate: string;
  previousLabel: string;
  previousStartDate: string;
  previousEndDate: string;
} {
  const now = new Date();
  const toIso = (d: Date) => d.toISOString().split("T")[0];
  const p = (period || "this_month").toLowerCase().trim();

  if (p === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const prev = new Date(y);
    prev.setDate(prev.getDate() - 1);
    return {
      label: "Yesterday",
      startDate: toIso(y),
      endDate: toIso(y),
      previousLabel: "Day Before",
      previousStartDate: toIso(prev),
      previousEndDate: toIso(prev),
    };
  }

  if (p === "today") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return {
      label: "Today",
      startDate: toIso(now),
      endDate: toIso(now),
      previousLabel: "Yesterday",
      previousStartDate: toIso(y),
      previousEndDate: toIso(y),
    };
  }

  if (p === "this_week" || p === "week") {
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const start = new Date(now);
    start.setDate(now.getDate() - diffToMonday);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 7);
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    return {
      label: "This Week",
      startDate: toIso(start),
      endDate: toIso(now),
      previousLabel: "Last Week",
      previousStartDate: toIso(prevStart),
      previousEndDate: toIso(prevEnd),
    };
  }

  if (p === "last_month") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
    const prevEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 0));
    return {
      label: "Last Month",
      startDate: toIso(start),
      endDate: toIso(end),
      previousLabel: "Month Before Last",
      previousStartDate: toIso(prevStart),
      previousEndDate: toIso(prevEnd),
    };
  }

  // Default: this_month
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return {
    label: "This Month",
    startDate: toIso(start),
    endDate: toIso(now),
    previousLabel: "Last Month",
    previousStartDate: toIso(prevStart),
    previousEndDate: toIso(prevEnd),
  };
}

export async function getAccountAnalyticsSummary(
  ctx: SupabaseAccessContext,
  input: {
    accountId: string;
    period?: string;
    startDate?: string;
    endDate?: string;
    comparePrevious?: boolean;
  }
) {
  const accounts = await listUserAccounts(ctx, { includeArchived: true });
  const account = accounts.find((a) => a.id === input.accountId);
  if (!account) {
    throw new Error("Account not found or access denied.");
  }

  const range = resolveDatePeriodRange(input.period);
  const startDate = input.startDate || range.startDate;
  const endDate = input.endDate || range.endDate;
  const periodLabel = input.startDate && input.endDate ? `${startDate} to ${endDate}` : range.label;

  const { transactions } = await listAccountTransactions(ctx, {
    accountId: account.id,
    startDate,
    endDate,
    limit: 500,
    offset: 0,
  });

  const categories = await listUserCategories(ctx);
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryTotals = new Map<string, number>();
  let highestExpense: { title: string; amount: number; date: string } | null = null;
  let lowestExpense: { title: string; amount: number; date: string } | null = null;
  let expenseCount = 0;

  for (const tx of transactions) {
    if (tx.type === "income" || (tx.type === "transfer" && tx.toAccountId === account.id)) {
      totalIncome += tx.amount;
    } else if (
      tx.type === "expense" ||
      tx.type === "emi_payment" ||
      (tx.type === "transfer" && tx.accountId === account.id)
    ) {
      totalExpenses += tx.amount;
      expenseCount += 1;
      const catName = catMap.get(tx.categoryId) || "Uncategorized";
      categoryTotals.set(catName, (categoryTotals.get(catName) || 0) + tx.amount);
      if (!highestExpense || tx.amount > highestExpense.amount) {
        highestExpense = { title: tx.title, amount: tx.amount, date: tx.date };
      }
      if (!lowestExpense || tx.amount < lowestExpense.amount) {
        lowestExpense = { title: tx.title, amount: tx.amount, date: tx.date };
      }
    }
  }

  const categoryBreakdown = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  let comparison:
    | {
        previousLabel: string;
        previousExpenses: number;
        previousIncome: number;
        expenseDelta: number;
        expenseDeltaPercent: number | null;
      }
    | undefined;

  if (input.comparePrevious) {
    const prevRes = await listAccountTransactions(ctx, {
      accountId: account.id,
      startDate: range.previousStartDate,
      endDate: range.previousEndDate,
      limit: 500,
      offset: 0,
    });
    let prevExpenses = 0;
    let prevIncome = 0;
    for (const tx of prevRes.transactions) {
      if (tx.type === "income" || (tx.type === "transfer" && tx.toAccountId === account.id)) {
        prevIncome += tx.amount;
      } else {
        prevExpenses += tx.amount;
      }
    }
    const delta = Math.round((totalExpenses - prevExpenses) * 100) / 100;
    comparison = {
      previousLabel: range.previousLabel,
      previousExpenses: Math.round(prevExpenses * 100) / 100,
      previousIncome: Math.round(prevIncome * 100) / 100,
      expenseDelta: delta,
      expenseDeltaPercent:
        prevExpenses > 0 ? Math.round((delta / prevExpenses) * 1000) / 10 : null,
    };
  }

  return {
    account: {
      id: account.id,
      name: account.name,
      type: account.type,
      bankName: account.bankName,
      currency: account.currency,
      currentBalance: account.type === "credit_card" ? -(account.dueAmount || 0) : account.balance,
      dueAmount: account.dueAmount,
      creditLimit: account.creditLimit,
    },
    period: periodLabel,
    startDate,
    endDate,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netCashflow: Math.round((totalIncome - totalExpenses) * 100) / 100,
    transactionCount: transactions.length,
    expenseCount,
    averageExpense: expenseCount > 0 ? Math.round((totalExpenses / expenseCount) * 100) / 100 : 0,
    highestExpense,
    lowestExpense,
    categoryBreakdown,
    comparison,
  };
}

export async function getAccountLiabilitiesAndLoans(
  ctx: SupabaseAccessContext,
  accountId: string
) {
  const accounts = await listUserAccounts(ctx, { includeArchived: true });
  const account = accounts.find((a) => a.id === accountId);
  if (!account) {
    throw new Error("Account not found or access denied.");
  }

  const client = createScopedSupabaseClient(ctx);
  const email = ctx.userEmail.trim().toLowerCase();

  const { data: loansData } = await client
    .from("loans")
    .select("*")
    .or(`user_email.eq.${email},owner_email.eq.${email}`)
    .order("created_at", { ascending: true });

  const allUserLoans = (loansData || []).map(mapLoanRow);
  const linkedLoans = allUserLoans.filter((l) => l.linkedAccountId === account.id);

  const { transactions: emiPayments } = await listAccountTransactions(ctx, {
    accountId: account.id,
    type: "emi_payment",
    limit: 20,
    offset: 0,
  });

  const creditCardLiability =
    account.type === "credit_card"
      ? {
          outstandingDue: account.dueAmount || 0,
          creditLimit: account.creditLimit ?? null,
          availableCredit:
            account.creditLimit !== undefined
              ? Math.max(0, account.creditLimit - (account.dueAmount || 0))
              : null,
          dueDate: account.dueDate || null,
        }
      : null;

  const totalLoanRemaining = linkedLoans
    .filter((l) => l.status === "active")
    .reduce((sum, l) => sum + l.remainingPrincipal, 0);

  const totalMonthlyEmi = linkedLoans
    .filter((l) => l.status === "active")
    .reduce((sum, l) => sum + l.monthlyEMI, 0);

  return {
    account: {
      id: account.id,
      name: account.name,
      type: account.type,
      bankName: account.bankName,
      currency: account.currency,
      balance: account.balance,
    },
    creditCardLiability,
    linkedLoans,
    totalLoanRemaining: Math.round(totalLoanRemaining * 100) / 100,
    totalMonthlyEmi: Math.round(totalMonthlyEmi * 100) / 100,
    emiPaymentHistory: emiPayments,
  };
}
