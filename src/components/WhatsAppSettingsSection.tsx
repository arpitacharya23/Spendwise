import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Send,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  Sparkles,
  Phone,
  ShieldCheck,
  ArrowDownLeft,
  Loader2,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { UserProfile, Account, Transaction, LoanEMI } from '../types';
import { supabase } from '../lib/supabase';

interface KapsoConfigInfo {
  projectId: string;
  projectName: string;
  whatsappConfigId: string;
  phoneNumberId: string;
  connectedNumber: string;
  baseUrl: string;
  apiKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
}

interface ProfileBindingInfo {
  email: string;
  phoneDigits: string;
  displayPhone: string;
  defaultAccountId?: string;
  updatedAt: string;
}

interface WhatsAppInboxItem {
  id: string;
  messageId: string;
  from: string;
  contactName?: string;
  text: string;
  timestamp: string;
  source: 'webhook' | 'simulation' | 'kapso_sync';
  kind: 'transaction' | 'command' | 'message';
  parsedTx: {
    title: string;
    amount: number;
    type: 'expense' | 'income';
    accountHint?: string;
    defaultAccountId?: string;
    categoryHint?: string;
    date: string;
    time: string;
    notes: string;
  } | null;
  replySent: boolean;
  syncedToClient: boolean;
  matchedProfilePhone?: string | null;
}

interface WhatsAppSettingsSectionProps {
  user: UserProfile;
  accounts: Account[];
  transactions: Transaction[];
  loans: LoanEMI[];
  onSaveProfile: (updatedUser: UserProfile) => Promise<void> | void;
  onSyncNow?: () => Promise<void> | void;
}

const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91' },
  { code: '+1', label: '🇺🇸 +1' },
  { code: '+44', label: '🇬🇧 +44' },
  { code: '+61', label: '🇦🇺 +61' },
  { code: '+971', label: '🇦🇪 +971' },
  { code: '+65', label: '🇸🇬 +65' },
];

export const WhatsAppSettingsSection: React.FC<WhatsAppSettingsSectionProps> = ({
  user,
  accounts,
  transactions,
  loans,
  onSaveProfile,
  onSyncNow,
}) => {
  const [config, setConfig] = useState<KapsoConfigInfo>({
    projectId: 'd2e5058e-fd40-43c7-a180-23b0e085399e',
    projectName: 'SpendWise',
    whatsappConfigId: '163330a8-e3e1-4673-b1cb-626000d0c18b',
    phoneNumberId: '1561127940407191',
    connectedNumber: '+91 94188 32998',
    baseUrl: 'https://api.kapso.ai/meta/whatsapp',
    apiKeyConfigured: false,
    webhookSecretConfigured: false,
  });

  const [profileBinding, setProfileBinding] = useState<ProfileBindingInfo | null>(null);
  const [countryCode, setCountryCode] = useState(user.countryCode || '+91');
  const [profilePhone, setProfilePhone] = useState(user.phone || '');
  const [isEditingPhone, setIsEditingPhone] = useState(!user.phone);
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [phoneFeedback, setPhoneFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const defaultAccountStorageKey = `spendwise_wa_default_acc_${user.email.toLowerCase()}`;
  const [defaultAccountId, setDefaultAccountId] = useState<string>(() => {
    try {
      return localStorage.getItem(defaultAccountStorageKey) || accounts[0]?.id || '';
    } catch {
      return accounts[0]?.id || '';
    }
  });

  const [inboxItems, setInboxItems] = useState<WhatsAppInboxItem[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyFeedback, setVerifyFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // Send message state
  const attachedFullPhone = user.phone
    ? `${user.countryCode || '+91'}${user.phone}`.replace(/[^\d+]/g, '')
    : '+919418832998';
  const [recipient, setRecipient] = useState(attachedFullPhone);
  const [messageText, setMessageText] = useState(
    'Hello from SpendWise! Your Kapso WhatsApp integration is active.'
  );
  const [isSending, setIsSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // Inbound parser test state
  const [simText, setSimText] = useState('450 Starbucks Coffee');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simFeedback, setSimFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPullingMessages, setIsPullingMessages] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'webhook' | 'cli' | null>(null);

  useEffect(() => {
    setCountryCode(user.countryCode || '+91');
    setProfilePhone(user.phone || '');
    if (!user.phone) {
      setIsEditingPhone(true);
    }
    if (user.phone) {
      setRecipient(`${user.countryCode || '+91'}${user.phone}`.replace(/[^\d+]/g, ''));
    }
  }, [user.phone, user.countryCode]);

  useEffect(() => {
    if (!defaultAccountId && accounts.length > 0) {
      setDefaultAccountId(accounts[0].id);
    }
  }, [accounts, defaultAccountId]);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhooks/kapso`
      : '/api/webhooks/kapso';

  const cliCommand = `npx @kapso/cli whatsapp webhooks new --phone-number-id ${config.phoneNumberId} --url "${webhookUrl}" --event whatsapp.message.received --kind kapso --payload-version v2 --active`;

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchStatusAndInbox = useCallback(
    async (pullRemote = false) => {
      try {
        const headers = await getAuthHeaders();
        if (!headers.Authorization) {
          setIsLoadingStatus(false);
          return;
        }

        const [statusRes, msgRes] = await Promise.all([
          fetch('/api/v1/whatsapp/status', { headers }),
          fetch(`/api/v1/whatsapp/messages${pullRemote ? '?pull=true' : ''}`, { headers }),
        ]);

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData?.config) setConfig(statusData.config);
          setProfileBinding(statusData?.profileBinding || null);
        }

        if (msgRes.ok) {
          const msgData = await msgRes.json();
          setInboxItems(Array.isArray(msgData?.items) ? msgData.items : []);
          setPendingSyncCount(Number(msgData?.pendingSyncCount) || 0);
          if (msgData?.profileBinding !== undefined) {
            setProfileBinding(msgData.profileBinding);
          }
        }
      } catch (err) {
        console.warn('WhatsApp status fetch failed:', err);
      } finally {
        setIsLoadingStatus(false);
      }
    },
    [getAuthHeaders]
  );

  useEffect(() => {
    fetchStatusAndInbox(false);
    const onSynced = () => fetchStatusAndInbox(false);
    window.addEventListener('spendwise_whatsapp_synced', onSynced);
    return () => window.removeEventListener('spendwise_whatsapp_synced', onSynced);
  }, [fetchStatusAndInbox]);

  const handleSaveAttachedPhone = async (
    e: React.FormEvent,
    overrideDefaultAccId?: string
  ) => {
    e.preventDefault();
    const cleanPhone = profilePhone.trim();
    const digits = cleanPhone.replace(/[^\d]/g, '');
    if (digits.length < 7) {
      setPhoneFeedback({
        ok: false,
        text: 'Enter a valid mobile number (at least 7 digits) to attach to your profile.',
      });
      return;
    }

    setIsSavingPhone(true);
    setPhoneFeedback(null);
    const accToUse = overrideDefaultAccId ?? defaultAccountId;

    try {
      await onSaveProfile({
        ...user,
        phone: cleanPhone,
        countryCode,
      });

      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/whatsapp/register-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          phone: cleanPhone,
          countryCode,
          defaultAccountId: accToUse || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.registered) {
        setProfileBinding(data.binding);
        setIsEditingPhone(false);
        setPhoneFeedback({
          ok: true,
          text: `Attached ${data.binding.displayPhone} to ${user.email}.${
            data.reconciledCount > 0
              ? ` Matched ${data.reconciledCount} pending message(s).`
              : ''
          }`,
        });
        if (onSyncNow) await onSyncNow();
        await fetchStatusAndInbox(false);
      } else {
        setPhoneFeedback({
          ok: false,
          text: 'Profile saved, but server binding could not be verified.',
        });
      }
    } catch (err) {
      setPhoneFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Failed to attach phone number to profile.',
      });
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleDefaultAccountChange = async (newAccountId: string) => {
    setDefaultAccountId(newAccountId);
    try {
      localStorage.setItem(defaultAccountStorageKey, newAccountId);
      window.dispatchEvent(new CustomEvent('spendwise_whatsapp_default_account_changed'));
    } catch {
      // ignore storage errors
    }

    if (user.phone) {
      const headers = await getAuthHeaders();
      if (headers.Authorization) {
        await fetch('/api/v1/whatsapp/register-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            phone: user.phone,
            countryCode: user.countryCode || countryCode,
            defaultAccountId: newAccountId || undefined,
          }),
        });
      }
    }
  };

  const handleCopy = (target: 'webhook' | 'cli', value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(target);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleVerifyLive = async () => {
    setIsVerifying(true);
    setVerifyFeedback(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/whatsapp/verify', {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (res.ok && data.connected) {
        setVerifyFeedback({
          ok: true,
          text: `Connected to ${data.businessName || 'SpendWise'} (${data.connectedNumber}).`,
        });
      } else {
        setVerifyFeedback({
          ok: false,
          text: data.error || 'Unable to verify Kapso connection.',
        });
      }
    } catch (err) {
      setVerifyFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Verification request failed.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const applySummaryTemplate = () => {
    const currency = user.currency || '₹';
    const bankBalance = accounts
      .filter((a) => a.type === 'bank' || a.type === 'cash')
      .reduce((sum, a) => sum + a.balance, 0);
    const cardDue = accounts
      .filter((a) => a.type === 'credit_card')
      .reduce((sum, a) => sum + (a.dueAmount || 0), 0);

    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthlySpend = transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(monthPrefix))
      .reduce((sum, t) => sum + t.amount, 0);

    const activeLoans = loans.filter((l) => l.status === 'active').length;

    setMessageText(
      [
        `*SpendWise Summary*`,
        `Bank & Cash: ${currency}${bankBalance.toLocaleString('en-IN')}`,
        `This Month Spend: ${currency}${monthlySpend.toLocaleString('en-IN')}`,
        `Card Dues: ${currency}${cardDue.toLocaleString('en-IN')}`,
        `Active EMIs: ${activeLoans}`,
      ].join('\n')
    );
  };

  const applyAlertTemplate = () => {
    const currency = user.currency || '₹';
    const nextCard = accounts.find((a) => a.type === 'credit_card' && (a.dueAmount || 0) > 0);
    const nextLoan = loans.find((l) => l.status === 'active');

    if (nextCard) {
      setMessageText(
        `SpendWise Reminder: ${nextCard.name} due of ${currency}${(nextCard.dueAmount || 0).toLocaleString('en-IN')}${nextCard.dueDate ? ` (due ${nextCard.dueDate})` : ''}.`
      );
      return;
    }

    if (nextLoan) {
      setMessageText(
        `SpendWise EMI Alert: ${nextLoan.title} EMI of ${currency}${nextLoan.emiAmount.toLocaleString('en-IN')} is scheduled on day ${nextLoan.nextDueDate}.`
      );
      return;
    }

    setMessageText(
      `SpendWise Alert: All credit card dues are clear. Send any expense here (e.g. "450 Coffee") to log it.`
    );
  };

  const handleSendWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setSendFeedback(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          to: recipient,
          message: messageText,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSendFeedback({
          ok: true,
          text: `Sent to ${data.to} (Message ID: ${data.messageId || 'accepted'}).`,
        });
      } else {
        setSendFeedback({
          ok: false,
          text: data.error || 'Failed to send WhatsApp message.',
        });
      }
    } catch (err) {
      setSendFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Network error sending message.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSimulateInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simText.trim()) return;
    setIsSimulating(true);
    setSimFeedback(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/whatsapp/simulate-inbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          from: attachedFullPhone,
          contactName: user.name,
          text: simText.trim(),
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setSimFeedback({
          ok: true,
          text: `Matched sender ${profileBinding?.displayPhone || attachedFullPhone} → ${user.email}.`,
        });
        if (onSyncNow) {
          await onSyncNow();
        } else {
          window.dispatchEvent(new CustomEvent('spendwise_whatsapp_sync'));
        }
        await fetchStatusAndInbox(false);
      } else {
        setSimFeedback({
          ok: false,
          text: data?.error || 'Could not log test WhatsApp message.',
        });
      }
    } finally {
      setIsSimulating(false);
    }
  };

  const handlePullAndSync = async () => {
    setIsPullingMessages(true);
    try {
      await fetchStatusAndInbox(true);
      if (onSyncNow) {
        await onSyncNow();
      } else {
        window.dispatchEvent(new CustomEvent('spendwise_whatsapp_sync'));
      }
    } finally {
      setIsPullingMessages(false);
    }
  };

  const hasProfileNumber = Boolean(user.phone && profileBinding);

  return (
    <section className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200/80 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">WhatsApp Integration (Kapso)</h2>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  config.apiKeyConfigured
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {isLoadingStatus
                  ? 'Checking...'
                  : config.apiKeyConfigured
                  ? 'API Key Active'
                  : 'Needs KAPSO_API_KEY'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Incoming WhatsApp messages from your attached profile number log straight into {user.email}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleVerifyLive}
          disabled={isVerifying}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          {isVerifying ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>Verify Kapso Link</span>
        </button>
      </div>

      {/* Attached Profile Phone & Default Account Routing Card */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border-2 space-y-3.5 ${
          hasProfileNumber
            ? 'bg-emerald-50/40 border-emerald-200'
            : 'bg-amber-50/60 border-amber-300'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                hasProfileNumber
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                {hasProfileNumber
                  ? 'Profile Phone Attached for WhatsApp Routing'
                  : 'Attach Your WhatsApp Number to Your Profile'}
              </h3>
              <p className="text-[11px] text-slate-600">
                {hasProfileNumber
                  ? `Messages received from ${profileBinding?.displayPhone} automatically add transactions to ${user.email}.`
                  : `To add WhatsApp transactions only to ${user.email}, attach your WhatsApp mobile number below.`}
              </p>
            </div>
          </div>

          {hasProfileNumber && !isEditingPhone && (
            <button
              type="button"
              onClick={() => setIsEditingPhone(true)}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer self-start sm:self-auto"
            >
              Change Number
            </button>
          )}
        </div>

        {(isEditingPhone || !hasProfileNumber) && (
          <form onSubmit={(e) => handleSaveAttachedPhone(e)} className="flex flex-col sm:flex-row gap-2">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="sm:w-28 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              type="tel"
              inputMode="numeric"
              required
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value.replace(/[^\d+\-\s()]/g, ''))}
              placeholder="94188 32998"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={isSavingPhone}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              {isSavingPhone ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{isSavingPhone ? 'Attaching...' : 'Attach to Profile'}</span>
            </button>
            {hasProfileNumber && (
              <button
                type="button"
                onClick={() => setIsEditingPhone(false)}
                className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
            )}
          </form>
        )}

        {/* Default Ledger Account for WhatsApp Transactions */}
        <div className="pt-2 border-t border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
            <Wallet className="w-3.5 h-3.5 text-slate-500" />
            <span>Default Ledger Account (when message omits &ldquo;via Account&rdquo;):</span>
          </div>
          <select
            value={defaultAccountId}
            onChange={(e) => handleDefaultAccountChange(e.target.value)}
            className="sm:w-64 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            {accounts.length === 0 ? (
              <option value="">No accounts yet</option>
            ) : (
              accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type.replace('_', ' ')})
                </option>
              ))
            )}
          </select>
        </div>

        {phoneFeedback && (
          <div
            className={`text-[11px] p-2.5 rounded-xl border flex items-start gap-1.5 ${
              phoneFeedback.ok
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{phoneFeedback.text}</span>
          </div>
        )}
      </div>

      {/* Verification banner */}
      {verifyFeedback && (
        <div
          className={`text-xs p-3.5 rounded-2xl border flex items-start gap-2 ${
            verifyFeedback.ok
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          {verifyFeedback.ok ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          )}
          <span>{verifyFeedback.text}</span>
        </div>
      )}

      {/* Kapso Project Metadata Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Kapso Bot Number
          </div>
          <div className="text-xs font-bold text-slate-900 mt-1 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-emerald-600" />
            <span>{config.connectedNumber}</span>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Phone Number ID
          </div>
          <div className="text-xs font-mono font-semibold text-slate-800 mt-1 truncate">
            {config.phoneNumberId}
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Profile Number
          </div>
          <div className="text-xs font-bold text-slate-800 mt-1 truncate">
            {profileBinding ? profileBinding.displayPhone : 'Not attached'}
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Webhook Security
          </div>
          <div className="text-xs font-bold mt-1 flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                config.webhookSecretConfigured ? 'bg-emerald-500' : 'bg-amber-400'
              }`}
            />
            <span className={config.webhookSecretConfigured ? 'text-emerald-700' : 'text-amber-700'}>
              {config.webhookSecretConfigured ? 'HMAC Verified' : 'Needs Secret'}
            </span>
          </div>
        </div>
      </div>

      {/* Webhook Endpoint & CLI Setup */}
      <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-slate-600" />
            Kapso Webhook Endpoint & Launch Command
          </span>
          {!config.apiKeyConfigured || !config.webhookSecretConfigured ? (
            <span className="text-[11px] text-amber-700 font-semibold">
              Set KAPSO_API_KEY & KAPSO_WEBHOOK_SECRET in env
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-[11px] font-mono text-slate-800 truncate">
            {webhookUrl}
          </code>
          <button
            type="button"
            onClick={() => handleCopy('webhook', webhookUrl)}
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer shrink-0"
          >
            {copiedKey === 'webhook' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'webhook' ? 'Copied' : 'Copy URL'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 rounded-xl bg-slate-900 text-emerald-300 text-[11px] font-mono overflow-x-auto whitespace-nowrap">
            {cliCommand}
          </code>
          <button
            type="button"
            onClick={() => handleCopy('cli', cliCommand)}
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer shrink-0"
          >
            {copiedKey === 'cli' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'cli' ? 'Copied' : 'Copy CLI'}</span>
          </button>
        </div>
      </div>

      {/* Two-Column Interactive Workspace: Outbound Send + Inbound Bot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Outbound WhatsApp Sender */}
        <form
          onSubmit={handleSendWhatsApp}
          className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white space-y-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Send WhatsApp Message
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={applySummaryTemplate}
                className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200 cursor-pointer"
              >
                + Balance Digest
              </button>
              <button
                type="button"
                onClick={applyAlertTemplate}
                className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold border border-blue-200 cursor-pointer"
              >
                + Bill Alert
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Recipient WhatsApp Number (E.164)
            </label>
            <input
              type="tel"
              required
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="+919418832998"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Message Body
            </label>
            <textarea
              rows={4}
              required
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white resize-none"
            />
          </div>

          {sendFeedback && (
            <div
              className={`text-[11px] p-2.5 rounded-xl border flex items-start gap-1.5 ${
                sendFeedback.ok
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{sendFeedback.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSending}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isSending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{isSending ? 'Sending via Kapso...' : 'Send via WhatsApp'}</span>
          </button>
        </form>

        {/* Inbound Expense Bot & Inbox */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white space-y-3.5 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
              WhatsApp Expense Inbox
              {pendingSyncCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">
                  {pendingSyncCount} pending
                </span>
              )}
            </h3>

            <button
              type="button"
              onClick={handlePullAndSync}
              disabled={isPullingMessages}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isPullingMessages ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
          </div>

          <form onSubmit={handleSimulateInbound} className="flex items-center gap-2">
            <input
              type="text"
              value={simText}
              onChange={(e) => setSimText(e.target.value)}
              disabled={!hasProfileNumber}
              placeholder={
                hasProfileNumber
                  ? 'Try "450 Starbucks Coffee" or "Income 50000 Salary"'
                  : 'Attach your mobile number above to test WhatsApp logging'
              }
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 disabled:opacity-60 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
            <button
              type="submit"
              disabled={isSimulating || !simText.trim() || !hasProfileNumber}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isSimulating ? 'Logging...' : 'Test Parse'}</span>
            </button>
          </form>

          {simFeedback && (
            <div
              className={`text-[11px] p-2.5 rounded-xl border flex items-start gap-1.5 ${
                simFeedback.ok
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{simFeedback.text}</span>
            </div>
          )}

          <p className="text-[11px] text-slate-500">
            Supported WhatsApp formats: <code className="text-slate-700">450 Starbucks</code>,{' '}
            <code className="text-slate-700">Spent 1200 Groceries via HDFC</code>,{' '}
            <code className="text-slate-700">Income 50000 Salary</code>
          </p>

          <div className="flex-1 min-h-[140px] max-h-[220px] overflow-y-auto space-y-2 pr-1">
            {inboxItems.length === 0 ? (
              <div className="h-full min-h-[130px] rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-center p-4">
                <MessageSquare className="w-5 h-5 text-slate-300 mb-1.5" />
                <p className="text-xs font-semibold text-slate-600">
                  {hasProfileNumber
                    ? `No WhatsApp messages from ${profileBinding?.displayPhone} yet`
                    : 'Attach a phone number to your profile first'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {hasProfileNumber
                    ? `Text ${config.connectedNumber} from ${profileBinding?.displayPhone} to log expenses.`
                    : 'Only messages received from your attached profile number are routed here.'}
                </p>
              </div>
            ) : (
              inboxItems.slice(0, 12).map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 truncate">{item.text}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600 uppercase font-semibold">
                        {item.source === 'simulation' ? 'Test' : 'WhatsApp'}
                      </span>
                    </div>
                    {item.parsedTx ? (
                      <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                        Parsed {item.parsedTx.type}: {item.parsedTx.title} • {user.currency || '₹'}
                        {item.parsedTx.amount.toLocaleString('en-IN')}
                        {item.parsedTx.accountHint ? ` • ${item.parsedTx.accountHint}` : ''}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        From {item.from}
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                      item.syncedToClient
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {item.syncedToClient ? 'Synced' : item.parsedTx ? 'Pending' : 'Logged'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
