import fs from "node:fs";
import path from "node:path";
import { WhatsAppClient, GraphApiError } from "@kapso/whatsapp-cloud-api";
import {
  normalizeWebhook,
  verifyKapsoWebhookSignature,
  verifySignature,
} from "@kapso/whatsapp-cloud-api/server";

export interface KapsoPublicConfig {
  projectId: string;
  projectName: string;
  whatsappConfigId: string;
  phoneNumberId: string;
  connectedNumber: string;
  baseUrl: string;
  apiKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
}

export interface ProfilePhoneBinding {
  email: string;
  phoneDigits: string;
  displayPhone: string;
  defaultAccountId?: string;
  updatedAt: string;
}

export interface ParsedWhatsAppTransaction {
  title: string;
  amount: number;
  type: "expense" | "income";
  accountHint?: string;
  defaultAccountId?: string;
  categoryHint?: string;
  date: string;
  time: string;
  notes: string;
}

export interface WhatsAppInboxItem {
  id: string;
  messageId: string;
  from: string;
  contactName?: string;
  text: string;
  timestamp: string;
  source: "webhook" | "simulation" | "kapso_sync";
  event: string;
  kind: "transaction" | "command" | "message";
  command: "help" | "summary" | null;
  parsedTx: ParsedWhatsAppTransaction | null;
  replySent: boolean;
  replyError: string | null;
  syncedToClient: boolean;
  syncedAt: string | null;
  ownerEmail: string | null;
  matchedProfilePhone: string | null;
}

interface PersistedKapsoState {
  bindings: ProfilePhoneBinding[];
  inboxItems: WhatsAppInboxItem[];
}

const DEFAULT_KAPSO_PROJECT_ID = "d2e5058e-fd40-43c7-a180-23b0e085399e";
const DEFAULT_WHATSAPP_CONFIG_ID = "163330a8-e3e1-4673-b1cb-626000d0c18b";
const DEFAULT_PHONE_NUMBER_ID = "1561127940407191";
const DEFAULT_CONNECTED_NUMBER = "+91 94188 32998";
const KAPSO_BASE_URL = "https://api.kapso.ai/meta/whatsapp";
const MAX_INBOX_ITEMS = 150;
const STATE_FILE_PATH =
  process.env.KAPSO_STATE_FILE?.trim() ||
  path.join("/tmp", "spendwise-kapso-whatsapp-state.json");

const inboxItems: WhatsAppInboxItem[] = [];
const processedMessageIds = new Set<string>();
const profileBindingsByEmail = new Map<string, ProfilePhoneBinding>();

function loadPersistedState() {
  try {
    if (!fs.existsSync(STATE_FILE_PATH)) return;
    const raw = fs.readFileSync(STATE_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<PersistedKapsoState>;
    if (Array.isArray(parsed.bindings)) {
      for (const b of parsed.bindings) {
        if (b?.email && b?.phoneDigits) {
          profileBindingsByEmail.set(b.email.toLowerCase(), {
            ...b,
            email: b.email.toLowerCase(),
          });
        }
      }
    }
    if (Array.isArray(parsed.inboxItems)) {
      for (const item of parsed.inboxItems.slice(0, MAX_INBOX_ITEMS)) {
        if (item?.messageId && !processedMessageIds.has(item.messageId)) {
          processedMessageIds.add(item.messageId);
          inboxItems.push(item);
        }
      }
    }
  } catch {
    // Non-fatal if cache file is unreadable or absent
  }
}

function persistState() {
  try {
    const payload: PersistedKapsoState = {
      bindings: Array.from(profileBindingsByEmail.values()),
      inboxItems: inboxItems.slice(0, MAX_INBOX_ITEMS),
    };
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(payload), {
      encoding: "utf8",
      mode: 0o600,
    });
  } catch {
    // Non-fatal in read-only environments
  }
}

loadPersistedState();

export function getKapsoPublicConfig(): KapsoPublicConfig {
  const apiKey = process.env.KAPSO_API_KEY?.trim() || "";
  const webhookSecret = process.env.KAPSO_WEBHOOK_SECRET?.trim() || "";

  return {
    projectId: process.env.KAPSO_PROJECT_ID?.trim() || DEFAULT_KAPSO_PROJECT_ID,
    projectName: "SpendWise",
    whatsappConfigId: process.env.KAPSO_WHATSAPP_CONFIG_ID?.trim() || DEFAULT_WHATSAPP_CONFIG_ID,
    phoneNumberId: process.env.KAPSO_PHONE_NUMBER_ID?.trim() || DEFAULT_PHONE_NUMBER_ID,
    connectedNumber: process.env.KAPSO_CONNECTED_NUMBER?.trim() || DEFAULT_CONNECTED_NUMBER,
    baseUrl: KAPSO_BASE_URL,
    apiKeyConfigured: Boolean(apiKey),
    webhookSecretConfigured: Boolean(webhookSecret),
  };
}

export function createKapsoClient(): WhatsAppClient | null {
  const kapsoApiKey = process.env.KAPSO_API_KEY?.trim();
  if (!kapsoApiKey) {
    return null;
  }

  return new WhatsAppClient({
    baseUrl: KAPSO_BASE_URL,
    kapsoApiKey,
  });
}

export function sanitizePhoneNumber(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return null;
  }
  return digits;
}

export function normalizeProfilePhone(
  phone: string | undefined | null,
  countryCode?: string | null
): { phoneDigits: string; displayPhone: string } | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;

  const ccDigits = (countryCode || "+91").replace(/[^\d]/g, "");
  const hasExplicitCountryCode = trimmed.startsWith("+");

  if (!hasExplicitCountryCode) {
    if (digits.length === 11 && digits.startsWith("0")) {
      digits = digits.slice(1);
    }
    if (digits.length === 10 && ccDigits) {
      digits = `${ccDigits}${digits}`;
    }
  }

  if (digits.length < 7 || digits.length > 15) {
    return null;
  }

  const displayPhone =
    ccDigits && digits.startsWith(ccDigits) && digits.length > ccDigits.length
      ? `+${ccDigits} ${digits.slice(ccDigits.length)}`
      : `+${digits}`;

  return { phoneDigits: digits, displayPhone };
}

export function arePhonesMatched(phoneA?: string | null, phoneB?: string | null): boolean {
  const a = (phoneA || "").replace(/[^\d]/g, "");
  const b = (phoneB || "").replace(/[^\d]/g, "");
  if (a.length < 7 || b.length < 7) return false;
  if (a === b) return true;
  if (a.length >= 10 && b.length >= 10 && a.slice(-10) === b.slice(-10)) {
    return true;
  }
  return false;
}

export function registerProfilePhoneBinding(input: {
  email: string;
  phone?: string | null;
  countryCode?: string | null;
  defaultAccountId?: string | null;
}): { binding: ProfilePhoneBinding | null; reconciledCount: number } {
  const email = input.email.trim().toLowerCase();
  const normalized = normalizeProfilePhone(input.phone, input.countryCode);

  if (!normalized) {
    profileBindingsByEmail.delete(email);
    persistState();
    return { binding: null, reconciledCount: 0 };
  }

  const binding: ProfilePhoneBinding = {
    email,
    phoneDigits: normalized.phoneDigits,
    displayPhone: normalized.displayPhone,
    defaultAccountId: input.defaultAccountId?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };

  profileBindingsByEmail.set(email, binding);

  // Reconcile any previously unmatched inbound webhook messages from this number
  let reconciledCount = 0;
  for (const item of inboxItems) {
    if (item.ownerEmail === null && arePhonesMatched(item.from, binding.phoneDigits)) {
      item.ownerEmail = email;
      item.matchedProfilePhone = binding.displayPhone;
      if (item.parsedTx && !item.parsedTx.accountHint && binding.defaultAccountId) {
        item.parsedTx.defaultAccountId = binding.defaultAccountId;
      }
      reconciledCount += 1;
    }
  }

  persistState();
  return { binding, reconciledCount };
}

export function getProfileBindingForUser(userEmail: string): ProfilePhoneBinding | null {
  return profileBindingsByEmail.get(userEmail.trim().toLowerCase()) || null;
}

async function lookupProfileByPhoneInSupabase(
  fromPhone: string
): Promise<ProfilePhoneBinding | null> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://kdjptkhfvzvsevzbcmik.supabase.co";

  if (!serviceRoleKey) return null;

  const incomingDigits = fromPhone.replace(/[^\d]/g, "");
  if (incomingDigits.length < 7) return null;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=email,phone,country_code&phone=not.is.null`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      email?: string;
      phone?: string;
      country_code?: string;
    }>;

    for (const row of rows) {
      if (!row.email || !row.phone) continue;
      const normalized = normalizeProfilePhone(row.phone, row.country_code);
      if (normalized && arePhonesMatched(incomingDigits, normalized.phoneDigits)) {
        const binding: ProfilePhoneBinding = {
          email: row.email.toLowerCase(),
          phoneDigits: normalized.phoneDigits,
          displayPhone: normalized.displayPhone,
          updatedAt: new Date().toISOString(),
        };
        profileBindingsByEmail.set(binding.email, binding);
        persistState();
        return binding;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function resolveProfileForSender(
  fromPhone: string
): Promise<ProfilePhoneBinding | null> {
  const incomingDigits = fromPhone.replace(/[^\d]/g, "");
  if (incomingDigits.length < 7) return null;

  for (const binding of profileBindingsByEmail.values()) {
    if (arePhonesMatched(incomingDigits, binding.phoneDigits)) {
      return binding;
    }
  }

  return lookupProfileByPhoneInSupabase(fromPhone);
}

export function parseWhatsAppMessage(rawText: string): {
  kind: "transaction" | "command" | "message";
  command: "help" | "summary" | null;
  parsedTx: ParsedWhatsAppTransaction | null;
} {
  const text = rawText.trim();
  if (!text) {
    return { kind: "message", command: null, parsedTx: null };
  }

  const normalizedCmd = text.toLowerCase().replace(/^[/!]/, "").trim();
  if (normalizedCmd === "help" || normalizedCmd === "commands" || normalizedCmd === "?") {
    return { kind: "command", command: "help", parsedTx: null };
  }
  if (normalizedCmd === "summary" || normalizedCmd === "status" || normalizedCmd === "balance") {
    return { kind: "command", command: "summary", parsedTx: null };
  }

  let working = text;
  let type: "expense" | "income" = "expense";
  let accountHint: string | undefined;
  let categoryHint: string | undefined;

  if (
    /^\+/.test(working) ||
    /\b(income|salary|received|credited|credit|refund|bonus|earned)\b/i.test(working)
  ) {
    type = "income";
  }

  const categoryMatch = working.match(/(?:^|\s)#([a-zA-Z0-9_-]{2,30})\b/);
  if (categoryMatch) {
    categoryHint = categoryMatch[1].replace(/[_-]+/g, " ").trim();
    working = working.replace(categoryMatch[0], " ").trim();
  }

  const accountMatch = working.match(/\b(?:via|from|using|on)\s+([a-zA-Z0-9 &_-]{2,32})$/i);
  if (accountMatch && /\b(via|from|using)\b/i.test(accountMatch[0])) {
    accountHint = accountMatch[1].trim();
    working = working.slice(0, accountMatch.index).trim();
  }

  working = working
    .replace(/^(?:spent|spend|paid|pay|expense|bought|income|received|credited|added|log)\b\s*/i, "")
    .trim();

  let amountStr: string | null = null;
  let titleRaw = working;

  const leadingAmountMatch = working.match(
    /^[+\-]?\s*(?:₹|rs\.?|inr|\$|€|£)?\s*(\d{1,9}(?:,\d{2,3})*(?:\.\d{1,2})?)\s+(?:on|for|at|to)?\s*(.+)$/i
  );

  if (leadingAmountMatch) {
    amountStr = leadingAmountMatch[1];
    titleRaw = leadingAmountMatch[2];
  } else {
    const trailingAmountMatch = working.match(
      /^(.+?)\s+(?:for|of|at|worth)?\s*[+\-]?\s*(?:₹|rs\.?|inr|\$|€|£)?\s*(\d{1,9}(?:,\d{2,3})*(?:\.\d{1,2})?)$/i
    );
    if (trailingAmountMatch) {
      titleRaw = trailingAmountMatch[1];
      amountStr = trailingAmountMatch[2];
    }
  }

  if (!amountStr) {
    return { kind: "message", command: null, parsedTx: null };
  }

  const parsedAmount = Number(amountStr.replace(/,/g, ""));
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100_000_000) {
    return { kind: "message", command: null, parsedTx: null };
  }

  const cleanTitle = titleRaw
    .replace(/^(?:on|for|at|to|from)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  if (!cleanTitle) {
    return { kind: "message", command: null, parsedTx: null };
  }

  const now = new Date();
  const parsedTx: ParsedWhatsAppTransaction = {
    title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
    amount: Math.round(parsedAmount * 100) / 100,
    type,
    accountHint,
    categoryHint,
    date: now.toISOString().split("T")[0],
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    notes: `Logged via WhatsApp (${rawText.trim().slice(0, 140)})`,
  };

  return { kind: "transaction", command: null, parsedTx };
}

export function verifyIncomingWebhookSignature(
  rawBody: Buffer | string | undefined,
  headers: Record<string, string | string[] | undefined>
): { valid: boolean; reason?: string } {
  const webhookSecret = process.env.KAPSO_WEBHOOK_SECRET?.trim();
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim() || webhookSecret;

  if (!webhookSecret && !appSecret) {
    return { valid: false, reason: "KAPSO_WEBHOOK_SECRET is not configured on the server." };
  }

  if (!rawBody || (Buffer.isBuffer(rawBody) && rawBody.length === 0)) {
    return { valid: false, reason: "Missing raw request body for signature verification." };
  }

  const kapsoSignatureHeader =
    typeof headers["x-webhook-signature"] === "string"
      ? headers["x-webhook-signature"]
      : undefined;

  if (kapsoSignatureHeader && webhookSecret) {
    const ok = verifyKapsoWebhookSignature({
      secret: webhookSecret,
      rawBody,
      signatureHeader: kapsoSignatureHeader,
    });
    return ok ? { valid: true } : { valid: false, reason: "Invalid X-Webhook-Signature header." };
  }

  const metaSignatureHeader =
    typeof headers["x-hub-signature-256"] === "string"
      ? headers["x-hub-signature-256"]
      : undefined;

  if (metaSignatureHeader && appSecret) {
    const ok = verifySignature({
      appSecret,
      rawBody,
      signatureHeader: metaSignatureHeader,
    });
    return ok ? { valid: true } : { valid: false, reason: "Invalid X-Hub-Signature-256 header." };
  }

  return {
    valid: false,
    reason: "Missing X-Webhook-Signature or X-Hub-Signature-256 header.",
  };
}

function buildAutoReplyMessage(item: WhatsAppInboxItem): string | null {
  if (!item.ownerEmail) {
    return [
      "*SpendWise*",
      `Your WhatsApp number (${item.from}) is not attached to a SpendWise profile yet.`,
      "Open SpendWise → Settings → Profile or WhatsApp Integration and attach your mobile number so transactions route to your account.",
    ].join("\n");
  }

  if (item.kind === "command" && item.command === "help") {
    return [
      `*SpendWise Bot (${item.ownerEmail})*`,
      "Send any expense or income to log it to your account:",
      "• `450 Starbucks Coffee`",
      "• `Spent 1200 on Groceries via HDFC`",
      "• `Income 50000 Salary`",
      "• `280 Uber #Transport`",
    ].join("\n");
  }

  if (item.kind === "command" && item.command === "summary") {
    return `Linked profile: ${item.ownerEmail}. Open SpendWise → Settings → WhatsApp Integration to send a live balance digest.`;
  }

  if (item.parsedTx) {
    const label = item.parsedTx.type === "income" ? "Income" : "Expense";
    const accountPart = item.parsedTx.accountHint ? `\nAccount: ${item.parsedTx.accountHint}` : "";
    return `Logged ${label} to *${item.ownerEmail}*:\n*${item.parsedTx.title}* — ₹${item.parsedTx.amount.toLocaleString("en-IN")}${accountPart}`;
  }

  return null;
}

function pushInboxItem(item: WhatsAppInboxItem) {
  if (processedMessageIds.has(item.messageId)) {
    return false;
  }
  processedMessageIds.add(item.messageId);
  inboxItems.unshift(item);
  if (inboxItems.length > MAX_INBOX_ITEMS) {
    const removed = inboxItems.splice(MAX_INBOX_ITEMS);
    for (const old of removed) {
      processedMessageIds.delete(old.messageId);
    }
  }
  persistState();
  return true;
}

export async function sendWhatsAppTextMessage(input: {
  to: string;
  message: string;
}): Promise<{
  messageId: string | null;
  to: string;
  status: string;
}> {
  const client = createKapsoClient();
  if (!client) {
    const err = new Error("KAPSO_API_KEY is not configured on the server.") as Error & {
      statusCode?: number;
    };
    err.statusCode = 503;
    throw err;
  }

  const sanitizedTo = sanitizePhoneNumber(input.to);
  if (!sanitizedTo) {
    const err = new Error("Valid recipient phone number with country code is required (7-15 digits).") as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    throw err;
  }

  const body = input.message.trim();
  if (!body || body.length > 4096) {
    const err = new Error("Message text must be between 1 and 4096 characters.") as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    throw err;
  }

  const { phoneNumberId } = getKapsoPublicConfig();

  try {
    const response = await client.messages.sendText({
      phoneNumberId,
      to: sanitizedTo,
      body,
    });

    return {
      messageId: response.messages?.[0]?.id || null,
      to: response.contacts?.[0]?.waId || sanitizedTo,
      status: response.messages?.[0]?.messageStatus || "accepted",
    };
  } catch (error) {
    if (error instanceof GraphApiError) {
      const wrapped = new Error(error.message || "Kapso WhatsApp API rejected the message.") as Error & {
        statusCode?: number;
      };
      wrapped.statusCode = error.httpStatus || 502;
      throw wrapped;
    }
    throw error;
  }
}

export async function verifyKapsoConnection(): Promise<{
  connected: boolean;
  phoneNumberId: string;
  connectedNumber: string;
  businessName?: string;
  about?: string;
  recentMessagesCount?: number;
  error?: string;
}> {
  const config = getKapsoPublicConfig();
  const client = createKapsoClient();
  if (!client) {
    return {
      connected: false,
      phoneNumberId: config.phoneNumberId,
      connectedNumber: config.connectedNumber,
      error: "KAPSO_API_KEY is not set in server environment variables.",
    };
  }

  try {
    const [profileRes, historyRes] = await Promise.allSettled([
      client.phoneNumbers.businessProfile.get({ phoneNumberId: config.phoneNumberId }),
      client.messages.query({ phoneNumberId: config.phoneNumberId, limit: 5 }),
    ]);

    if (profileRes.status === "rejected" && historyRes.status === "rejected") {
      const reason = profileRes.reason;
      const msg =
        reason instanceof GraphApiError
          ? `${reason.message} (HTTP ${reason.httpStatus})`
          : reason instanceof Error
          ? reason.message
          : "Unable to reach Kapso WhatsApp API.";
      return {
        connected: false,
        phoneNumberId: config.phoneNumberId,
        connectedNumber: config.connectedNumber,
        error: msg,
      };
    }

    const profile =
      profileRes.status === "fulfilled" ? profileRes.value.data?.[0] : undefined;
    const recentCount =
      historyRes.status === "fulfilled" ? historyRes.value.data?.length ?? 0 : undefined;

    return {
      connected: true,
      phoneNumberId: config.phoneNumberId,
      connectedNumber: config.connectedNumber,
      businessName: profile?.accountName || "SpendWise",
      about: profile?.about,
      recentMessagesCount: recentCount,
    };
  } catch (err) {
    return {
      connected: false,
      phoneNumberId: config.phoneNumberId,
      connectedNumber: config.connectedNumber,
      error: err instanceof Error ? err.message : "Kapso verification error",
    };
  }
}

interface ExtractedMessage {
  id: string;
  from: string;
  contactName?: string;
  text: string;
  timestamp: string;
  type: string;
}

function extractMessagesFromWebhookPayload(payload: unknown): ExtractedMessage[] {
  const results: ExtractedMessage[] = [];
  if (!payload || typeof payload !== "object") {
    return results;
  }

  try {
    const normalized = normalizeWebhook(payload);
    if (normalized.messages.length > 0) {
      const contactByWaId = new Map<string, string>();
      for (const c of normalized.contacts) {
        if (c.waId && c.profile?.name) {
          contactByWaId.set(c.waId, c.profile.name);
        }
      }

      for (const msg of normalized.messages) {
        const direction = msg.kapso?.direction;
        if (direction && direction !== "inbound") continue;
        const bodyText =
          msg.text?.body ||
          (typeof msg.kapso?.content?.body === "string" ? msg.kapso.content.body : undefined) ||
          (typeof msg.kapso?.orderText === "string" ? msg.kapso.orderText : undefined) ||
          "";
        if (!bodyText.trim()) continue;
        const from = msg.from || msg.kapso?.phoneNumber || msg.fromUserId || "unknown";
        results.push({
          id: msg.id || `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          from,
          contactName: msg.kapso?.contactName || contactByWaId.get(from),
          text: bodyText.trim(),
          timestamp: msg.timestamp
            ? new Date(Number(msg.timestamp) * 1000 || msg.timestamp).toISOString()
            : new Date().toISOString(),
          type: msg.type || "text",
        });
      }
      if (results.length > 0) return results;
    }
  } catch {
    // Fall through to Kapso v2 direct event extraction
  }

  const root = payload as Record<string, unknown>;
  const candidates: Array<Record<string, unknown>> = [];
  if (root.message && typeof root.message === "object") {
    candidates.push(root);
  } else if (root.data && typeof root.data === "object") {
    candidates.push(root.data as Record<string, unknown>);
  }

  for (const cand of candidates) {
    const msg = cand.message as Record<string, unknown> | undefined;
    if (!msg) continue;
    const kapsoExt = (msg.kapso as Record<string, unknown> | undefined) || undefined;
    const direction = kapsoExt?.direction;
    if (direction && direction !== "inbound") continue;

    const textObj = msg.text as Record<string, unknown> | undefined;
    const body =
      (typeof textObj?.body === "string" && textObj.body) ||
      (typeof msg.content === "string" && msg.content) ||
      "";
    if (!body.trim()) continue;

    const conversation = cand.conversation as Record<string, unknown> | undefined;
    const from =
      (typeof msg.from === "string" && msg.from) ||
      (typeof conversation?.phone_number === "string" && conversation.phone_number) ||
      (typeof conversation?.phoneNumber === "string" && conversation.phoneNumber) ||
      "unknown";

    results.push({
      id:
        (typeof msg.id === "string" && msg.id) ||
        `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      from,
      contactName:
        (typeof kapsoExt?.contact_name === "string" && kapsoExt.contact_name) ||
        (typeof kapsoExt?.contactName === "string" && kapsoExt.contactName) ||
        undefined,
      text: body.trim(),
      timestamp: new Date().toISOString(),
      type: typeof msg.type === "string" ? msg.type : "text",
    });
  }

  return results;
}

export async function processInboundWhatsAppMessages(input: {
  payload?: unknown;
  simulated?: {
    from: string;
    contactName?: string;
    text: string;
    ownerEmail: string;
    matchedProfilePhone: string;
    defaultAccountId?: string;
  };
  eventName?: string;
  sendAutoReply?: boolean;
}): Promise<WhatsAppInboxItem[]> {
  const created: WhatsAppInboxItem[] = [];
  const config = getKapsoPublicConfig();
  const client = createKapsoClient();

  const messagesToProcess: Array<
    ExtractedMessage & {
      source: WhatsAppInboxItem["source"];
      ownerEmail: string | null;
      matchedProfilePhone: string | null;
      defaultAccountId?: string;
    }
  > = [];

  if (input.simulated) {
    messagesToProcess.push({
      id: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      from: input.simulated.from,
      contactName: input.simulated.contactName || "SpendWise Profile",
      text: input.simulated.text,
      timestamp: new Date().toISOString(),
      type: "text",
      source: "simulation",
      ownerEmail: input.simulated.ownerEmail.toLowerCase(),
      matchedProfilePhone: input.simulated.matchedProfilePhone,
      defaultAccountId: input.simulated.defaultAccountId,
    });
  } else if (input.payload) {
    const extracted = extractMessagesFromWebhookPayload(input.payload);
    for (const msg of extracted) {
      const matched = await resolveProfileForSender(msg.from);
      messagesToProcess.push({
        ...msg,
        source: "webhook",
        ownerEmail: matched ? matched.email : null,
        matchedProfilePhone: matched ? matched.displayPhone : null,
        defaultAccountId: matched?.defaultAccountId,
      });
    }
  }

  for (const msg of messagesToProcess) {
    const parsed = parseWhatsAppMessage(msg.text);
    if (parsed.parsedTx && !parsed.parsedTx.accountHint && msg.defaultAccountId) {
      parsed.parsedTx.defaultAccountId = msg.defaultAccountId;
    }

    const item: WhatsAppInboxItem = {
      id: msg.id,
      messageId: msg.id,
      from: msg.from,
      contactName: msg.contactName,
      text: msg.text,
      timestamp: msg.timestamp,
      source: msg.source,
      event: input.eventName || "whatsapp.message.received",
      kind: parsed.kind,
      command: parsed.command,
      parsedTx: parsed.parsedTx,
      replySent: false,
      replyError: null,
      syncedToClient: false,
      syncedAt: null,
      ownerEmail: msg.ownerEmail,
      matchedProfilePhone: msg.matchedProfilePhone,
    };

    const inserted = pushInboxItem(item);
    if (!inserted) continue;

    if (msg.source === "webhook" && input.sendAutoReply !== false && client) {
      const replyBody = buildAutoReplyMessage(item);
      const replyTarget = sanitizePhoneNumber(msg.from);

      try {
        await client.messages.markRead({
          phoneNumberId: config.phoneNumberId,
          messageId: msg.id,
        });
      } catch {
        // Non-fatal
      }

      if (replyBody && replyTarget) {
        try {
          await client.messages.sendText({
            phoneNumberId: config.phoneNumberId,
            to: replyTarget,
            body: replyBody,
          });
          item.replySent = true;
          persistState();
        } catch (err) {
          item.replyError = err instanceof Error ? err.message : "Auto-reply failed";
          persistState();
        }
      }
    }

    created.push(item);
  }

  return created;
}

export async function pullRecentInboundFromKapso(ownerEmail: string): Promise<{
  addedCount: number;
  profilePhoneRequired: boolean;
}> {
  const binding = getProfileBindingForUser(ownerEmail);
  if (!binding) {
    return { addedCount: 0, profilePhoneRequired: true };
  }

  const client = createKapsoClient();
  if (!client) return { addedCount: 0, profilePhoneRequired: false };
  const { phoneNumberId } = getKapsoPublicConfig();

  try {
    const res = await client.messages.query({
      phoneNumberId,
      direction: "inbound",
      limit: 20,
    });
    let addedCount = 0;
    for (const msg of res.data || []) {
      const bodyText =
        msg.text?.body ||
        (typeof msg.kapso?.content?.body === "string" ? msg.kapso.content.body : "");
      if (!bodyText.trim()) continue;
      const from = msg.from || msg.kapso?.phoneNumber || msg.fromUserId || "unknown";

      // Only pull messages sent from the phone number attached to this user's profile
      if (!arePhonesMatched(from, binding.phoneDigits)) {
        continue;
      }

      const parsed = parseWhatsAppMessage(bodyText);
      if (parsed.parsedTx && !parsed.parsedTx.accountHint && binding.defaultAccountId) {
        parsed.parsedTx.defaultAccountId = binding.defaultAccountId;
      }

      const item: WhatsAppInboxItem = {
        id: msg.id,
        messageId: msg.id,
        from,
        contactName: msg.kapso?.contactName,
        text: bodyText.trim(),
        timestamp: msg.timestamp
          ? new Date(Number(msg.timestamp) * 1000 || msg.timestamp).toISOString()
          : new Date().toISOString(),
        source: "kapso_sync",
        event: "whatsapp.message.received",
        kind: parsed.kind,
        command: parsed.command,
        parsedTx: parsed.parsedTx,
        replySent: false,
        replyError: null,
        syncedToClient: false,
        syncedAt: null,
        ownerEmail: binding.email,
        matchedProfilePhone: binding.displayPhone,
      };
      if (pushInboxItem(item)) {
        addedCount += 1;
      }
    }
    return { addedCount, profilePhoneRequired: false };
  } catch {
    return { addedCount: 0, profilePhoneRequired: false };
  }
}

export function listInboxItemsForUser(userEmail: string): WhatsAppInboxItem[] {
  const email = userEmail.trim().toLowerCase();
  return inboxItems.filter((item) => item.ownerEmail === email);
}

export function acknowledgeInboxItems(ids: string[], userEmail: string): number {
  const email = userEmail.trim().toLowerCase();
  const idSet = new Set(ids);
  const now = new Date().toISOString();
  let updated = 0;
  for (const item of inboxItems) {
    if (idSet.has(item.id) && item.ownerEmail === email && !item.syncedToClient) {
      item.syncedToClient = true;
      item.syncedAt = now;
      updated += 1;
    }
  }
  if (updated > 0) {
    persistState();
  }
  return updated;
}
