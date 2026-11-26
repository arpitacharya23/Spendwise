export const SUPABASE_SETUP_SQL = `-- ==============================================================================
-- SPENDWISE EXPENSE TRACKER & SPLITWISE - IDEMPOTENT SUPABASE POSTGRESQL SCHEMA
-- ==============================================================================
-- Run this entire script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query).
-- It will check for existing tables/columns/functions/triggers and automatically add or
-- update any missing tables, columns, indexes, functions, triggers, Row Level Security (RLS)
-- policies, and default seeds without data loss.

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. CREATE TABLES (IF NOT PRESENT)
-- ==============================================================================

-- User Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'User',
    email TEXT UNIQUE NOT NULL,
    currency TEXT NOT NULL DEFAULT '₹',
    avatar_color TEXT NOT NULL DEFAULT '#3B82F6',
    avatar_url TEXT DEFAULT NULL,
    phone TEXT DEFAULT NULL,
    country_code TEXT DEFAULT '+91',
    monthly_budget NUMERIC DEFAULT 50000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'Utensils',
    color TEXT NOT NULL DEFAULT '#3B82F6',
    type TEXT NOT NULL DEFAULT 'expense',
    budget_limit NUMERIC DEFAULT NULL,
    parent_id TEXT REFERENCES public.categories(id) ON DELETE CASCADE,
    user_email TEXT DEFAULT NULL,
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Accounts Table (Bank accounts, Credit Cards, Cash, Investments)
CREATE TABLE IF NOT EXISTS public.accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('bank', 'credit_card', 'cash', 'investment')),
    balance NUMERIC NOT NULL DEFAULT 0,
    credit_limit NUMERIC DEFAULT NULL,
    due_amount NUMERIC DEFAULT NULL,
    due_date TEXT DEFAULT NULL,
    currency TEXT NOT NULL DEFAULT '₹',
    account_number_last4 TEXT DEFAULT NULL,
    bank_name TEXT DEFAULT NULL,
    color TEXT NOT NULL DEFAULT '#1E40AF',
    owner_email TEXT NOT NULL,
    shared_with JSONB NOT NULL DEFAULT '[]'::JSONB,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Loans and EMI Schedule Table
CREATE TABLE IF NOT EXISTS public.loans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    lender TEXT NOT NULL,
    total_principal NUMERIC NOT NULL DEFAULT 0,
    remaining_principal NUMERIC NOT NULL DEFAULT 0,
    interest_rate NUMERIC NOT NULL DEFAULT 0,
    monthly_emi NUMERIC NOT NULL DEFAULT 0,
    total_tenure_months INTEGER NOT NULL DEFAULT 12,
    paid_tenure_months INTEGER NOT NULL DEFAULT 0,
    linked_account_id TEXT REFERENCES public.accounts(id) ON DELETE SET NULL,
    start_date TEXT NOT NULL DEFAULT CURRENT_DATE::TEXT,
    next_due_date TEXT NOT NULL DEFAULT CURRENT_DATE::TEXT,
    category TEXT NOT NULL DEFAULT 'General',
    notes TEXT DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'foreclosed')),
    user_email TEXT NOT NULL DEFAULT '',
    owner_email TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Groups & Shared Bill Splitting Table
CREATE TABLE IF NOT EXISTS public.groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Trip',
    avatar_color TEXT NOT NULL DEFAULT '#0EA5E9',
    currency TEXT NOT NULL DEFAULT '₹',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_DATE::TEXT,
    members JSONB NOT NULL DEFAULT '[]'::JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Group Activity Logs (Timeline feed)
CREATE TABLE IF NOT EXISTS public.group_activity_logs (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_email TEXT DEFAULT '',
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    details JSONB DEFAULT '{}'::JSONB
);

-- Friends & Direct Debt Balances Table
CREATE TABLE IF NOT EXISTS public.friends (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT NULL,
    avatar_color TEXT NOT NULL DEFAULT '#10B981',
    net_balance NUMERIC NOT NULL DEFAULT 0,
    last_activity TEXT NOT NULL DEFAULT CURRENT_DATE::TEXT,
    user_email TEXT NOT NULL DEFAULT '',
    owner_email TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions Ledger Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL DEFAULT CURRENT_DATE::TEXT,
    time TEXT DEFAULT NULL,
    title TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer', 'settlement', 'emi_payment')),
    account_id TEXT REFERENCES public.accounts(id) ON DELETE SET NULL,
    to_account_id TEXT DEFAULT NULL,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    notes TEXT DEFAULT NULL,
    emi_id TEXT REFERENCES public.loans(id) ON DELETE SET NULL,
    group_id TEXT REFERENCES public.groups(id) ON DELETE SET NULL,
    paid_by_member_id TEXT DEFAULT NULL,
    split_details JSONB DEFAULT '[]'::JSONB,
    created_by TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transaction Rules Engine Table
CREATE TABLE IF NOT EXISTS public.rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    keyword TEXT DEFAULT NULL,
    keywords JSONB NOT NULL DEFAULT '[]'::JSONB,
    match_type TEXT NOT NULL DEFAULT 'contains_any',
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    account_id TEXT REFERENCES public.accounts(id) ON DELETE SET NULL,
    transaction_type TEXT DEFAULT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    match_count INTEGER NOT NULL DEFAULT 0,
    user_email TEXT DEFAULT NULL,
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Category Budgets Table
CREATE TABLE IF NOT EXISTS public.budgets (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    category_id TEXT REFERENCES public.categories(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    limit_amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. CHECK & ADD MISSING COLUMNS (SAFE IDEMPOTENT MIGRATIONS)
-- ==============================================================================

-- Profiles columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'User';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT '₹';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_color TEXT NOT NULL DEFAULT '#3B82F6';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT '+91';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC DEFAULT 50000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Categories columns
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'Utensils';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#3B82F6';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS budget_limit NUMERIC DEFAULT NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS user_email TEXT DEFAULT NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Accounts columns
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'bank';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS balance NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS due_amount NUMERIC DEFAULT NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS due_date TEXT DEFAULT NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT '₹';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS account_number_last4 TEXT DEFAULT NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS bank_name TEXT DEFAULT NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#1E40AF';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS owner_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS shared_with JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Loans columns
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS total_principal NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS remaining_principal NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS interest_rate NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS monthly_emi NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS total_tenure_months INTEGER NOT NULL DEFAULT 12;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS paid_tenure_months INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS linked_account_id TEXT REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS start_date TEXT NOT NULL DEFAULT CURRENT_DATE::TEXT;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS next_due_date TEXT NOT NULL DEFAULT CURRENT_DATE::TEXT;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS user_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS owner_email TEXT DEFAULT '';
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Groups columns
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Trip';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS avatar_color TEXT NOT NULL DEFAULT '#0EA5E9';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT '₹';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT '';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_at TEXT NOT NULL DEFAULT CURRENT_DATE::TEXT;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS members JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Group Activity Logs columns
ALTER TABLE public.group_activity_logs ADD COLUMN IF NOT EXISTS actor_email TEXT DEFAULT '';
ALTER TABLE public.group_activity_logs ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '';
ALTER TABLE public.group_activity_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.group_activity_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::JSONB;

-- Friends columns
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT NULL;
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS avatar_color TEXT NOT NULL DEFAULT '#10B981';
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS net_balance NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS last_activity TEXT NOT NULL DEFAULT CURRENT_DATE::TEXT;
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS user_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS owner_email TEXT DEFAULT '';
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Transactions columns
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS date TEXT NOT NULL DEFAULT CURRENT_DATE::TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS time TEXT DEFAULT NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS to_account_id TEXT DEFAULT NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS emi_id TEXT REFERENCES public.loans(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS group_id TEXT REFERENCES public.groups(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS paid_by_member_id TEXT DEFAULT NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS split_details JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT '';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Rules columns
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS keyword TEXT DEFAULT NULL;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS keywords JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS match_type TEXT NOT NULL DEFAULT 'contains_any';
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS account_id TEXT REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT NULL;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS match_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS user_email TEXT DEFAULT NULL;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Budgets columns
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS user_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES public.categories(id) ON DELETE CASCADE;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS month INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS year INTEGER NOT NULL DEFAULT 2026;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS limit_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ==============================================================================
-- 4. PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_account ON public.transactions (to_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_group ON public.transactions (group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON public.transactions (created_by);
CREATE INDEX IF NOT EXISTS idx_group_logs_group ON public.group_activity_logs (group_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_owner ON public.accounts (owner_email);
CREATE INDEX IF NOT EXISTS idx_loans_user ON public.loans (user_email);
CREATE INDEX IF NOT EXISTS idx_friends_user ON public.friends (user_email);
CREATE INDEX IF NOT EXISTS idx_rules_user ON public.rules (user_email);
CREATE INDEX IF NOT EXISTS idx_rules_active ON public.rules (is_active);
CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories (user_email);
CREATE INDEX IF NOT EXISTS idx_budgets_user_period ON public.budgets (user_email, year, month);

-- ==============================================================================
-- 5. POSTGRESQL FUNCTIONS & TRIGGERS
-- ==============================================================================

-- 5.1 Auto-update updated_at Timestamp Trigger Function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at Triggers (Idempotent: drop before recreate)
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_loans_updated_at ON public.loans;
CREATE TRIGGER trg_loans_updated_at
    BEFORE UPDATE ON public.loans
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_groups_updated_at ON public.groups;
CREATE TRIGGER trg_groups_updated_at
    BEFORE UPDATE ON public.groups
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_friends_updated_at ON public.friends;
CREATE TRIGGER trg_friends_updated_at
    BEFORE UPDATE ON public.friends
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_rules_updated_at ON public.rules;
CREATE TRIGGER trg_rules_updated_at
    BEFORE UPDATE ON public.rules
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_budgets_updated_at ON public.budgets;
CREATE TRIGGER trg_budgets_updated_at
    BEFORE UPDATE ON public.budgets
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5.2 RPC Function: Financial Summary for a User
CREATE OR REPLACE FUNCTION public.get_user_financial_summary(p_user_email text)
RETURNS JSON AS $$
DECLARE
    v_norm_email text := LOWER(TRIM(p_user_email));
    v_total_balance numeric := 0;
    v_total_credit_due numeric := 0;
    v_total_loans_remaining numeric := 0;
    v_monthly_emi_total numeric := 0;
    v_friends_owed numeric := 0;
    v_friends_owe_me numeric := 0;
    v_total_expenses_month numeric := 0;
    v_total_income_month numeric := 0;
    v_current_month text := TO_CHAR(NOW(), 'YYYY-MM');
BEGIN
    -- Accounts Balance & Credit Card Dues
    SELECT 
        COALESCE(SUM(CASE WHEN type != 'credit_card' THEN balance ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'credit_card' THEN COALESCE(due_amount, 0) ELSE 0 END), 0)
    INTO v_total_balance, v_total_credit_due
    FROM public.accounts
    WHERE LOWER(owner_email) = v_norm_email AND is_archived = false;

    -- Active Loans & EMIs
    SELECT 
        COALESCE(SUM(remaining_principal), 0),
        COALESCE(SUM(monthly_emi), 0)
    INTO v_total_loans_remaining, v_monthly_emi_total
    FROM public.loans
    WHERE (LOWER(user_email) = v_norm_email OR LOWER(owner_email) = v_norm_email)
      AND status = 'active';

    -- Friends Net Balances
    SELECT 
        COALESCE(SUM(CASE WHEN net_balance > 0 THEN net_balance ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN net_balance < 0 THEN ABS(net_balance) ELSE 0 END), 0)
    INTO v_friends_owe_me, v_friends_owed
    FROM public.friends
    WHERE (LOWER(user_email) = v_norm_email OR LOWER(owner_email) = v_norm_email);

    -- Current Month's Income and Expenses
    SELECT 
        COALESCE(SUM(CASE WHEN type IN ('expense', 'emi_payment') THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)
    INTO v_total_expenses_month, v_total_income_month
    FROM public.transactions
    WHERE LOWER(created_by) = v_norm_email 
      AND date LIKE (v_current_month || '%');

    RETURN json_build_object(
        'total_balance', v_total_balance,
        'total_credit_due', v_total_credit_due,
        'total_loans_remaining', v_total_loans_remaining,
        'monthly_emi_total', v_monthly_emi_total,
        'friends_owe_me', v_friends_owe_me,
        'friends_owed', v_friends_owed,
        'total_expenses_month', v_total_expenses_month,
        'total_income_month', v_total_income_month,
        'net_savings_month', (v_total_income_month - v_total_expenses_month)
    );
END;
$$ LANGUAGE plpgsql;

-- 5.3 Helper Function: Match Transaction Title with Automation Rules
CREATE OR REPLACE FUNCTION public.match_transaction_rule(p_title text)
RETURNS TABLE (
    rule_id text,
    category_id text,
    account_id text,
    transaction_type text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id AS rule_id,
        r.category_id,
        r.account_id,
        r.transaction_type
    FROM public.rules r
    WHERE (r.is_active = true OR r.is_enabled = true)
      AND (
        (r.keyword IS NOT NULL AND LOWER(p_title) LIKE '%' || LOWER(r.keyword) || '%')
        OR
        (r.keywords IS NOT NULL AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(r.keywords) kw
            WHERE LOWER(p_title) LIKE '%' || LOWER(kw) || '%'
        ))
      )
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) & ACCESS POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Per-user policies. Everything below is idempotent: it drops any previous policies on
-- these tables (including the old "Allow all access" ones) and recreates them.
-- Anonymous (not signed-in) requests get no rows at all.
-- ------------------------------------------------------------------------------
-- 6.0 HELPER FUNCTIONS (SECURITY INVOKER: they always run with the caller's rights)
-- ------------------------------------------------------------------------------
-- The signed-in user's verified email, taken from the Supabase Auth JWT.
-- Returns '' when there is no signed-in user (anon key only), which matches nothing.
CREATE OR REPLACE FUNCTION public.current_email()
RETURNS text
LANGUAGE sql STABLE
AS $$
    SELECT lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
$$;

-- True when a JSONB array of objects contains an entry whose p_key equals p_email
-- (case-insensitive) and, optionally, whose "role" is one of p_roles.
CREATE OR REPLACE FUNCTION public.jsonb_has_email(
    p_arr jsonb,
    p_email text,
    p_key text DEFAULT 'email',
    p_roles text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
    SELECT coalesce(p_email, '') <> '' AND
        CASE WHEN jsonb_typeof(p_arr) = 'array' THEN
            EXISTS (
                SELECT 1 FROM jsonb_array_elements(p_arr) e
                WHERE jsonb_typeof(e) = 'object'
                  AND lower(btrim(coalesce(e ->> p_key, ''))) = p_email
                  AND (p_roles IS NULL OR (e ->> 'role') = ANY (p_roles))
            )
        ELSE false END
$$;

-- Owner, or shared with role edit/admin: may create/edit/delete transactions on the account.
CREATE OR REPLACE FUNCTION public.can_transact_account(p_account_id text)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.id = p_account_id
          AND (
              lower(btrim(a.owner_email)) = public.current_email()
              OR public.jsonb_has_email(a.shared_with, public.current_email(), 'email', ARRAY['edit', 'admin'])
          )
    )
$$;


-- The next three are used by the INSERT policies. The app saves with upsert
-- (INSERT ... ON CONFLICT DO UPDATE) and Postgres checks the INSERT policy on the
-- proposed row even when it turns into an UPDATE. So an editor/member saving a record
-- someone else created must be allowed when that record already exists and is theirs to edit.
CREATE OR REPLACE FUNCTION public.group_visible(p_id text)
RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT EXISTS (SELECT 1 FROM public.groups g WHERE g.id = p_id) $$;

CREATE OR REPLACE FUNCTION public.account_editable(p_id text)
RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT public.can_transact_account(p_id) $$;

CREATE OR REPLACE FUNCTION public.transaction_editable(p_id text)
RETURNS boolean LANGUAGE sql STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.id = p_id
          AND (lower(btrim(t.created_by)) = public.current_email()
               OR (t.account_id IS NOT NULL AND public.can_transact_account(t.account_id)))
    )
$$;

-- ------------------------------------------------------------------------------
-- 6.1 REMOVE EVERY EXISTING POLICY ON THE APP TABLES
-- (permissive policies are OR-ed together, so one leftover "allow all" would
--  silently cancel every rule below)
-- ------------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT policyname, tablename FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('profiles', 'categories', 'accounts', 'loans', 'groups',
                            'group_activity_logs', 'friends', 'transactions', 'rules', 'budgets')
    LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 6.2 POLICIES (authenticated users only; the anon role gets no rows at all)
-- ------------------------------------------------------------------------------

-- PROFILES: you can only see and change your own profile.
-- (Looking up other people goes through the lookup RPCs in 6.5.)
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid())::text OR lower(btrim(email)) = (SELECT public.current_email()));
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated
    WITH CHECK (lower(btrim(email)) = (SELECT public.current_email()));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid())::text OR lower(btrim(email)) = (SELECT public.current_email()))
    WITH CHECK (lower(btrim(email)) = (SELECT public.current_email()));
CREATE POLICY profiles_delete ON public.profiles FOR DELETE TO authenticated
    USING (id = (SELECT auth.uid())::text OR lower(btrim(email)) = (SELECT public.current_email()));

-- CATEGORIES: everyone can read global templates and legacy unscoped rows,
-- but you can only write your own.
CREATE POLICY categories_select ON public.categories FOR SELECT TO authenticated
    USING (is_global = true OR user_email IS NULL OR lower(btrim(user_email)) = (SELECT public.current_email()));
CREATE POLICY categories_insert ON public.categories FOR INSERT TO authenticated
    WITH CHECK (lower(btrim(user_email)) = (SELECT public.current_email()));
CREATE POLICY categories_update ON public.categories FOR UPDATE TO authenticated
    USING (lower(btrim(user_email)) = (SELECT public.current_email()))
    WITH CHECK (lower(btrim(user_email)) = (SELECT public.current_email()));
CREATE POLICY categories_delete ON public.categories FOR DELETE TO authenticated
    USING (lower(btrim(user_email)) = (SELECT public.current_email()));

-- RULES: same model as categories.
CREATE POLICY rules_select ON public.rules FOR SELECT TO authenticated
    USING (is_global = true OR user_email IS NULL OR lower(btrim(user_email)) = (SELECT public.current_email()));
CREATE POLICY rules_insert ON public.rules FOR INSERT TO authenticated
    WITH CHECK (lower(btrim(user_email)) = (SELECT public.current_email()));
CREATE POLICY rules_update ON public.rules FOR UPDATE TO authenticated
    USING (lower(btrim(user_email)) = (SELECT public.current_email()))
    WITH CHECK (lower(btrim(user_email)) = (SELECT public.current_email()));
CREATE POLICY rules_delete ON public.rules FOR DELETE TO authenticated
    USING (lower(btrim(user_email)) = (SELECT public.current_email()));

-- BUDGETS: private to the owner.
CREATE POLICY budgets_all ON public.budgets FOR ALL TO authenticated
    USING (lower(btrim(user_email)) = (SELECT public.current_email()))
    WITH CHECK (lower(btrim(user_email)) = (SELECT public.current_email()));

-- LOANS: private to the owner.
CREATE POLICY loans_all ON public.loans FOR ALL TO authenticated
    USING (lower(btrim(user_email)) = (SELECT public.current_email())
        OR lower(btrim(owner_email)) = (SELECT public.current_email()))
    WITH CHECK (lower(btrim(user_email)) = (SELECT public.current_email())
        OR lower(btrim(owner_email)) = (SELECT public.current_email()));

-- ACCOUNTS: owner, plus anyone listed in shared_with.
-- view = read only, edit/admin = may update, only the owner may delete.
CREATE POLICY accounts_select ON public.accounts FOR SELECT TO authenticated
    USING (lower(btrim(owner_email)) = (SELECT public.current_email())
        OR public.jsonb_has_email(shared_with, (SELECT public.current_email())));
CREATE POLICY accounts_insert ON public.accounts FOR INSERT TO authenticated
    WITH CHECK (lower(btrim(owner_email)) = (SELECT public.current_email())
        OR public.account_editable(id));
CREATE POLICY accounts_update ON public.accounts FOR UPDATE TO authenticated
    USING (lower(btrim(owner_email)) = (SELECT public.current_email())
        OR public.jsonb_has_email(shared_with, (SELECT public.current_email()), 'email', ARRAY['edit', 'admin']))
    WITH CHECK (lower(btrim(owner_email)) = (SELECT public.current_email())
        OR public.jsonb_has_email(shared_with, (SELECT public.current_email()), 'email', ARRAY['edit', 'admin']));
CREATE POLICY accounts_delete ON public.accounts FOR DELETE TO authenticated
    USING (lower(btrim(owner_email)) = (SELECT public.current_email()));

-- GROUPS: creator and listed members. Any member may update (add expenses, add or
-- leave members). Only the creator or a group admin may delete.
CREATE POLICY groups_select ON public.groups FOR SELECT TO authenticated
    USING (lower(btrim(created_by)) = (SELECT public.current_email())
        OR public.jsonb_has_email(members, (SELECT public.current_email())));
CREATE POLICY groups_insert ON public.groups FOR INSERT TO authenticated
    WITH CHECK (lower(btrim(created_by)) = (SELECT public.current_email())
        OR public.group_visible(id));
CREATE POLICY groups_update ON public.groups FOR UPDATE TO authenticated
    USING (lower(btrim(created_by)) = (SELECT public.current_email())
        OR public.jsonb_has_email(members, (SELECT public.current_email())))
    WITH CHECK (true);  -- created_by is protected by a trigger below; leaving uses leave_group()
CREATE POLICY groups_delete ON public.groups FOR DELETE TO authenticated
    USING (lower(btrim(created_by)) = (SELECT public.current_email())
        OR public.jsonb_has_email(members, (SELECT public.current_email()), 'email', ARRAY['admin']));

-- GROUP ACTIVITY LOGS: visible to / writable by anyone who can see the group.
CREATE POLICY group_logs_select ON public.group_activity_logs FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_activity_logs.group_id));
CREATE POLICY group_logs_insert ON public.group_activity_logs FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_activity_logs.group_id));

-- FRIENDS: your own rows, plus the mirror rows other people keep about you
-- (email = you), which the app uses to keep both sides of a debt in sync.
CREATE POLICY friends_select ON public.friends FOR SELECT TO authenticated
    USING (lower(btrim(user_email)) = (SELECT public.current_email())
        OR lower(btrim(owner_email)) = (SELECT public.current_email())
        OR lower(btrim(email)) = (SELECT public.current_email()));
CREATE POLICY friends_insert ON public.friends FOR INSERT TO authenticated
    WITH CHECK (lower(btrim(user_email)) = (SELECT public.current_email())
        OR lower(btrim(owner_email)) = (SELECT public.current_email())
        OR lower(btrim(email)) = (SELECT public.current_email()));
CREATE POLICY friends_update ON public.friends FOR UPDATE TO authenticated
    USING (lower(btrim(user_email)) = (SELECT public.current_email())
        OR lower(btrim(owner_email)) = (SELECT public.current_email())
        OR lower(btrim(email)) = (SELECT public.current_email()))
    WITH CHECK (lower(btrim(user_email)) = (SELECT public.current_email())
        OR lower(btrim(owner_email)) = (SELECT public.current_email())
        OR lower(btrim(email)) = (SELECT public.current_email()));
CREATE POLICY friends_delete ON public.friends FOR DELETE TO authenticated
    USING (lower(btrim(user_email)) = (SELECT public.current_email())
        OR lower(btrim(owner_email)) = (SELECT public.current_email())
        OR lower(btrim(email)) = (SELECT public.current_email()));

-- TRANSACTIONS: same visibility the app already applies in the browser:
-- you created it, you can access its account, or you are named in its split.
CREATE POLICY transactions_select ON public.transactions FOR SELECT TO authenticated
    USING (
        lower(btrim(created_by)) = (SELECT public.current_email())
        OR public.jsonb_has_email(split_details, (SELECT public.current_email()), 'memberEmail')
        OR EXISTS (SELECT 1 FROM public.accounts a
                   WHERE a.id = transactions.account_id OR a.id = transactions.to_account_id)
    );
CREATE POLICY transactions_insert ON public.transactions FOR INSERT TO authenticated
    WITH CHECK (
        (lower(btrim(created_by)) = (SELECT public.current_email())
         AND (account_id IS NULL OR public.can_transact_account(account_id)))
        OR public.transaction_editable(id)
    );
CREATE POLICY transactions_update ON public.transactions FOR UPDATE TO authenticated
    USING (
        lower(btrim(created_by)) = (SELECT public.current_email())
        OR (account_id IS NOT NULL AND public.can_transact_account(account_id))
    )
    WITH CHECK (
        lower(btrim(created_by)) = (SELECT public.current_email())
        OR (account_id IS NOT NULL AND public.can_transact_account(account_id))
    );
CREATE POLICY transactions_delete ON public.transactions FOR DELETE TO authenticated
    USING (
        lower(btrim(created_by)) = (SELECT public.current_email())
        OR (account_id IS NOT NULL AND public.can_transact_account(account_id))
    );

-- ------------------------------------------------------------------------------
-- 6.3 GUARD TRIGGERS (RLS cannot restrict individual columns, these do)
-- Requests without a user email (service role, SQL editor) are not restricted.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_account_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE me text := public.current_email();
BEGIN
    IF me = '' OR lower(btrim(OLD.owner_email)) = me THEN
        RETURN NEW;
    END IF;
    IF NEW.owner_email IS DISTINCT FROM OLD.owner_email THEN
        RAISE EXCEPTION 'Only the account owner can change ownership';
    END IF;
    IF NEW.shared_with IS DISTINCT FROM OLD.shared_with
       AND NOT public.jsonb_has_email(OLD.shared_with, me, 'email', ARRAY['admin']) THEN
        RAISE EXCEPTION 'Only the owner or an admin can change who an account is shared with';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_account_update ON public.accounts;
CREATE TRIGGER trg_guard_account_update BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.guard_account_update();

CREATE OR REPLACE FUNCTION public.guard_group_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF public.current_email() <> '' THEN
        NEW.created_by := OLD.created_by;  -- nobody can take over or reassign a group
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_group_update ON public.groups;
CREATE TRIGGER trg_guard_group_update BEFORE UPDATE ON public.groups
    FOR EACH ROW EXECUTE FUNCTION public.guard_group_update();

CREATE OR REPLACE FUNCTION public.guard_transaction_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF public.current_email() <> '' THEN
        NEW.created_by := OLD.created_by;  -- the author of a transaction cannot be rewritten
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_transaction_update ON public.transactions;
CREATE TRIGGER trg_guard_transaction_update BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.guard_transaction_update();

-- ------------------------------------------------------------------------------
-- 6.4 LOCK DOWN THE SECURITY DEFINER SUMMARY FUNCTION
-- It used to bypass RLS and trusted a caller-supplied email, so anyone could read
-- anyone's financial summary. It now runs with the caller's rights (RLS applies)
-- and is not callable without signing in.
-- ------------------------------------------------------------------------------
ALTER FUNCTION public.get_user_financial_summary(text) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.get_user_financial_summary(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_financial_summary(text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6.5 SAFE CROSS-USER LOOKUPS (replace direct reads of other people's profiles)
-- ------------------------------------------------------------------------------
-- Find ONE person by exact email or by 10-digit phone number (for "add friend").
CREATE OR REPLACE FUNCTION public.lookup_profile(p_query text)
RETURNS TABLE (name text, email text, avatar_color text, phone text, country_code text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT p.name, p.email, p.avatar_color, p.phone, p.country_code
    FROM public.profiles p
    WHERE auth.uid() IS NOT NULL
      AND p_query IS NOT NULL
      AND (
          lower(btrim(p.email)) = lower(btrim(p_query))
          OR (
              length(regexp_replace(p_query, '[^0-9]', '', 'g')) >= 10
              AND right(regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g'), 10)
                  = right(regexp_replace(p_query, '[^0-9]', '', 'g'), 10)
          )
      )
    LIMIT 1
$$;

-- Display names / avatars for people you already have a friend link with (either direction).
CREATE OR REPLACE FUNCTION public.get_friend_profiles(p_emails text[])
RETURNS TABLE (email text, name text, avatar_color text, phone text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT p.email, p.name, p.avatar_color, p.phone
    FROM public.profiles p
    WHERE auth.uid() IS NOT NULL
      AND lower(btrim(p.email)) IN (SELECT lower(btrim(e)) FROM unnest(p_emails) AS e)
      AND (
          lower(btrim(p.email)) = public.current_email()
          OR EXISTS (
              SELECT 1 FROM public.friends f
              WHERE (lower(btrim(f.user_email)) = public.current_email() AND lower(btrim(f.email)) = lower(btrim(p.email)))
                 OR (lower(btrim(f.email)) = public.current_email() AND lower(btrim(f.user_email)) = lower(btrim(p.email)))
          )
      )
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_profile(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_friend_profiles(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_profile(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_profiles(text[]) TO authenticated;


-- A member who removes THEMSELVES can no longer see the group afterwards, and Postgres
-- rejects an UPDATE whose result the caller could not read. This function does it safely.
CREATE OR REPLACE FUNCTION public.leave_group(p_group_id text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE me text := public.current_email();
BEGIN
    IF me = '' THEN
        RETURN false;
    END IF;
    UPDATE public.groups g
    SET members = coalesce(
        (SELECT jsonb_agg(m) FROM jsonb_array_elements(g.members) m
         WHERE lower(btrim(coalesce(m ->> 'email', ''))) <> me), '[]'::jsonb)
    WHERE g.id = p_group_id AND public.jsonb_has_email(g.members, me);
    RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.leave_group(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_group(text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6.6 CREATE THE PROFILE ROW AUTOMATICALLY ON SIGN-UP
-- With email confirmation on, sign-up returns no session, so the browser cannot
-- insert the profile itself under RLS. The sign-up form already sends name,
-- currency, avatar_color and monthly_budget as user metadata; this uses them.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_budget text := NEW.raw_user_meta_data ->> 'monthly_budget';
BEGIN
    IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
        RETURN NEW;
    END IF;
    INSERT INTO public.profiles (id, name, email, currency, avatar_color, monthly_budget)
    VALUES (
        NEW.id::text,
        left(coalesce(nullif(btrim(NEW.raw_user_meta_data ->> 'name'), ''), split_part(NEW.email, '@', 1), 'User'), 100),
        lower(btrim(NEW.email)),
        left(coalesce(nullif(NEW.raw_user_meta_data ->> 'currency', ''), '₹'), 8),
        left(coalesce(nullif(NEW.raw_user_meta_data ->> 'avatar_color', ''), '#3B82F6'), 16),
        CASE WHEN v_budget ~ '^[0-9]{1,12}([.][0-9]+)?$' THEN v_budget::numeric ELSE 50000 END
    )
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ==============================================================================
-- 7. SEED DEFAULT UNIVERSAL CATEGORIES & RULES (GLOBAL TEMPLATES)
-- ==============================================================================
INSERT INTO public.categories (id, name, icon, color, type, budget_limit, parent_id, is_global, user_email)
VALUES 
    -- Main Categories
    ('cat-1', 'Food & Dining', 'Utensils', '#F97316', 'expense', 12000, NULL, true, NULL),
    ('cat-2', 'Shopping & Electronics', 'ShoppingBag', '#8B5CF6', 'expense', 8000, NULL, true, NULL),
    ('cat-3', 'Housing & Rent', 'Home', '#EC4899', 'expense', 20000, NULL, true, NULL),
    ('cat-4', 'Transport & Fuel', 'Car', '#06B6D4', 'expense', 5000, NULL, true, NULL),
    ('cat-5', 'Entertainment & Trips', 'Film', '#EAB308', 'expense', 4000, NULL, true, NULL),
    ('cat-6', 'EMI & Loan Repayment', 'CreditCard', '#EF4444', 'expense', NULL, NULL, true, NULL),
    ('cat-7', 'Utilities & Bills', 'Zap', '#10B981', 'expense', 3500, NULL, true, NULL),
    ('cat-8', 'Salary & Invoicing', 'Briefcase', '#22C55E', 'income', NULL, NULL, true, NULL),
    ('cat-9', 'Investments & Returns', 'TrendingUp', '#6366F1', 'income', NULL, NULL, true, NULL),
    ('cat-10', 'Friend Settlement', 'Users', '#64748B', 'expense', NULL, NULL, true, NULL),

    -- Subcategories for Food & Dining
    ('cat-1-1', 'Groceries & Provisions', 'ShoppingBag', '#F97316', 'expense', 6000, 'cat-1', true, NULL),
    ('cat-1-2', 'Restaurants & Dining Out', 'Coffee', '#FB923C', 'expense', 4000, 'cat-1', true, NULL),
    ('cat-1-3', 'Online Food Delivery', 'Utensils', '#EA580C', 'expense', 2000, 'cat-1', true, NULL),

    -- Subcategories for Shopping
    ('cat-2-1', 'Clothing & Footwear', 'Shirt', '#8B5CF6', 'expense', NULL, 'cat-2', true, NULL),
    ('cat-2-2', 'Electronics & Gadgets', 'Smartphone', '#A855F7', 'expense', NULL, 'cat-2', true, NULL),

    -- Subcategories for Housing
    ('cat-3-1', 'Rent & Lease', 'Home', '#EC4899', 'expense', NULL, 'cat-3', true, NULL),
    ('cat-3-2', 'Home Maintenance & Repair', 'Wrench', '#F43F5E', 'expense', NULL, 'cat-3', true, NULL),

    -- Subcategories for Transport
    ('cat-4-1', 'Fuel & Petrol', 'Fuel', '#06B6D4', 'expense', NULL, 'cat-4', true, NULL),
    ('cat-4-2', 'Cab & Auto (Uber/Ola)', 'Car', '#0891B2', 'expense', NULL, 'cat-4', true, NULL),
    ('cat-4-3', 'Public Transit & Metro', 'Bus', '#0EA5E9', 'expense', NULL, 'cat-4', true, NULL),

    -- Subcategories for Entertainment
    ('cat-5-1', 'Movies & Concerts', 'Film', '#EAB308', 'expense', NULL, 'cat-5', true, NULL),
    ('cat-5-2', 'Subscriptions & OTT', 'Tv', '#F59E0B', 'expense', NULL, 'cat-5', true, NULL),

    -- Subcategories for Utilities
    ('cat-7-1', 'Electricity & Water', 'Zap', '#10B981', 'expense', NULL, 'cat-7', true, NULL),
    ('cat-7-2', 'WiFi & Mobile Phone', 'Wifi', '#059669', 'expense', NULL, 'cat-7', true, NULL)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    type = EXCLUDED.type,
    parent_id = EXCLUDED.parent_id,
    is_global = true;

-- Seed default global rules template
INSERT INTO public.rules (id, name, keyword, match_type, category_id, is_active, is_enabled, is_global, user_email)
VALUES
    ('rule-global-1', 'Coffee & Cafes', 'starbucks, cafe, coffee, barista, dunkin, costa, blue tokai, third wave', 'contains', 'cat-1-2', true, true, true, NULL),
    ('rule-global-2', 'Rideshare & Taxis', 'uber, ola, lyft, grab, cab, taxi, rapido', 'contains', 'cat-4-2', true, true, true, NULL),
    ('rule-global-3', 'Food Delivery & Restaurants', 'swiggy, zomato, doordash, mcdonalds, dominos, pizza, burger, dining, restaurant, subway', 'contains', 'cat-1-3', true, true, true, NULL),
    ('rule-global-4', 'Online Shopping', 'amazon, flipkart, myntra, zara, ebay, ajio, meesho, target, walmart', 'contains', 'cat-2', true, true, true, NULL),
    ('rule-global-5', 'Entertainment & Streaming', 'netflix, spotify, prime video, hotstar, youtube, cinema, pvr, inox, movies, steam, playstation', 'contains', 'cat-5-2', true, true, true, NULL),
    ('rule-global-6', 'Groceries & Daily Essentials', 'grocery, blinkit, zepto, instamart, supermarket, bigbasket, nature basket, costco, traders joe', 'contains', 'cat-1-1', true, true, true, NULL),
    ('rule-global-7', 'Fuel & Gas Stations', 'shell, petrol, diesel, fuel, chevron, bp, exxon, gas station, indian oil, hpcl, bharat petroleum', 'contains', 'cat-4-1', true, true, true, NULL),
    ('rule-global-8', 'Salary & Earnings', 'salary, payroll, stipend, client payment, consulting fee, freelance payout, dividend', 'contains', 'cat-8', true, true, true, NULL),
    ('rule-global-9', 'Housing & Rent', 'rent, maintenance, landlord, apartment, society dues', 'contains', 'cat-3-1', true, true, true, NULL)
ON CONFLICT (id) DO NOTHING;
`;

export const SUPABASE_USER_SCOPING_MIGRATION_SQL = `-- ==============================================================================
-- SPENDWISE - DELTA SQL MIGRATION: SCOPE CATEGORIES, RULES & BUDGETS PER USER
-- ==============================================================================
-- Run this in your Supabase SQL Editor if you already have existing tables.
-- It safely adds parent_id, user_email and is_global columns and indexes.

-- 1. Add parent_id, user_email and is_global to Categories table
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES public.categories(id) ON DELETE CASCADE;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS user_email TEXT DEFAULT NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add user_email and is_global to Rules table
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS user_email TEXT DEFAULT NULL;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Ensure user_email column exists in Budgets table
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS user_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES public.categories(id) ON DELETE CASCADE;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS month INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS year INTEGER NOT NULL DEFAULT 2026;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS limit_amount NUMERIC NOT NULL DEFAULT 0;

-- 4. Create performance indexes for fast user-filtered queries
CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories (user_email);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_rules_user ON public.rules (user_email);
CREATE INDEX IF NOT EXISTS idx_budgets_user_period ON public.budgets (user_email, year, month);

-- 5. Mark initial seeded categories as global templates
UPDATE public.categories SET is_global = TRUE WHERE user_email IS NULL;
`;
