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
  Unlink,
  KeyRound,
  RotateCcw,
} from 'lucide-react';
import { UserProfile, Account, Transaction, LoanEMI } from '../types';
import { supabase } from '../lib/supabase';
import {
  BACKEND_UNAVAILABLE_MESSAGE,
  buildApiUrl,
  getBackendOrigin,
  parseJsonSafely,
} from '../lib/apiService';

interface KapsoConfigInfo {
  projectId: string;
  projectName: string;
  whatsappConfigId: string;
  phoneNumberId: string;
  connectedNumber: string;
  baseUrl: string;
  apiKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  geminiConfigured?: boolean;
  supabaseServiceRoleConfigured?: boolean;
}

interface ProfileBindingInfo {
  email: string;
  phoneDigits: string;
  displayPhone: string;
  verified: boolean;
  verifiedAt?: string;
  updatedAt: string;
}

interface LinkStatusInfo {
  binding: ProfileBindingInfo | null;
  otpPending: boolean;
  pendingPhone?: string;
  otpExpiresAt?: string;
}

interface WhatsAppInboxItem {
  id: string;
  messageId: string;
  from: string;
  contactName?: string;
  text: string;
  replyText?: string | null;
  timestamp: string;
  source: 'webhook' | 'simulation' | 'kapso_sync' | 'assistant_chat';
  kind: 'assistant' | 'otp' | 'unverified' | 'message';
  dataMutated: boolean;
  requiresConfirmation: boolean;
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
    geminiConfigured: false,
    supabaseServiceRoleConfigured: false,
  });

  const [linkStatus, setLinkStatus] = useState<LinkStatusInfo>({
    binding: null,
    otpPending: false,
  });

  const [countryCode, setCountryCode] = useState(user.countryCode || '+91');
  const [profilePhone, setProfilePhone] = useState(user.phone || '');
  const [isEditingPhone, setIsEditingPhone] = useState(!user.phone);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [previewOtpHint, setPreviewOtpHint] = useState<string | null>(null);
  const [phoneFeedback, setPhoneFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const [inboxItems, setInboxItems] = useState<WhatsAppInboxItem[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [isVerifyingKapso, setIsVerifyingKapso] = useState(false);
  const [verifyFeedback, setVerifyFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // Send message state
  const attachedFullPhone =
    linkStatus.binding?.displayPhone?.replace(/[^\d+]/g, '') ||
    (user.phone ? `${user.countryCode || '+91'}${user.phone}`.replace(/[^\d+]/g, '') : '+919418832998');
  const [recipient, setRecipient] = useState(attachedFullPhone);
  const [messageText, setMessageText] = useState(
    'Hello from SpendWise! Your Kapso WhatsApp integration is active.'
  );
  const [isSending, setIsSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  // Conversational AI Tester state
  const [chatText, setChatText] = useState('What is my HDFC balance?');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatFeedback, setChatFeedback] = useState<{
    ok: boolean;
    text: string;
    activeAccount?: string;
  } | null>(null);
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

  const configuredBackendOrigin = getBackendOrigin();
  const webhookUrl = configuredBackendOrigin
    ? `${configuredBackendOrigin}/api/webhooks/kapso`
    : typeof window !== 'undefined'
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
          fetch(buildApiUrl('/api/v1/whatsapp/status'), { headers }),
          fetch(buildApiUrl(`/api/v1/whatsapp/messages${pullRemote ? '?pull=true' : ''}`), { headers }),
        ]);

        const [statusParsed, msgParsed] = await Promise.all([
          parseJsonSafely(statusRes),
          parseJsonSafely(msgRes),
        ]);

        if (statusParsed.isBackendMissing || msgParsed.isBackendMissing) {
          setBackendUnavailable(true);
        } else if (statusRes.ok || msgRes.ok) {
          setBackendUnavailable(false);
        }

        if (statusRes.ok && statusParsed.data) {
          const statusData = statusParsed.data;
          if (statusData?.config) setConfig(statusData.config);
          if (statusData?.linkStatus) {
            setLinkStatus(statusData.linkStatus);
          } else {
            setLinkStatus({
              binding: statusData?.profileBinding || null,
              otpPending: false,
            });
          }
        }

        if (msgRes.ok && msgParsed.data) {
          const msgData = msgParsed.data;
          setInboxItems(Array.isArray(msgData?.items) ? msgData.items : []);
          setPendingSyncCount(Number(msgData?.pendingSyncCount) || 0);
          if (msgData?.linkStatus) {
            setLinkStatus(msgData.linkStatus);
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

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = profilePhone.trim();
    const digits = cleanPhone.replace(/[^\d]/g, '');
    if (digits.length < 7) {
      setPhoneFeedback({
        ok: false,
        text: 'Enter a valid mobile number (at least 7 digits) before requesting verification.',
      });
      return;
    }

    setIsRequestingOtp(true);
    setPhoneFeedback(null);
    setPreviewOtpHint(null);

    try {
      await onSaveProfile({
        ...user,
        phone: cleanPhone,
        countryCode,
      });

      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl('/api/v1/whatsapp/link/request-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          phone: cleanPhone,
          countryCode,
        }),
      });
      const { data, isBackendMissing } = await parseJsonSafely(res);
      if (isBackendMissing) {
        setBackendUnavailable(true);
        setPhoneFeedback({ ok: false, text: BACKEND_UNAVAILABLE_MESSAGE });
      } else if (res.ok && data?.success) {
        setBackendUnavailable(false);
        if (data.linkStatus) setLinkStatus(data.linkStatus);
        if (data.previewOtp) {
          setPreviewOtpHint(String(data.previewOtp));
        }
        setIsEditingPhone(false);
        setPhoneFeedback({
          ok: true,
          text: data.deliveryNote || `6-digit verification code generated for ${data.displayPhone}.`,
        });
        await fetchStatusAndInbox(false);
      } else {
        setPhoneFeedback({
          ok: false,
          text: data?.error || `Could not initiate WhatsApp verification (HTTP ${res.status}).`,
        });
      }
    } catch (err) {
      setPhoneFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Failed to request verification code.',
      });
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput.trim()) return;
    setIsVerifyingOtp(true);
    setPhoneFeedback(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl('/api/v1/whatsapp/link/verify-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ code: otpInput.trim() }),
      });
      const { data, isBackendMissing } = await parseJsonSafely(res);
      if (isBackendMissing) {
        setBackendUnavailable(true);
        setPhoneFeedback({ ok: false, text: BACKEND_UNAVAILABLE_MESSAGE });
      } else if (res.ok && data?.verified) {
        setBackendUnavailable(false);
        if (data.linkStatus) setLinkStatus(data.linkStatus);
        setOtpInput('');
        setPreviewOtpHint(null);
        setPhoneFeedback({
          ok: true,
          text: `Verified ${data.binding?.displayPhone} for ${user.email}. WhatsApp AI Assistant is now unlocked.`,
        });
        await fetchStatusAndInbox(false);
      } else {
        setPhoneFeedback({
          ok: false,
          text: data?.error || `Verification code could not be validated (HTTP ${res.status}).`,
        });
      }
    } catch (err) {
      setPhoneFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Failed to verify OTP code.',
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleUnlinkWhatsApp = async () => {
    setIsUnlinking(true);
    setPhoneFeedback(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl('/api/v1/whatsapp/unlink'), {
        method: 'POST',
        headers,
      });
      const { data, isBackendMissing } = await parseJsonSafely(res);
      if (isBackendMissing) {
        setBackendUnavailable(true);
        setPhoneFeedback({ ok: false, text: BACKEND_UNAVAILABLE_MESSAGE });
      } else if (res.ok && data?.unlinked) {
        setBackendUnavailable(false);
        await onSaveProfile({
          ...user,
          phone: undefined,
        });
        setProfilePhone('');
        setOtpInput('');
        setPreviewOtpHint(null);
        setIsEditingPhone(true);
        setChatFeedback(null);
        setLinkStatus(data.linkStatus || { binding: null, otpPending: false });
        setPhoneFeedback({
          ok: true,
          text: 'WhatsApp number unlinked and conversational session cleared.',
        });
        await fetchStatusAndInbox(false);
      } else {
        setPhoneFeedback({
          ok: false,
          text: data?.error || `Could not unlink WhatsApp account (HTTP ${res.status}).`,
        });
      }
    } catch (err) {
      setPhoneFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Failed to unlink WhatsApp account.',
      });
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleCopy = (target: 'webhook' | 'cli', value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(target);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleVerifyLive = async () => {
    setIsVerifyingKapso(true);
    setVerifyFeedback(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl('/api/v1/whatsapp/verify'), {
        method: 'POST',
        headers,
      });
      const { data, isBackendMissing } = await parseJsonSafely(res);
      if (isBackendMissing) {
        setBackendUnavailable(true);
        setVerifyFeedback({
          ok: false,
          text: BACKEND_UNAVAILABLE_MESSAGE,
        });
      } else if (res.ok && data?.connected) {
        setBackendUnavailable(false);
        setVerifyFeedback({
          ok: true,
          text: `Connected to ${data.businessName || 'SpendWise'} (${data.connectedNumber}).`,
        });
      } else {
        setVerifyFeedback({
          ok: false,
          text: data?.error || `Unable to verify Kapso connection (HTTP ${res.status}).`,
        });
      }
    } catch (err) {
      setVerifyFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Verification request failed.',
      });
    } finally {
      setIsVerifyingKapso(false);
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
        `SpendWise EMI Alert: ${nextLoan.name} EMI of ${currency}${nextLoan.monthlyEMI.toLocaleString('en-IN')} is scheduled on ${nextLoan.nextDueDate}.`
      );
      return;
    }

    setMessageText(
      `SpendWise Alert: All credit card dues are clear. Reply anytime to check an account or log an expense.`
    );
  };

  const handleSendWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setSendFeedback(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl('/api/v1/whatsapp/send'), {
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
      const { data, isBackendMissing } = await parseJsonSafely(res);
      if (isBackendMissing) {
        setBackendUnavailable(true);
        setSendFeedback({ ok: false, text: BACKEND_UNAVAILABLE_MESSAGE });
      } else if (res.ok && data?.success) {
        setBackendUnavailable(false);
        setSendFeedback({
          ok: true,
          text: `Sent to ${data.to} (Message ID: ${data.messageId || 'accepted'}).`,
        });
      } else {
        setSendFeedback({
          ok: false,
          text: data?.error || `Failed to send WhatsApp message (HTTP ${res.status}).`,
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

  const handleSendAssistantChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    setIsSendingChat(true);
    setChatFeedback(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl('/api/v1/whatsapp/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          text: chatText.trim(),
          contactName: user.name,
        }),
      });
      const { data, isBackendMissing } = await parseJsonSafely(res);

      if (isBackendMissing) {
        setBackendUnavailable(true);
        setChatFeedback({ ok: false, text: BACKEND_UNAVAILABLE_MESSAGE });
      } else if (res.ok && data?.success) {
        setBackendUnavailable(false);
        setChatFeedback({
          ok: true,
          text: data.replyText,
          activeAccount: data.activeAccountName || undefined,
        });
        setChatText('');
        if (data.dataMutated) {
          if (onSyncNow) {
            await onSyncNow();
          } else {
            window.dispatchEvent(new CustomEvent('spendwise_whatsapp_sync'));
          }
        }
        await fetchStatusAndInbox(false);
      } else {
        setChatFeedback({
          ok: false,
          text: data?.replyText || data?.error || `Could not reach WhatsApp AI Assistant (HTTP ${res.status}).`,
        });
      }
    } catch (err) {
      setChatFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Assistant request failed.',
      });
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleClearAssistantContext = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl('/api/v1/whatsapp/context/clear'), {
        method: 'POST',
        headers,
      });
      const { isBackendMissing } = await parseJsonSafely(res);
      if (isBackendMissing) {
        setBackendUnavailable(true);
        setChatFeedback({ ok: false, text: BACKEND_UNAVAILABLE_MESSAGE });
        return;
      }
      setChatFeedback({
        ok: true,
        text: 'Conversational context cleared. Next query will ask for the target account cleanly.',
      });
    } catch {
      // ignore
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

  const isVerified = Boolean(linkStatus.binding?.verified);
  const isOtpPending = Boolean(linkStatus.otpPending);

  return (
    <section className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-200/80 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                WhatsApp AI Financial Assistant (Kapso)
              </h2>
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
                  ? 'Kapso Connected'
                  : 'Kapso Key Missing'}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  config.geminiConfigured
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {config.geminiConfigured ? 'Gemini AI Ready' : 'Gemini Key Missing'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Account-specific balances, analytics, EMIs, and confirmed transactions over verified WhatsApp ({user.email})
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleVerifyLive}
          disabled={isVerifyingKapso}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          {isVerifyingKapso ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>Verify Kapso Link</span>
        </button>
      </div>

      {backendUnavailable && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
          <div className="text-xs text-rose-800 space-y-1">
            <p className="font-bold">Backend API Server Not Detected on This Domain (HTTP 404)</p>
            <p>
              This host is serving only the static frontend bundle without the SpendWise Node.js server (
              <code className="font-mono">server.ts</code>). To enable WhatsApp AI routes on a custom domain:
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>
                Run the full-stack server (<code className="font-mono">npm run build && npm start</code>) or proxy{' '}
                <code className="font-mono">/api/*</code> to it, or
              </li>
              <li>
                Rebuild your static frontend with <code className="font-mono">VITE_API_BASE_URL</code> set to your running Node backend URL.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* WhatsApp Verification & Account Linking Card */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border-2 space-y-4 ${
          isVerified
            ? 'bg-emerald-50/40 border-emerald-200'
            : 'bg-amber-50/60 border-amber-300'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isVerified
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-900">
                  {isVerified
                    ? 'Verified WhatsApp Account Link'
                    : isOtpPending
                    ? 'Verification Pending — Enter 6-Digit Code'
                    : 'Link & Verify Your WhatsApp Number'}
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isVerified
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : isOtpPending
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {isVerified ? 'Verified' : isOtpPending ? 'OTP Pending' : 'Unlinked'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {isVerified
                  ? `Linked to ${linkStatus.binding?.displayPhone}. Every WhatsApp query operates strictly on your explicit SpendWise accounts.`
                  : 'Verify your WhatsApp number with a 6-digit OTP before accessing balances, EMIs, or logging transactions via WhatsApp.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isVerified && !isEditingPhone && (
              <button
                type="button"
                onClick={() => setIsEditingPhone(true)}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Change Number
              </button>
            )}
            {(isVerified || linkStatus.binding) && (
              <button
                type="button"
                onClick={handleUnlinkWhatsApp}
                disabled={isUnlinking}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-600 flex items-center gap-1 cursor-pointer disabled:opacity-60"
              >
                {isUnlinking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Unlink className="w-3.5 h-3.5" />
                )}
                <span>Unlink WhatsApp</span>
              </button>
            )}
          </div>
        </div>

        {(isEditingPhone || (!isVerified && !isOtpPending)) && (
          <form onSubmit={handleRequestOtp} className="flex flex-col sm:flex-row gap-2">
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
              disabled={isRequestingOtp}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              {isRequestingOtp ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <KeyRound className="w-3.5 h-3.5" />
              )}
              <span>{isRequestingOtp ? 'Sending OTP...' : 'Send Verification Code'}</span>
            </button>
            {isVerified && (
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

        {isOtpPending && (
          <form onSubmit={handleVerifyOtp} className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-800">
                Verify <span className="font-bold">{linkStatus.pendingPhone}</span> — enter the 6-digit code or reply{' '}
                <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-900">LINK &lt;code&gt;</code> on WhatsApp:
              </div>
              {previewOtpHint && (
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                  Preview Code: {previewOtpHint}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                className="w-44 px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs font-mono font-bold tracking-widest text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={isVerifyingOtp || otpInput.length !== 6}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {isVerifyingOtp ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>Verify & Link</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditingPhone(true)}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Edit Number
              </button>
            </div>
          </form>
        )}

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
            Verified User Phone
          </div>
          <div className="text-xs font-bold text-slate-800 mt-1 truncate">
            {isVerified && linkStatus.binding
              ? linkStatus.binding.displayPhone
              : linkStatus.binding
              ? `${linkStatus.binding.displayPhone} (Unverified)`
              : 'Not linked'}
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
              {config.webhookSecretConfigured ? 'HMAC Verified' : 'Needs Webhook Secret'}
            </span>
          </div>
        </div>
      </div>

      {/* Webhook Endpoint & CLI Setup */}
      <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-slate-600" />
            Kapso Webhook Endpoint & Launch Command
          </span>
          {(!config.apiKeyConfigured || !config.webhookSecretConfigured || !config.geminiConfigured) && (
            <span className="text-[11px] text-amber-700 font-semibold">
              Configure server env vars (KAPSO_API_KEY, KAPSO_WEBHOOK_SECRET, GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY)
            </span>
          )}
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

      {/* Two-Column Interactive Workspace: Outbound Send + AI Assistant Chat & History */}
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

        {/* Conversational WhatsApp AI Assistant Tester & Inbox */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white space-y-3.5 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
              WhatsApp AI Assistant & History
              {pendingSyncCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">
                  {pendingSyncCount} syncing
                </span>
              )}
            </h3>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleClearAssistantContext}
                disabled={!isVerified}
                title="Reset active account context"
                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
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
          </div>

          <form onSubmit={handleSendAssistantChat} className="flex items-center gap-2">
            <input
              type="text"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              disabled={!isVerified}
              placeholder={
                isVerified
                  ? 'Ask e.g. "What is my HDFC balance?" or "Add ₹450 Coffee via HDFC"'
                  : 'Verify your WhatsApp number above to test the AI Assistant'
              }
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 disabled:opacity-60 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
            <button
              type="submit"
              disabled={isSendingChat || !chatText.trim() || !isVerified}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
            >
              {isSendingChat ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{isSendingChat ? 'Thinking...' : 'Ask Bot'}</span>
            </button>
          </form>

          {chatFeedback && (
            <div
              className={`text-[11px] p-2.5 rounded-xl border whitespace-pre-wrap space-y-1 ${
                chatFeedback.ok
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-amber-50 text-amber-900 border-amber-200'
              }`}
            >
              {chatFeedback.activeAccount && (
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Context Account: {chatFeedback.activeAccount}
                </div>
              )}
              <div>{chatFeedback.text}</div>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {[
              'What is my HDFC balance?',
              'Add a new ICICI savings account',
              'Spent 450 Coffee via HDFC',
              'Show my EMIs on HDFC',
            ].map((sample) => (
              <button
                key={sample}
                type="button"
                disabled={!isVerified}
                onClick={() => setChatText(sample)}
                className="text-[10px] px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold cursor-pointer"
              >
                {sample}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-[140px] max-h-[240px] overflow-y-auto space-y-2 pr-1">
            {inboxItems.length === 0 ? (
              <div className="h-full min-h-[130px] rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-center p-4">
                <MessageSquare className="w-5 h-5 text-slate-300 mb-1.5" />
                <p className="text-xs font-semibold text-slate-600">
                  {isVerified
                    ? `No WhatsApp conversations from ${linkStatus.binding?.displayPhone} yet`
                    : 'Link and verify your WhatsApp number first'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isVerified
                    ? `Text ${config.connectedNumber} from ${linkStatus.binding?.displayPhone} or test above.`
                    : 'Only verified WhatsApp numbers can query accounts or log transactions.'}
                </p>
              </div>
            ) : (
              inboxItems.slice(0, 12).map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs space-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 truncate">{item.text}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600 uppercase font-semibold">
                          {item.source === 'assistant_chat'
                            ? 'Tester'
                            : item.source === 'simulation'
                            ? 'Test'
                            : 'WhatsApp'}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                        item.dataMutated
                          ? item.syncedToClient
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                          : item.requiresConfirmation
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {item.dataMutated
                        ? item.syncedToClient
                          ? 'Saved & Synced'
                          : 'Syncing'
                        : item.requiresConfirmation
                        ? 'Awaiting YES'
                        : 'Replied'}
                    </span>
                  </div>
                  {item.replyText && (
                    <div className="text-[11px] text-slate-600 whitespace-pre-wrap border-l-2 border-emerald-300 pl-2">
                      {item.replyText}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
