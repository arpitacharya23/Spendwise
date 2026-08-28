-- ==============================================================================
-- SPENDWISE EXPENSE TRACKER & SPLITWISE - SUPABASE POSTGRESQL SCHEMA
-- ==============================================================================
-- Run this entire script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- to create all required tables, indexes, Row Level Security (RLS) policies, and seed data.

-- 1. Enable UUID Extension (if needed)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Profiles Table
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

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'Utensils',
    color TEXT NOT NULL DEFAULT '#3B82F6',
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    budget_limit NUMERIC DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Accounts Table (Bank accounts, Credit Cards, Cash, Investments)
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

-- 5. Loans and EMI Schedule Table
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

-- 6. Groups & Shared Bill Splitting Table
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

-- 7. Group Activity Logs (WhatsApp-style timeline feed)
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

-- 8. Friends & Direct Debt Balances Table
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

-- Migration support for existing databases
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS user_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS owner_email TEXT DEFAULT '';
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS user_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.friends ADD COLUMN IF NOT EXISTS owner_email TEXT DEFAULT '';

-- 9. Transactions Ledger Table
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

-- 10. Performance Indexes for Fast Lookups
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_group ON public.transactions (group_id);
CREATE INDEX IF NOT EXISTS idx_group_logs_group ON public.group_activity_logs (group_id, timestamp DESC);

-- 11. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 12. Create Permissive Access Policies (supports public API key access & authenticated users)
DO $$
BEGIN
    -- Profiles policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Allow all access to profiles') THEN
        CREATE POLICY "Allow all access to profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Categories policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Allow all access to categories') THEN
        CREATE POLICY "Allow all access to categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Accounts policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Allow all access to accounts') THEN
        CREATE POLICY "Allow all access to accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Loans policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'loans' AND policyname = 'Allow all access to loans') THEN
        CREATE POLICY "Allow all access to loans" ON public.loans FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Groups policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'groups' AND policyname = 'Allow all access to groups') THEN
        CREATE POLICY "Allow all access to groups" ON public.groups FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Group Activity Logs policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'group_activity_logs' AND policyname = 'Allow all access to group_activity_logs') THEN
        CREATE POLICY "Allow all access to group_activity_logs" ON public.group_activity_logs FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Friends policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'friends' AND policyname = 'Allow all access to friends') THEN
        CREATE POLICY "Allow all access to friends" ON public.friends FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Transactions policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Allow all access to transactions') THEN
        CREATE POLICY "Allow all access to transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 13. Seed Default Categories (if table is empty)
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
