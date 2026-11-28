import fs from "node:fs";
import path from "node:path";
import { Content, FunctionDeclaration, GoogleGenAI, Part, Type } from "@google/genai";
import { Account, AccountType } from "../src/types";
import { findMatchingRule } from "../src/lib/ruleEngine";
import {
  archiveUserAccount,
  createScopedSupabaseClient,
  createUserAccount,
  createUserTransaction,
  getAccountAnalyticsSummary,
  getAccountLiabilitiesAndLoans,
  getServerUserProfile,
  listAccountTransactions,
  listUserAccounts,
  listUserCategories,
  listUserRules,
  matchAccountQuery,
  SupabaseAccessContext,
  updateUserAccount,
} from "./spendwiseSupabase";

export type PendingMutationConfirmation =
  | {
      kind: "create_account";
      summary: string;
      createdAt: string;
      payload: {
        name: string;
        type: AccountType;
        openingBalance: number;
        bankName?: string;
        creditLimit?: number;
        dueAmount?: number;
        dueDate?: string;
        accountNumberLast4?: string;
        currency?: string;
      };
    }
  | {
      kind: "update_account";
      summary: string;
      createdAt: string;
      payload: {
        accountId: string;
        accountName: string;
        patch: {
          name?: string;
          bankName?: string;
          type?: AccountType;
          creditLimit?: number;
          dueDate?: string;
          accountNumberLast4?: string;
          isArchived?: boolean;
        };
      };
    }
  | {
      kind: "archive_account";
      summary: string;
      createdAt: string;
      payload: {
        accountId: string;
        accountName: string;
      };
    }
  | {
      kind: "create_transaction";
      summary: string;
      createdAt: string;
      payload: {
        accountId: string;
        accountName: string;
        title: string;
        amount: number;
        type: "expense" | "income" | "transfer" | "emi_payment";
        categoryHint?: string;
        date?: string;
        notes?: string;
        toAccountId?: string;
        toAccountName?: string;
        emiId?: string;
      };
    };

export interface PendingPortfolioScope {
  accountIds: string[];
  accountNames: string[];
  period?: string;
  createdAt: string;
}

export interface WhatsAppConversationSession {
  id: string;
  userEmail: string;
  phoneDigits: string;
  activeAccountId?: string;
  activeAccountName?: string;
  pendingConfirmation?: PendingMutationConfirmation | null;
  pendingPortfolioScope?: PendingPortfolioScope | null;
  history: Array<{ role: "user" | "model"; text: string }>;
  updatedAt: string;
  expiresAt: string;
}

const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_HISTORY_TURNS = 12;
const SESSIONS_FILE_PATH =
  process.env.KAPSO_SESSIONS_FILE?.trim() ||
  path.join("/tmp", "spendwise-kapso-whatsapp-sessions.json");

const sessionsByKey = new Map<string, WhatsAppConversationSession>();

function sessionKey(userEmail: string, phoneDigits: string): string {
  return `${userEmail.trim().toLowerCase()}::${phoneDigits.replace(/[^\d]/g, "")}`;
}

function loadSessions() {
  try {
    if (!fs.existsSync(SESSIONS_FILE_PATH)) return;
    const raw = fs.readFileSync(SESSIONS_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as WhatsAppConversationSession[];
    if (!Array.isArray(parsed)) return;
    const now = Date.now();
    for (const s of parsed) {
      if (s?.id && s?.expiresAt && new Date(s.expiresAt).getTime() > now) {
        sessionsByKey.set(s.id, s);
      }
    }
  } catch {
    // Non-fatal
  }
}

function persistSessions() {
  try {
    fs.writeFileSync(
      SESSIONS_FILE_PATH,
      JSON.stringify(Array.from(sessionsByKey.values())),
      { encoding: "utf8", mode: 0o600 }
    );
  } catch {
    // Non-fatal
  }
}

loadSessions();

export function getOrCreateConversationSession(
  userEmail: string,
  phoneDigits: string
): WhatsAppConversationSession {
  const key = sessionKey(userEmail, phoneDigits);
  const existing = sessionsByKey.get(key);
  const now = Date.now();

  if (existing && new Date(existing.expiresAt).getTime() > now) {
    return existing;
  }

  const fresh: WhatsAppConversationSession = {
    id: key,
    userEmail: userEmail.trim().toLowerCase(),
    phoneDigits: phoneDigits.replace(/[^\d]/g, ""),
    history: [],
    pendingConfirmation: null,
    pendingPortfolioScope: null,
    updatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  };
  sessionsByKey.set(key, fresh);
  persistSessions();
  return fresh;
}

export function clearConversationSessionsForUser(userEmail: string) {
  const email = userEmail.trim().toLowerCase();
  for (const [k, s] of sessionsByKey.entries()) {
    if (s.userEmail === email) {
      sessionsByKey.delete(k);
    }
  }
  persistSessions();
}

function saveConversationSession(
  session: WhatsAppConversationSession,
  ctx?: SupabaseAccessContext
) {
  const now = Date.now();
  session.updatedAt = new Date(now).toISOString();
  session.expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
  if (session.history.length > MAX_HISTORY_TURNS) {
    session.history = session.history.slice(-MAX_HISTORY_TURNS);
  }
  sessionsByKey.set(session.id, session);
  persistSessions();

  if (ctx) {
    try {
      const client = createScopedSupabaseClient(ctx);
      void client.from("whatsapp_conversations").upsert({
        id: session.id,
        user_email: session.userEmail,
        phone_digits: session.phoneDigits,
        active_account_id: session.activeAccountId || null,
        active_account_name: session.activeAccountName || null,
        pending_confirmation: session.pendingConfirmation || null,
        pending_portfolio_scope: session.pendingPortfolioScope || null,
        history: session.history,
        expires_at: session.expiresAt,
        updated_at: session.updatedAt,
      });
    } catch {
      // Non-fatal
    }
  }
}

export function formatMoney(amount: number, currency = "₹"): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return `${amount < 0 ? "-" : ""}${currency}${formatted}`;
}

export function isExplicitConfirmText(text: string): boolean {
  const clean = text.trim().replace(/[.!]+$/, "").trim();
  return /^(?:yes|y|confirm|confirmed|yes please|go ahead|proceed)$/i.test(clean);
}

export function isExplicitCancelText(text: string): boolean {
  const clean = text.trim().replace(/[.!]+$/, "").trim();
  return /^(?:no|n|cancel|stop|abort|never\s?mind)$/i.test(clean);
}

function accountTypeLabel(type: AccountType): string {
  if (type === "credit_card") return "Credit Card";
  if (type === "cash") return "Cash Wallet";
  if (type === "investment") return "Investment";
  return "Bank / Savings";
}

function serializeAccountFields(acc: Account) {
  const base: Record<string, unknown> = {
    id: acc.id,
    name: acc.name,
    bankName: acc.bankName || null,
    type: acc.type,
    typeLabel: accountTypeLabel(acc.type),
    currency: acc.currency || "₹",
    status: acc.isArchived ? "Archived" : "Active",
    isArchived: Boolean(acc.isArchived),
  };

  if (acc.type === "credit_card") {
    base.dueAmount = acc.dueAmount || 0;
    base.creditLimit = acc.creditLimit ?? null;
    base.availableCredit =
      acc.creditLimit !== undefined ? Math.max(0, acc.creditLimit - (acc.dueAmount || 0)) : null;
    base.dueDate = acc.dueDate || null;
  } else {
    base.currentBalance = acc.balance;
  }
  if (acc.accountNumberLast4) {
    base.accountNumberLast4 = acc.accountNumberLast4;
  }
  return base;
}

function normalizeAccountTypeInput(raw?: string | null): AccountType | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (/(credit|card)/.test(s)) return "credit_card";
  if (/(cash|wallet)/.test(s)) return "cash";
  if (/(invest|demat|mutual|stock|fd)/.test(s)) return "investment";
  if (/(bank|saving|savings|current|checking|salary)/.test(s)) return "bank";
  return null;
}

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_accounts",
    description:
      "List the user's SpendWise accounts (names, types, banks, active/archived status) ONLY to help identify or disambiguate which account the user wants. Do NOT dump full financial totals unless confirmed.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        includeArchived: {
          type: Type.BOOLEAN,
          description: "Whether to include archived accounts. Defaults to false.",
        },
      },
    },
  },
  {
    name: "get_account_details",
    description:
      "Fetch full details for one specific SpendWise account resolved by name, bank, or active conversation context.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountQuery: {
          type: Type.STRING,
          description: "Account name, bank name, or last 4 digits mentioned by the user.",
        },
        useConversationContext: {
          type: Type.BOOLEAN,
          description:
            "Set true only when the user refers to the previously discussed account (e.g. 'this account', 'it').",
        },
      },
    },
  },
  {
    name: "get_account_balance",
    description:
      "Retrieve the actual current balance (and credit limit / due amount for credit cards) for one specific SpendWise account.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountQuery: {
          type: Type.STRING,
          description: "Specific account name or bank name.",
        },
        useConversationContext: {
          type: Type.BOOLEAN,
          description: "True for follow-up questions referencing the active conversation account.",
        },
      },
    },
  },
  {
    name: "create_account",
    description:
      "Stage creation of a new SpendWise financial account. Never call unless the user explicitly intends to add/create an account. Checks for missing required fields (name, accountType, openingBalance) and duplicates, then requires explicit YES confirmation before inserting.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Account name, e.g. 'ICICI Savings'." },
        accountType: {
          type: Type.STRING,
          description: "One of: bank, credit_card, cash, investment.",
        },
        openingBalance: {
          type: Type.NUMBER,
          description: "Opening/initial balance (or initial due amount for credit card).",
        },
        bankName: { type: Type.STRING, description: "Bank or institution name, e.g. 'ICICI Bank'." },
        creditLimit: { type: Type.NUMBER, description: "Optional credit limit for credit_card." },
        dueDate: { type: Type.STRING, description: "Optional due date for credit_card." },
        accountNumberLast4: { type: Type.STRING, description: "Optional last 4 digits." },
      },
    },
  },
  {
    name: "update_account",
    description:
      "Stage updating/renaming an existing SpendWise account. Always requires explicit YES confirmation before saving.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountQuery: { type: Type.STRING, description: "Existing account name to update." },
        newName: { type: Type.STRING, description: "New account name if renaming." },
        newBankName: { type: Type.STRING, description: "Updated bank/institution name." },
        newType: { type: Type.STRING, description: "Updated type: bank, credit_card, cash, investment." },
        creditLimit: { type: Type.NUMBER, description: "Updated credit card limit." },
        dueDate: { type: Type.STRING, description: "Updated credit card due date." },
        isArchived: { type: Type.BOOLEAN, description: "Set true to archive or false to restore." },
      },
      required: ["accountQuery"],
    },
  },
  {
    name: "archive_account",
    description:
      "Stage archiving/deactivating a SpendWise account (never permanently deletes financial records). Requires explicit YES confirmation.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountQuery: { type: Type.STRING, description: "Account name to archive/deactivate." },
      },
      required: ["accountQuery"],
    },
  },
  {
    name: "get_account_income",
    description: "Get income total and breakdown for a specific account over a period.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountQuery: { type: Type.STRING },
        period: {
          type: Type.STRING,
          description: "today, yesterday, this_week, this_month, last_month",
        },
        startDate: { type: Type.STRING, description: "Optional YYYY-MM-DD" },
        endDate: { type: Type.STRING, description: "Optional YYYY-MM-DD" },
        useConversationContext: { type: Type.BOOLEAN },
      },
    },
  },
  {
    name: "get_account_expenses",
    description:
      "Get expense total, average/highest expense, category breakdown, and optional previous-period comparison for a specific account.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountQuery: { type: Type.STRING },
        period: {
          type: Type.STRING,
          description: "today, yesterday, this_week, this_month, last_month",
        },
        startDate: { type: Type.STRING, description: "Optional YYYY-MM-DD" },
        endDate: { type: Type.STRING, description: "Optional YYYY-MM-DD" },
        comparePrevious: {
          type: Type.BOOLEAN,
          description: "True to compare against previous period (e.g. this month vs last month).",
        },
        useConversationContext: { type: Type.BOOLEAN },
      },
    },
  },
  {
    name: "get_account_cashflow",
    description: "Get income, expenses, and net cashflow for a specific account over a time period.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountQuery: { type: Type.STRING },
        period: { type: Type.STRING },
        startDate: { type: Type.STRING },
        endDate: { type: Type.STRING },
        comparePrevious: { type: Type.BOOLEAN },
        useConversationContext: { type: Type.BOOLEAN },
      },
    },
  },
  {
    name: "get_account_net_balance",
    description: "Get net balance and cashflow position for a specific account.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountQuery: { type: Type.STRING },
        useConversationContext: { type: Type.BOOLEAN },
      },
    },
  },
  {
    name: "get_account_liabilities",
    description: "Get liabilities (credit card due, credit limit, linked loans) for a specific account.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountQuery: { type: Type.STRING },
        useConversationContext: { type: Type.BOOLEAN },
      },
    },
  },
  {
    name: "get_account_outstanding_debt",
    description: "Get outstanding credit card dues and loan principal owed on a specific account.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountQuery: { type: Type.STRING },
        useConversationContext: { type: Type.BOOLEAN },
      },
    },
  },
  {
    name: "get_account_emi_details",
    description: "Get linked loans, monthly EMI amounts, next due dates, and EMI payment history for a specific account.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountQuery: { type: Type.STRING },
        useConversationContext: { type: Type.BOOLEAN },
      },
    },
  },
  {
    name: "create_transaction",
    description:
      "Stage adding a new expense, income, or transfer to a specific SpendWise account. Never assumes a default account; asks the user if account is missing or ambiguous, and always stages explicit YES confirmation before inserting.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountQuery: { type: Type.STRING, description: "Account name for the transaction." },
        title: { type: Type.STRING, description: "Merchant or description, e.g. 'Starbucks Coffee'." },
        amount: { type: Type.NUMBER, description: "Positive numeric amount." },
        type: { type: Type.STRING, description: "expense, income, transfer, or emi_payment." },
        categoryHint: { type: Type.STRING, description: "Optional category name." },
        date: { type: Type.STRING, description: "Optional YYYY-MM-DD date (defaults to today)." },
        notes: { type: Type.STRING, description: "Optional notes." },
        toAccountQuery: { type: Type.STRING, description: "Destination account if type is transfer." },
        useConversationContext: { type: Type.BOOLEAN },
      },
      required: ["title", "amount", "type"],
    },
  },
  {
    name: "get_transactions",
    description: "Get recent transactions for one specific SpendWise account.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountQuery: { type: Type.STRING },
        limit: { type: Type.NUMBER, description: "Max items to return (default 10, max 25)." },
        offset: { type: Type.NUMBER, description: "Pagination offset (default 0)." },
        useConversationContext: { type: Type.BOOLEAN },
      },
    },
  },
  {
    name: "search_transactions",
    description: "Search and filter transactions within a specific SpendWise account.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountQuery: { type: Type.STRING },
        searchText: { type: Type.STRING, description: "Merchant or keyword." },
        categoryName: { type: Type.STRING },
        type: { type: Type.STRING, description: "expense, income, transfer, emi_payment" },
        minAmount: { type: Type.NUMBER },
        maxAmount: { type: Type.NUMBER },
        startDate: { type: Type.STRING },
        endDate: { type: Type.STRING },
        period: { type: Type.STRING },
        limit: { type: Type.NUMBER },
        useConversationContext: { type: Type.BOOLEAN },
      },
    },
  },
  {
    name: "get_category_summary",
    description: "Get category-wise spending or income breakdown for one specific account over a period.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        accountQuery: { type: Type.STRING },
        period: { type: Type.STRING },
        startDate: { type: Type.STRING },
        endDate: { type: Type.STRING },
        useConversationContext: { type: Type.BOOLEAN },
      },
    },
  },
  {
    name: "get_portfolio_summary",
    description:
      "Request an overall multi-account portfolio summary. MUST stage confirmation of the intended account scope first before aggregating across multiple accounts.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: { type: Type.STRING, description: "Optional period such as this_month." },
      },
    },
  },
];

async function resolveTargetAccountOrPrompt(
  ctx: SupabaseAccessContext,
  session: WhatsAppConversationSession,
  accountQuery?: string,
  useConversationContext?: boolean
) {
  const accounts = await listUserAccounts(ctx, { includeArchived: false });
  const contextId = useConversationContext ? session.activeAccountId : undefined;
  const resolution = matchAccountQuery(accounts, accountQuery, contextId);

  if (resolution.status === "resolved") {
    session.activeAccountId = resolution.account.id;
    session.activeAccountName = resolution.account.name;
    saveConversationSession(session, ctx);
    return { ok: true as const, account: resolution.account };
  }

  if (resolution.status === "ambiguous") {
    return {
      ok: false as const,
      toolResult: {
        status: "ambiguous_account",
        query: resolution.query,
        message: `Multiple accounts match "${resolution.query}". Ask the user to select one exact account from the options below.`,
        matchingAccounts: resolution.matches.map((m) => ({
          id: m.id,
          name: m.name,
          bankName: m.bankName || null,
          type: m.type,
        })),
      },
    };
  }

  if (resolution.status === "not_found") {
    return {
      ok: false as const,
      toolResult: {
        status: "account_not_found",
        query: resolution.query,
        message: `No SpendWise account matching "${resolution.query}" was found. Offer to create this account through WhatsApp, or let the user pick from their existing accounts.`,
        existingAccountNames: resolution.availableAccounts.map((a) => a.name),
      },
    };
  }

  return {
    ok: false as const,
    toolResult: {
      status: "account_required",
      message:
        "The user did not specify an account. Never assume a default account. Ask which account they mean, listing only their account names to choose from.",
      availableAccountNames: resolution.availableAccounts.map((a) => ({
        name: a.name,
        type: accountTypeLabel(a.type),
      })),
    },
  };
}

export async function executeWhatsAppTool(
  ctx: SupabaseAccessContext,
  session: WhatsAppConversationSession,
  toolName: string,
  rawArgs: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const args = rawArgs || {};

  if (toolName === "get_accounts") {
    const accounts = await listUserAccounts(ctx, {
      includeArchived: Boolean(args.includeArchived),
    });
    return {
      status: "ok",
      count: accounts.length,
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: accountTypeLabel(a.type),
        bankName: a.bankName || null,
        isArchived: Boolean(a.isArchived),
      })),
      note: "Only account identifiers are listed here. Do not aggregate balances across accounts without user confirmation.",
    };
  }

  if (toolName === "get_account_details" || toolName === "get_account_balance" || toolName === "get_account_net_balance") {
    const resolved = await resolveTargetAccountOrPrompt(
      ctx,
      session,
      typeof args.accountQuery === "string" ? args.accountQuery : undefined,
      args.useConversationContext !== false
    );
    if (!resolved.ok) return resolved.toolResult;

    const acc = resolved.account;
    const serialized = serializeAccountFields(acc);

    if (toolName === "get_account_net_balance") {
      const analytics = await getAccountAnalyticsSummary(ctx, {
        accountId: acc.id,
        period: "this_month",
      });
      return {
        status: "ok",
        account: serialized,
        thisMonthNetCashflow: analytics.netCashflow,
        thisMonthIncome: analytics.totalIncome,
        thisMonthExpenses: analytics.totalExpenses,
      };
    }

    return {
      status: "ok",
      account: serialized,
      schemaNote:
        "SpendWise stores the live current balance (and credit limit / due amount for credit cards). Separate historical opening balance is not stored as a separate column.",
    };
  }

  if (toolName === "create_account") {
    const name = typeof args.name === "string" ? args.name.trim() : "";
    const normalizedType = normalizeAccountTypeInput(
      typeof args.accountType === "string" ? args.accountType : name
    );
    const hasBalance =
      args.openingBalance !== undefined &&
      args.openingBalance !== null &&
      Number.isFinite(Number(args.openingBalance));

    const missingFields: string[] = [];
    if (!name) missingFields.push("account name");
    if (!normalizedType) missingFields.push("account type (bank, credit_card, cash, or investment)");
    if (!hasBalance) missingFields.push("opening balance");

    if (missingFields.length > 0) {
      return {
        status: "missing_required_fields",
        missingFields,
        message: `Ask the user to provide the missing required fields before creating the account: ${missingFields.join(", ")}.`,
      };
    }

    const existing = await listUserAccounts(ctx, { includeArchived: true });
    const duplicate = existing.find((a) => a.name.trim().toLowerCase() === name.toLowerCase());
    if (duplicate) {
      return {
        status: "duplicate_account",
        message: `An account named "${duplicate.name}" already exists. Do not create a duplicate.`,
        existingAccount: serializeAccountFields(duplicate),
      };
    }

    const profile = await getServerUserProfile(ctx);
    const currency = profile?.currency || "₹";
    const openingBalance = Number(args.openingBalance);
    const bankName = typeof args.bankName === "string" ? args.bankName.trim() : undefined;
    const creditLimit =
      args.creditLimit !== undefined && Number.isFinite(Number(args.creditLimit))
        ? Number(args.creditLimit)
        : undefined;
    const dueDate = typeof args.dueDate === "string" ? args.dueDate.trim() : undefined;
    const accountNumberLast4 =
      typeof args.accountNumberLast4 === "string" ? args.accountNumberLast4.trim() : undefined;

    const summaryLines = [
      `Account: *${name}*`,
      `Type: ${accountTypeLabel(normalizedType!)}`,
      ...(bankName ? [`Institution: ${bankName}`] : []),
      normalizedType === "credit_card"
        ? `Initial Due: ${formatMoney(openingBalance, currency)}${creditLimit ? ` (Limit: ${formatMoney(creditLimit, currency)})` : ""}`
        : `Opening Balance: ${formatMoney(openingBalance, currency)}`,
      "",
      "Reply *YES* to create this account or *NO* to cancel.",
    ];
    const summary = summaryLines.join("\n");

    session.pendingConfirmation = {
      kind: "create_account",
      summary,
      createdAt: new Date().toISOString(),
      payload: {
        name,
        type: normalizedType!,
        openingBalance,
        bankName,
        creditLimit,
        dueAmount: normalizedType === "credit_card" ? openingBalance : undefined,
        dueDate,
        accountNumberLast4,
        currency,
      },
    };
    saveConversationSession(session, ctx);

    return {
      status: "confirmation_required",
      confirmationSummary: summary,
    };
  }

  if (toolName === "update_account") {
    const resolved = await resolveTargetAccountOrPrompt(
      ctx,
      session,
      typeof args.accountQuery === "string" ? args.accountQuery : undefined,
      true
    );
    if (!resolved.ok) return resolved.toolResult;

    const target = resolved.account;
    if (!target.access.canEdit) {
      return {
        status: "permission_denied",
        message: `You only have "${target.access.role}" access on ${target.name} and cannot modify account details.`,
      };
    }

    const patch: {
      name?: string;
      bankName?: string;
      type?: AccountType;
      creditLimit?: number;
      dueDate?: string;
      isArchived?: boolean;
    } = {};

    const changes: string[] = [];
    if (typeof args.newName === "string" && args.newName.trim()) {
      patch.name = args.newName.trim();
      changes.push(`Name: ${target.name} → *${patch.name}*`);
    }
    if (typeof args.newBankName === "string" && args.newBankName.trim()) {
      patch.bankName = args.newBankName.trim();
      changes.push(`Bank: *${patch.bankName}*`);
    }
    if (typeof args.newType === "string") {
      const nt = normalizeAccountTypeInput(args.newType);
      if (nt) {
        patch.type = nt;
        changes.push(`Type: *${accountTypeLabel(nt)}*`);
      }
    }
    if (args.creditLimit !== undefined && Number.isFinite(Number(args.creditLimit))) {
      patch.creditLimit = Number(args.creditLimit);
      changes.push(`Credit Limit: *${formatMoney(patch.creditLimit, target.currency)}*`);
    }
    if (typeof args.dueDate === "string" && args.dueDate.trim()) {
      patch.dueDate = args.dueDate.trim();
      changes.push(`Due Date: *${patch.dueDate}*`);
    }
    if (typeof args.isArchived === "boolean") {
      patch.isArchived = args.isArchived;
      changes.push(`Status: *${args.isArchived ? "Archived" : "Active"}*`);
    }

    if (changes.length === 0) {
      return {
        status: "missing_changes",
        message: `Specify what you would like to update on ${target.name} (e.g., name, bank name, credit limit, due date, or archive status).`,
      };
    }

    const summary = [
      `Confirm updates to *${target.name}*:`,
      ...changes.map((c) => `• ${c}`),
      "",
      "Reply *YES* to save these changes or *NO* to cancel.",
    ].join("\n");

    session.pendingConfirmation = {
      kind: "update_account",
      summary,
      createdAt: new Date().toISOString(),
      payload: {
        accountId: target.id,
        accountName: target.name,
        patch,
      },
    };
    saveConversationSession(session, ctx);

    return {
      status: "confirmation_required",
      confirmationSummary: summary,
    };
  }

  if (toolName === "archive_account") {
    const resolved = await resolveTargetAccountOrPrompt(
      ctx,
      session,
      typeof args.accountQuery === "string" ? args.accountQuery : undefined,
      false
    );
    if (!resolved.ok) return resolved.toolResult;

    const target = resolved.account;
    if (!target.access.canArchive) {
      return {
        status: "permission_denied",
        message: "Only the account owner can archive or deactivate a financial account.",
      };
    }

    const summary = [
      `Archive Account: *${target.name}* (${accountTypeLabel(target.type)})`,
      "SpendWise will deactivate/archive this account rather than permanently deleting transaction history.",
      "",
      "Reply *YES* to archive this account or *NO* to cancel.",
    ].join("\n");

    session.pendingConfirmation = {
      kind: "archive_account",
      summary,
      createdAt: new Date().toISOString(),
      payload: {
        accountId: target.id,
        accountName: target.name,
      },
    };
    saveConversationSession(session, ctx);

    return {
      status: "confirmation_required",
      confirmationSummary: summary,
    };
  }

  if (
    toolName === "get_account_income" ||
    toolName === "get_account_expenses" ||
    toolName === "get_account_cashflow" ||
    toolName === "get_category_summary"
  ) {
    const resolved = await resolveTargetAccountOrPrompt(
      ctx,
      session,
      typeof args.accountQuery === "string" ? args.accountQuery : undefined,
      args.useConversationContext !== false
    );
    if (!resolved.ok) return resolved.toolResult;

    const analytics = await getAccountAnalyticsSummary(ctx, {
      accountId: resolved.account.id,
      period: typeof args.period === "string" ? args.period : "this_month",
      startDate: typeof args.startDate === "string" ? args.startDate : undefined,
      endDate: typeof args.endDate === "string" ? args.endDate : undefined,
      comparePrevious: Boolean(args.comparePrevious),
    });

    return {
      status: "ok",
      focus: toolName,
      ...analytics,
    };
  }

  if (
    toolName === "get_account_liabilities" ||
    toolName === "get_account_outstanding_debt" ||
    toolName === "get_account_emi_details"
  ) {
    const resolved = await resolveTargetAccountOrPrompt(
      ctx,
      session,
      typeof args.accountQuery === "string" ? args.accountQuery : undefined,
      args.useConversationContext !== false
    );
    if (!resolved.ok) return resolved.toolResult;

    const liabilities = await getAccountLiabilitiesAndLoans(ctx, resolved.account.id);
    return {
      status: "ok",
      focus: toolName,
      ...liabilities,
    };
  }

  if (toolName === "get_transactions" || toolName === "search_transactions") {
    const resolved = await resolveTargetAccountOrPrompt(
      ctx,
      session,
      typeof args.accountQuery === "string" ? args.accountQuery : undefined,
      args.useConversationContext !== false
    );
    if (!resolved.ok) return resolved.toolResult;

    const result = await listAccountTransactions(ctx, {
      accountId: resolved.account.id,
      startDate: typeof args.startDate === "string" ? args.startDate : undefined,
      endDate: typeof args.endDate === "string" ? args.endDate : undefined,
      type: typeof args.type === "string" ? args.type : undefined,
      categoryName: typeof args.categoryName === "string" ? args.categoryName : undefined,
      minAmount: args.minAmount !== undefined ? Number(args.minAmount) : undefined,
      maxAmount: args.maxAmount !== undefined ? Number(args.maxAmount) : undefined,
      searchText: typeof args.searchText === "string" ? args.searchText : undefined,
      limit: args.limit !== undefined ? Number(args.limit) : 10,
      offset: args.offset !== undefined ? Number(args.offset) : 0,
    });

    return {
      status: "ok",
      accountName: resolved.account.name,
      ...result,
    };
  }

  if (toolName === "create_transaction") {
    const title = typeof args.title === "string" ? args.title.trim() : "";
    const amount = Number(args.amount);
    const txType =
      args.type === "income" || args.type === "transfer" || args.type === "emi_payment"
        ? args.type
        : "expense";

    if (!title || !Number.isFinite(amount) || amount <= 0) {
      return {
        status: "missing_required_fields",
        message: "Ask the user for both a valid description/merchant and a positive numeric amount.",
      };
    }

    // NEVER assume a default account when creating transactions unless user referenced context!
    const resolved = await resolveTargetAccountOrPrompt(
      ctx,
      session,
      typeof args.accountQuery === "string" ? args.accountQuery : undefined,
      Boolean(args.useConversationContext)
    );
    if (!resolved.ok) return resolved.toolResult;

    const source = resolved.account;
    if (!source.access.canTransact) {
      return {
        status: "permission_denied",
        message: `You only have "${source.access.role}" access on ${source.name} and cannot add transactions.`,
      };
    }

    let destAccount: Account | undefined;
    if (txType === "transfer") {
      const destQuery = typeof args.toAccountQuery === "string" ? args.toAccountQuery : undefined;
      if (!destQuery) {
        return {
          status: "destination_account_required",
          message: "Ask which destination account the transfer should go into.",
        };
      }
      const allAccounts = await listUserAccounts(ctx, { includeArchived: false });
      const destMatch = matchAccountQuery(allAccounts, destQuery);
      if (destMatch.status !== "resolved") {
        return {
          status: "destination_account_unresolved",
          message: `Could not uniquely identify destination account "${destQuery}". Ask the user to specify it.`,
        };
      }
      destAccount = destMatch.account;
    }

    const [categories, rules] = await Promise.all([listUserCategories(ctx), listUserRules(ctx)]);
    const ruleMatch = findMatchingRule(title, rules);
    const categoryHint = typeof args.categoryHint === "string" ? args.categoryHint.trim() : undefined;
    let resolvedCategory = categoryHint
      ? categories.find((c) => c.name.toLowerCase().includes(categoryHint.toLowerCase()))
      : undefined;
    if (!resolvedCategory && ruleMatch?.suggestedCategoryId) {
      resolvedCategory = categories.find((c) => c.id === ruleMatch.suggestedCategoryId);
    }

    const dateStr =
      typeof args.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.date)
        ? args.date
        : new Date().toISOString().split("T")[0];
    const currency = source.currency || "₹";
    const typeLabel =
      txType === "income"
        ? "Income"
        : txType === "transfer"
        ? "Transfer"
        : txType === "emi_payment"
        ? "EMI Payment"
        : "Expense";

    const summary = [
      `Confirm ${typeLabel}:`,
      `• Title: *${title}*`,
      `• Amount: *${formatMoney(amount, currency)}*`,
      `• Account: *${source.name}*`,
      ...(destAccount ? [`• To Account: *${destAccount.name}*`] : []),
      ...(resolvedCategory ? [`• Category: ${resolvedCategory.name}`] : []),
      `• Date: ${dateStr}`,
      "",
      "Reply *YES* to save this transaction or *NO* to cancel.",
    ].join("\n");

    session.pendingConfirmation = {
      kind: "create_transaction",
      summary,
      createdAt: new Date().toISOString(),
      payload: {
        accountId: source.id,
        accountName: source.name,
        title,
        amount,
        type: txType,
        categoryHint: resolvedCategory?.name || categoryHint,
        date: dateStr,
        notes: typeof args.notes === "string" ? args.notes : undefined,
        toAccountId: destAccount?.id,
        toAccountName: destAccount?.name,
      },
    };
    saveConversationSession(session, ctx);

    return {
      status: "confirmation_required",
      confirmationSummary: summary,
    };
  }

  if (toolName === "get_portfolio_summary") {
    const accounts = await listUserAccounts(ctx, { includeArchived: false });
    if (accounts.length === 0) {
      return {
        status: "no_accounts",
        message: "You do not have any active SpendWise accounts yet. Would you like to create one?",
      };
    }

    session.pendingPortfolioScope = {
      accountIds: accounts.map((a) => a.id),
      accountNames: accounts.map((a) => a.name),
      period: typeof args.period === "string" ? args.period : "this_month",
      createdAt: new Date().toISOString(),
    };
    saveConversationSession(session, ctx);

    return {
      status: "scope_confirmation_required",
      accountsToInclude: accounts.map((a) => `${a.name} (${accountTypeLabel(a.type)})`),
      message:
        "Before aggregating across accounts, ask the user to confirm whether they want the overall summary across all of those accounts (Reply YES to confirm, or name a specific account).",
    };
  }

  return { status: "unknown_tool", message: `Unsupported tool: ${toolName}` };
}

export async function executePendingMutation(
  ctx: SupabaseAccessContext,
  session: WhatsAppConversationSession,
  pending: PendingMutationConfirmation
): Promise<{ replyText: string; dataMutated: boolean }> {
  if (pending.kind === "create_account") {
    const res = await createUserAccount(ctx, pending.payload);
    session.pendingConfirmation = null;
    if (!res.created || !res.account) {
      saveConversationSession(session, ctx);
      return {
        replyText: res.error || "Could not create the account.",
        dataMutated: false,
      };
    }

    session.activeAccountId = res.account.id;
    session.activeAccountName = res.account.name;
    saveConversationSession(session, ctx);

    const bal =
      res.account.type === "credit_card"
        ? `Due: ${formatMoney(res.account.dueAmount || 0, res.account.currency)}`
        : `Balance: ${formatMoney(res.account.balance, res.account.currency)}`;

    return {
      replyText: `Your *${res.account.name}* (${accountTypeLabel(res.account.type)}) account has been created successfully.\n${bal}`,
      dataMutated: true,
    };
  }

  if (pending.kind === "update_account") {
    const res = await updateUserAccount(ctx, pending.payload.accountId, pending.payload.patch);
    session.pendingConfirmation = null;
    if (!res.updated || !res.account) {
      saveConversationSession(session, ctx);
      return {
        replyText: res.error || "Could not update the account.",
        dataMutated: false,
      };
    }

    session.activeAccountId = res.account.id;
    session.activeAccountName = res.account.name;
    saveConversationSession(session, ctx);
    return {
      replyText: `Updated *${res.account.name}* (${accountTypeLabel(res.account.type)} • ${
        res.account.isArchived ? "Archived" : "Active"
      }).`,
      dataMutated: true,
    };
  }

  if (pending.kind === "archive_account") {
    const res = await archiveUserAccount(ctx, pending.payload.accountId);
    session.pendingConfirmation = null;
    if (session.activeAccountId === pending.payload.accountId) {
      session.activeAccountId = undefined;
      session.activeAccountName = undefined;
    }
    saveConversationSession(session, ctx);
    if (!res.archived) {
      return {
        replyText: res.error || "Could not archive the account.",
        dataMutated: false,
      };
    }
    return {
      replyText: `Archived *${pending.payload.accountName}*. Your historical transactions remain preserved.`,
      dataMutated: true,
    };
  }

  // create_transaction
  const res = await createUserTransaction(ctx, {
    accountId: pending.payload.accountId,
    title: pending.payload.title,
    amount: pending.payload.amount,
    type: pending.payload.type,
    categoryHint: pending.payload.categoryHint,
    date: pending.payload.date,
    notes: pending.payload.notes,
    toAccountId: pending.payload.toAccountId,
  });

  session.pendingConfirmation = null;
  if (!res.created || !res.transaction) {
    saveConversationSession(session, ctx);
    return {
      replyText: res.error || "Could not save the transaction.",
      dataMutated: false,
    };
  }

  session.activeAccountId = pending.payload.accountId;
  session.activeAccountName = pending.payload.accountName;
  saveConversationSession(session, ctx);

  const currency = res.updatedAccount?.currency || "₹";
  const balLine = res.updatedAccount
    ? res.updatedAccount.type === "credit_card"
      ? `Updated Card Due: ${formatMoney(res.updatedAccount.dueAmount || 0, currency)}`
      : `Updated Balance: ${formatMoney(res.updatedAccount.balance, currency)}`
    : "";

  return {
    replyText: [
      `Saved ${pending.payload.type} to *${pending.payload.accountName}*:`,
      `• *${res.transaction.title}* — ${formatMoney(res.transaction.amount, currency)}`,
      ...(res.matchedCategoryName ? [`• Category: ${res.matchedCategoryName}`] : []),
      ...(balLine ? [`• ${balLine}`] : []),
    ].join("\n"),
    dataMutated: true,
  };
}

async function executeConfirmedPortfolioSummary(
  ctx: SupabaseAccessContext,
  session: WhatsAppConversationSession,
  scope: PendingPortfolioScope
): Promise<string> {
  const accounts = await listUserAccounts(ctx, { includeArchived: false });
  const scoped = accounts.filter((a) => scope.accountIds.includes(a.id));
  session.pendingPortfolioScope = null;
  saveConversationSession(session, ctx);

  if (scoped.length === 0) {
    return "No active accounts matched the confirmed scope.";
  }

  const profile = await getServerUserProfile(ctx);
  const currency = profile?.currency || scoped[0]?.currency || "₹";

  let liquidTotal = 0;
  let totalCardDue = 0;
  const lines: string[] = [];

  for (const acc of scoped) {
    if (acc.type === "credit_card") {
      totalCardDue += acc.dueAmount || 0;
      lines.push(`• *${acc.name}* (Credit Card): Due ${formatMoney(acc.dueAmount || 0, acc.currency || currency)}`);
    } else {
      liquidTotal += acc.balance;
      lines.push(`• *${acc.name}* (${accountTypeLabel(acc.type)}): ${formatMoney(acc.balance, acc.currency || currency)}`);
    }
  }

  return [
    "*SpendWise Portfolio Summary*",
    ...lines,
    "",
    `Total Liquid Balance: ${formatMoney(liquidTotal, currency)}`,
    `Total Card Dues: ${formatMoney(totalCardDue, currency)}`,
    `Net Cash Position: ${formatMoney(liquidTotal - totalCardDue, currency)}`,
  ].join("\n");
}

function buildSystemInstruction(userEmail: string, session: WhatsAppConversationSession): string {
  const activeContextNote = session.activeAccountId
    ? `Active conversation account context: "${session.activeAccountName}" (ID: ${session.activeAccountId}). Use this ONLY when the user clearly refers to "this account", "it", or asks an immediate follow-up about the same account.`
    : "No active conversation account is currently selected.";

  return [
    "You are SpendWise WhatsApp AI Financial Assistant, helping a verified SpendWise user manage their personal finances over WhatsApp.",
    `Verified user email: ${userEmail}.`,
    activeContextNote,
    "",
    "STRICT OPERATING RULES:",
    "1. ACCOUNT-SPECIFIC FIRST: Every financial query, analytics request, liability lookup, or transaction MUST resolve a specific SpendWise account. NEVER assume a default account or guess an account.",
    "2. MISSING / AMBIGUOUS / NOT FOUND ACCOUNTS:",
    "   - If the user omits the account and no active conversation context applies, ask which account they mean (you may call get_accounts to list only their account names to choose from).",
    "   - If multiple accounts match, ask them to choose one exact account.",
    "   - If an account does not exist, clearly say so and offer to create it directly via WhatsApp.",
    "   - If the user asks for an overall portfolio summary across all accounts, call get_portfolio_summary so they confirm the account scope first.",
    "3. NO FABRICATION: Never invent balances, opening balances, transactions, dates, or fields not returned by a tool. Only report values returned by the database tools.",
    "4. EXPLICIT CONFIRMATION FOR ALL WRITES: When creating/updating/archiving accounts or adding transactions, always call the respective tool to validate inputs and stage confirmation, then display the exact confirmation summary and ask the user to reply YES to confirm.",
    "5. DO NOT CREATE ACCOUNTS ACCIDENTALLY: Never call create_account simply because a user mentions a bank name in a balance/expense query.",
    "6. WHATSAPP FORMATTING: Keep replies concise, scannable, mobile-friendly, and formatted with ₹ (or the account's currency) using Indian numbering where applicable.",
  ].join("\n");
}

export async function handleConversationalWhatsAppMessage(input: {
  ctx: SupabaseAccessContext;
  phoneDigits: string;
  text: string;
}): Promise<{
  replyText: string;
  dataMutated: boolean;
  requiresConfirmation: boolean;
  activeAccountId?: string;
  activeAccountName?: string;
  usedGemini: boolean;
  errorCode?: string;
}> {
  const { ctx, phoneDigits, text } = input;
  const trimmed = text.trim();
  const session = getOrCreateConversationSession(ctx.userEmail, phoneDigits);

  // 1. Deterministic confirmation / cancellation gate for staged mutations
  if (session.pendingConfirmation) {
    if (isExplicitConfirmText(trimmed)) {
      const outcome = await executePendingMutation(ctx, session, session.pendingConfirmation);
      session.history.push({ role: "user", text: trimmed }, { role: "model", text: outcome.replyText });
      saveConversationSession(session, ctx);
      return {
        replyText: outcome.replyText,
        dataMutated: outcome.dataMutated,
        requiresConfirmation: false,
        activeAccountId: session.activeAccountId,
        activeAccountName: session.activeAccountName,
        usedGemini: false,
      };
    }

    if (isExplicitCancelText(trimmed)) {
      session.pendingConfirmation = null;
      const reply = "Cancelled. No changes were saved to SpendWise.";
      session.history.push({ role: "user", text: trimmed }, { role: "model", text: reply });
      saveConversationSession(session, ctx);
      return {
        replyText: reply,
        dataMutated: false,
        requiresConfirmation: false,
        activeAccountId: session.activeAccountId,
        activeAccountName: session.activeAccountName,
        usedGemini: false,
      };
    }

    // Ambiguous reply while confirmation is pending — never execute on ambiguous text!
    const rePrompt = `Ambiguous reply. Please reply *YES* to confirm or *NO* to cancel:\n\n${session.pendingConfirmation.summary}`;
    return {
      replyText: rePrompt,
      dataMutated: false,
      requiresConfirmation: true,
      activeAccountId: session.activeAccountId,
      activeAccountName: session.activeAccountName,
      usedGemini: false,
    };
  }

  // 2. Deterministic confirmation gate for multi-account portfolio summary scope
  if (session.pendingPortfolioScope) {
    if (isExplicitConfirmText(trimmed)) {
      const summaryText = await executeConfirmedPortfolioSummary(
        ctx,
        session,
        session.pendingPortfolioScope
      );
      session.history.push({ role: "user", text: trimmed }, { role: "model", text: summaryText });
      saveConversationSession(session, ctx);
      return {
        replyText: summaryText,
        dataMutated: false,
        requiresConfirmation: false,
        activeAccountId: session.activeAccountId,
        activeAccountName: session.activeAccountName,
        usedGemini: false,
      };
    }
    if (isExplicitCancelText(trimmed)) {
      session.pendingPortfolioScope = null;
      const reply = "Okay, cancelled the portfolio summary. Which specific account would you like to check?";
      saveConversationSession(session, ctx);
      return {
        replyText: reply,
        dataMutated: false,
        requiresConfirmation: false,
        activeAccountId: session.activeAccountId,
        activeAccountName: session.activeAccountName,
        usedGemini: false,
      };
    }
    // User asked something else or named a specific account — clear scope prompt and continue normally
    session.pendingPortfolioScope = null;
    saveConversationSession(session, ctx);
  }

  // 3. Gemini Function Calling Orchestrator
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiApiKey) {
    return {
      replyText:
        "SpendWise WhatsApp AI Assistant requires GEMINI_API_KEY to be configured on the server.",
      dataMutated: false,
      requiresConfirmation: false,
      activeAccountId: session.activeAccountId,
      activeAccountName: session.activeAccountName,
      usedGemini: false,
      errorCode: "GEMINI_API_KEY_MISSING",
    };
  }

  const ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });

  const contents: Content[] = [
    ...session.history.slice(-8).map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    { role: "user", parts: [{ text: trimmed }] },
  ];

  const tools = [{ functionDeclarations: TOOL_DECLARATIONS }];
  const systemInstruction = buildSystemInstruction(ctx.userEmail, session);

  let finalText = "";
  const MAX_TOOL_ROUNDS = 6;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents,
      config: {
        systemInstruction,
        tools,
        temperature: 0.2,
      },
    });

    const functionCalls = response.functionCalls;
    const modelContent = response.candidates?.[0]?.content;

    if (!functionCalls || functionCalls.length === 0) {
      finalText = (response.text || "").trim();
      break;
    }

    if (modelContent) {
      contents.push(modelContent);
    }

    const responseParts: Part[] = [];
    for (const call of functionCalls) {
      const name = call.name || "";
      const args = (call.args || {}) as Record<string, unknown>;
      let toolOutcome: Record<string, unknown>;
      try {
        toolOutcome = await executeWhatsAppTool(ctx, session, name, args);
      } catch (err) {
        toolOutcome = {
          status: "error",
          message: err instanceof Error ? err.message : "Tool execution failed.",
        };
      }

      responseParts.push({
        functionResponse: {
          id: call.id,
          name,
          response: toolOutcome,
        },
      });
    }

    contents.push({
      role: "user",
      parts: responseParts,
    });
  }

  if (!finalText) {
    finalText = session.pendingConfirmation
      ? session.pendingConfirmation.summary
      : "I could not complete that request right now. Please specify the SpendWise account and try again.";
  }

  session.history.push({ role: "user", text: trimmed }, { role: "model", text: finalText });
  saveConversationSession(session, ctx);

  return {
    replyText: finalText,
    dataMutated: false,
    requiresConfirmation: Boolean(session.pendingConfirmation || session.pendingPortfolioScope),
    activeAccountId: session.activeAccountId,
    activeAccountName: session.activeAccountName,
    usedGemini: true,
  };
}
