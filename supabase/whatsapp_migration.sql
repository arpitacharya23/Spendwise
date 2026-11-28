-- ==============================================================================
-- SPENDWISE WHATSAPP AI ASSISTANT - IDEMPOTENT SUPABASE MIGRATION
-- ==============================================================================
-- Adds WhatsApp verification metadata to profiles, OTP verification challenges,
-- per-user conversational session state, and webhook idempotency tracking.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_linked_at TIMESTAMPTZ DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_otp_challenges (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    phone_digits TEXT NOT NULL,
    display_phone TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    phone_digits TEXT NOT NULL,
    active_account_id TEXT DEFAULT NULL,
    active_account_name TEXT DEFAULT NULL,
    pending_confirmation JSONB DEFAULT NULL,
    pending_portfolio_scope JSONB DEFAULT NULL,
    history JSONB NOT NULL DEFAULT '[]'::JSONB,
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_processed_events (
    event_id TEXT PRIMARY KEY,
    user_email TEXT DEFAULT NULL,
    phone_digits TEXT DEFAULT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_phone ON public.profiles (whatsapp_phone);
CREATE INDEX IF NOT EXISTS idx_wa_otp_email ON public.whatsapp_otp_challenges (user_email, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conv_email ON public.whatsapp_conversations (user_email, phone_digits);

ALTER TABLE public.whatsapp_otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_processed_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wa_otp_owner_all ON public.whatsapp_otp_challenges;
CREATE POLICY wa_otp_owner_all ON public.whatsapp_otp_challenges FOR ALL TO authenticated
    USING (lower(btrim(user_email)) = (SELECT public.current_email()))
    WITH CHECK (lower(btrim(user_email)) = (SELECT public.current_email()));

DROP POLICY IF EXISTS wa_conv_owner_all ON public.whatsapp_conversations;
CREATE POLICY wa_conv_owner_all ON public.whatsapp_conversations FOR ALL TO authenticated
    USING (lower(btrim(user_email)) = (SELECT public.current_email()))
    WITH CHECK (lower(btrim(user_email)) = (SELECT public.current_email()));

DROP POLICY IF EXISTS wa_events_owner_select ON public.whatsapp_processed_events;
CREATE POLICY wa_events_owner_select ON public.whatsapp_processed_events FOR SELECT TO authenticated
    USING (lower(btrim(user_email)) = (SELECT public.current_email()));
