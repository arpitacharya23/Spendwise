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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

DO $$
BEGIN
    -- Profiles
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Allow all access to profiles') THEN
        CREATE POLICY "Allow all access to profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Categories
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Allow all access to categories') THEN
        CREATE POLICY "Allow all access to categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Accounts
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Allow all access to accounts') THEN
        CREATE POLICY "Allow all access to accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Loans
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'loans' AND policyname = 'Allow all access to loans') THEN
        CREATE POLICY "Allow all access to loans" ON public.loans FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Groups
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'groups' AND policyname = 'Allow all access to groups') THEN
        CREATE POLICY "Allow all access to groups" ON public.groups FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Group Activity Logs
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'group_activity_logs' AND policyname = 'Allow all access to group_activity_logs') THEN
        CREATE POLICY "Allow all access to group_activity_logs" ON public.group_activity_logs FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Friends
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'friends' AND policyname = 'Allow all access to friends') THEN
        CREATE POLICY "Allow all access to friends" ON public.friends FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Transactions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Allow all access to transactions') THEN
        CREATE POLICY "Allow all access to transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Rules
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rules' AND policyname = 'Allow all access to rules') THEN
        CREATE POLICY "Allow all access to rules" ON public.rules FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Budgets
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'budgets' AND policyname = 'Allow all access to budgets') THEN
        CREATE POLICY "Allow all access to budgets" ON public.budgets FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

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
