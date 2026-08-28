export const SUPABASE_SETUP_SQL = `-- ==============================================================================
-- SPENDWISE EXPENSE TRACKER & SPLITWISE - IDEMPOTENT SUPABASE POSTGRESQL SCHEMA
-- ==============================================================================
-- Run this entire script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query).
-- It will check for existing tables/columns and automatically add any missing tables,
-- columns, indexes, Row Level Security (RLS) policies, and default seeds without data loss.

-- 1. Enable Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. CREATE TABLES (IF NOT PRESENT)
-- ==============================================================================

-- User Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    currency TEXT NOT NULL DEFAULT '₹',
    avatar_color TEXT NOT NULL DEFAULT '#3B82F6',
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
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    budget_limit NUMERIC DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    total_principal NUMERIC NOT NULL,
    remaining_principal NUMERIC NOT NULL,
    interest_rate NUMERIC NOT NULL DEFAULT 0,
    monthly_emi NUMERIC NOT NULL,
    total_tenure_months INTEGER NOT NULL DEFAULT 12,
    paid_tenure_months INTEGER NOT NULL DEFAULT 0,
    linked_account_id TEXT REFERENCES public.accounts(id) ON DELETE SET NULL,
    start_date TEXT NOT NULL,
    next_due_date TEXT NOT NULL,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions Ledger Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL DEFAULT CURRENT_DATE::TEXT,
    title TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer', 'settlement', 'emi_payment')),
    account_id TEXT REFERENCES public.accounts(id) ON DELETE SET NULL,
    to_account_id TEXT DEFAULT NULL,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    notes TEXT DEFAULT NULL,
    emi_id TEXT REFERENCES public.loans(id) ON DELETE SET NULL,
    group_id TEXT REFERENCES public.groups(id) ON DELETE SET NULL,
    paid_by_member_id TEXT DEFAULT NULL,
    split_details JSONB DEFAULT '[]'::JSONB,
    created_by TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transaction Rules Engine Table
CREATE TABLE IF NOT EXISTS public.rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    keywords JSONB NOT NULL DEFAULT '[]'::JSONB,
    match_type TEXT NOT NULL DEFAULT 'contains_any' CHECK (match_type IN ('contains_any', 'contains_all', 'exact_match', 'starts_with', 'regex')),
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    account_id TEXT REFERENCES public.accounts(id) ON DELETE SET NULL,
    transaction_type TEXT DEFAULT NULL CHECK (transaction_type IN ('expense', 'income', 'transfer', 'settlement', 'emi_payment')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    match_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Budgets Table
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
-- 3. CHECK & ADD MISSING COLUMNS TO EXISTING TABLES (SAFE MIGRATION)
-- ==============================================================================

-- Profiles columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT '₹';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_color TEXT NOT NULL DEFAULT '#3B82F6';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC DEFAULT 50000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Categories columns
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'Utensils';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#3B82F6';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS budget_limit NUMERIC DEFAULT NULL;

-- Accounts columns
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS due_amount NUMERIC DEFAULT NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS due_date TEXT DEFAULT NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT '₹';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS account_number_last4 TEXT DEFAULT NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS bank_name TEXT DEFAULT NULL;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#1E40AF';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS shared_with JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Loans columns
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS user_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS owner_email TEXT DEFAULT '';
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS interest_rate NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS total_tenure_months INTEGER NOT NULL DEFAULT 12;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS paid_tenure_months INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS linked_account_id TEXT REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Groups columns
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Trip';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS avatar_color TEXT NOT NULL DEFAULT '#0EA5E9';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT '₹';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS members JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Group Activity Logs columns
ALTER TABLE public.group_activity_logs ADD COLUMN IF NOT EXISTS actor_email TEXT DEFAULT '';
ALTER TABLE public.group_activity_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::JSONB;

-- Friends columns
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT NULL;
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS avatar_color TEXT NOT NULL DEFAULT '#10B981';
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS net_balance NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS last_activity TEXT NOT NULL DEFAULT CURRENT_DATE::TEXT;
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS user_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS owner_email TEXT DEFAULT '';

-- Transactions columns
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS to_account_id TEXT DEFAULT NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS emi_id TEXT REFERENCES public.loans(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS group_id TEXT REFERENCES public.groups(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS paid_by_member_id TEXT DEFAULT NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS split_details JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Rules columns
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS keywords JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS match_type TEXT NOT NULL DEFAULT 'contains_any';
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS account_id TEXT REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT NULL;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS match_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ==============================================================================
-- 4. PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_group ON public.transactions (group_id);
CREATE INDEX IF NOT EXISTS idx_group_logs_group ON public.group_activity_logs (group_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_loans_user ON public.loans (user_email);
CREATE INDEX IF NOT EXISTS idx_friends_user ON public.friends (user_email);
CREATE INDEX IF NOT EXISTS idx_rules_active ON public.rules (is_active);

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) & ACCESS POLICIES
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
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Allow all access to profiles') THEN
        CREATE POLICY "Allow all access to profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Allow all access to categories') THEN
        CREATE POLICY "Allow all access to categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Allow all access to accounts') THEN
        CREATE POLICY "Allow all access to accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'loans' AND policyname = 'Allow all access to loans') THEN
        CREATE POLICY "Allow all access to loans" ON public.loans FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'groups' AND policyname = 'Allow all access to groups') THEN
        CREATE POLICY "Allow all access to groups" ON public.groups FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'group_activity_logs' AND policyname = 'Allow all access to group_activity_logs') THEN
        CREATE POLICY "Allow all access to group_activity_logs" ON public.group_activity_logs FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'friends' AND policyname = 'Allow all access to friends') THEN
        CREATE POLICY "Allow all access to friends" ON public.friends FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Allow all access to transactions') THEN
        CREATE POLICY "Allow all access to transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rules' AND policyname = 'Allow all access to rules') THEN
        CREATE POLICY "Allow all access to rules" ON public.rules FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'budgets' AND policyname = 'Allow all access to budgets') THEN
        CREATE POLICY "Allow all access to budgets" ON public.budgets FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ==============================================================================
-- 6. SEED DEFAULT CATEGORIES
-- ==============================================================================
INSERT INTO public.categories (id, name, icon, color, type, budget_limit)
VALUES 
    ('cat-1', 'Food & Dining', 'Utensils', '#F97316', 'expense', 12000),
    ('cat-2', 'Shopping & Electronics', 'ShoppingBag', '#8B5CF6', 'expense', 8000),
    ('cat-3', 'Housing & Rent', 'Home', '#EC4899', 'expense', 20000),
    ('cat-4', 'Transport & Fuel', 'Car', '#06B6D4', 'expense', 5000),
    ('cat-5', 'Entertainment & Trips', 'Film', '#EAB308', 'expense', 4000),
    ('cat-6', 'EMI & Loan Repayment', 'CreditCard', '#EF4444', 'expense', NULL),
    ('cat-7', 'Utilities & Bills', 'Zap', '#10B981', 'expense', 3500),
    ('cat-8', 'Salary & Invoicing', 'Briefcase', '#22C55E', 'income', NULL),
    ('cat-9', 'Investments & Returns', 'TrendingUp', '#6366F1', 'income', NULL),
    ('cat-10', 'Friend Settlement', 'Users', '#64748B', 'expense', NULL)
ON CONFLICT (id) DO NOTHING;
`;
