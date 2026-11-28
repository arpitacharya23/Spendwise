import fs from "node:fs";
import path from "node:path";
import { normalizeWebhook } from "@kapso/whatsapp-cloud-api/server";
import {
  arePhonesMatched,
  createKapsoClient,
  getKapsoPublicConfig,
  KapsoPublicConfig,
  normalizeProfilePhone,
  sanitizePhoneNumber,
  sendWhatsAppChunkedReply,
  sendWhatsAppTextMessage,
  verifyIncomingWebhookSignature,
  verifyKapsoConnection,
} from "./kapsoConfig";
import {
  getProfileBindingForUser,
  getWhatsAppLinkStatusForUser,
  ProfilePhoneBinding,
  requestWhatsAppOtp,
  resolveVerifiedProfileForSender,
  syncProfilePhoneMetadata,
  tryVerifyWhatsAppOtpFromInbound,
  unlinkWhatsAppForUser,
  verifyWhatsAppOtpForUser,
} from "./whatsappOtp";
import {
  clearConversationSessionsForUser,
  handleConversationalWhatsAppMessage,
} from "./whatsappAssistant";
import { SupabaseServerConfigError, tryCreateServiceRoleClient } from "./spendwiseSupabase";

export type { KapsoPublicConfig, ProfilePhoneBinding };
export {
  arePhonesMatched,
  getKapsoPublicConfig,
  getProfileBindingForUser,
  getWhatsAppLinkStatusForUser,
  normalizeProfilePhone,
  requestWhatsAppOtp,
  sanitizePhoneNumber,
  sendWhatsAppTextMessage,
  unlinkWhatsAppForUser,
  verifyIncomingWebhookSignature,
  verifyKapsoConnection,
  verifyWhatsAppOtpForUser,
};

export interface WhatsAppInboxItem {
  id: string;
  messageId: string;
  from: string;
  contactName?: string;
  text: string;
  replyText?: string | null;
  timestamp: string;
  source: "webhook" | "simulation" | "kapso_sync" | "assistant_chat";
  event: string;
  kind: "assistant" | "otp" | "unverified" | "message";
  dataMutated: boolean;
  requiresConfirmation: boolean;
  replySent: boolean;
  replyError: string | null;
  syncedToClient: boolean;
  syncedAt: string | null;
  ownerEmail: string | null;
  matchedProfilePhone: string | null;
}

interface PersistedKapsoInboxState {
  inboxItems: WhatsAppInboxItem[];
  processedMessageIds: string[];
}

const MAX_INBOX_ITEMS = 200;
const MAX_PROCESSED_IDS = 1000;
const STATE_FILE_PATH =
  process.env.KAPSO_INBOX_STATE_FILE?.trim() ||
  path.join("/tmp", "spendwise-kapso-whatsapp-inbox.json");

const inboxItems: WhatsAppInboxItem[] = [];
const processedMessageIds = new Set<string>();

function loadPersistedInboxState() {
  try {
    if (!fs.existsSync(STATE_FILE_PATH)) return;
    const raw = fs.readFileSync(STATE_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<PersistedKapsoInboxState>;
    if (Array.isArray(parsed.processedMessageIds)) {
      for (const id of parsed.processedMessageIds.slice(-MAX_PROCESSED_IDS)) {
        if (typeof id === "string" && id) processedMessageIds.add(id);
      }
    }
    if (Array.isArray(parsed.inboxItems)) {
      for (const item of parsed.inboxItems.slice(0, MAX_INBOX_ITEMS)) {
        if (item?.messageId) {
          processedMessageIds.add(item.messageId);
          inboxItems.push(item);
        }
      }
    }
  } catch {
    // Non-fatal
  }
}

function persistInboxState() {
  try {
    const payload: PersistedKapsoInboxState = {
      inboxItems: inboxItems.slice(0, MAX_INBOX_ITEMS),
      processedMessageIds: Array.from(processedMessageIds).slice(-MAX_PROCESSED_IDS),
    };
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(payload), {
      encoding: "utf8",
      mode: 0o600,
    });
  } catch {
    // Non-fatal
  }
}

loadPersistedInboxState();

async function claimIdempotentMessageId(
  messageId: string,
  ownerEmail: string | null,
  fromPhone: string
): Promise<boolean> {
  if (!messageId || processedMessageIds.has(messageId)) {
    return false;
  }

  const adminClient = tryCreateServiceRoleClient();
  if (adminClient) {
    try {
      const { error } = await adminClient.from("whatsapp_processed_events").insert({
        event_id: messageId,
        user_email: ownerEmail,
        phone_digits: fromPhone.replace(/[^\d]/g, "") || null,
      });
      // Postgres unique_violation code 23505 means already processed by another instance
      if (error && error.code === "23505") {
        processedMessageIds.add(messageId);
        persistInboxState();
        return false;
      }
    } catch {
      // Non-fatal if migration table isn't applied yet
    }
  }

  processedMessageIds.add(messageId);
  persistInboxState();
  return true;
}

function pushInboxItem(item: WhatsAppInboxItem) {
  inboxItems.unshift(item);
  if (inboxItems.length > MAX_INBOX_ITEMS) {
    inboxItems.splice(MAX_INBOX_ITEMS);
  }
  persistInboxState();
}

export function registerProfilePhoneBinding(input: {
  email: string;
  phone?: string | null;
  countryCode?: string | null;
}): { binding: ProfilePhoneBinding | null; reconciledCount: number } {
  const binding = syncProfilePhoneMetadata({
    email: input.email,
    phone: input.phone,
    countryCode: input.countryCode,
    preserveVerifiedIfSamePhone: true,
  });
  return { binding, reconciledCount: 0 };
}

interface ExtractedMessage {
  id: string;
  from: string;
  contactName?: string;
  text: string;
  timestamp: string;
  type: string;
}

export function extractMessagesFromWebhookPayload(payload: unknown): ExtractedMessage[] {
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
    userToken: string;
    matchedProfilePhone: string;
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
      simulatedAuth?: { ownerEmail: string; userToken: string; matchedProfilePhone: string };
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
      simulatedAuth: {
        ownerEmail: input.simulated.ownerEmail.toLowerCase(),
        userToken: input.simulated.userToken,
        matchedProfilePhone: input.simulated.matchedProfilePhone,
      },
    });
  } else if (input.payload) {
    const extracted = extractMessagesFromWebhookPayload(input.payload);
    for (const msg of extracted) {
      messagesToProcess.push({
        ...msg,
        source: "webhook",
      });
    }
  }

  for (const msg of messagesToProcess) {
    // 1. Check inbound WhatsApp OTP verification command ("LINK 123456" / "VERIFY 123456")
    const otpAttempt = await tryVerifyWhatsAppOtpFromInbound(msg.from, msg.text);

    let ownerEmail: string | null = null;
    let matchedProfilePhone: string | null = null;
    let replyText = "";
    let kind: WhatsAppInboxItem["kind"] = "message";
    let dataMutated = false;
    let requiresConfirmation = false;

    if (otpAttempt.handled) {
      ownerEmail = otpAttempt.binding?.email || null;
      matchedProfilePhone = otpAttempt.binding?.displayPhone || null;
      replyText = otpAttempt.replyText || "Verification check completed.";
      kind = "otp";
    } else if (msg.simulatedAuth) {
      ownerEmail = msg.simulatedAuth.ownerEmail;
      matchedProfilePhone = msg.simulatedAuth.matchedProfilePhone;
    } else {
      const verified = await resolveVerifiedProfileForSender(msg.from);
      if (verified) {
        ownerEmail = verified.email;
        matchedProfilePhone = verified.displayPhone;
      }
    }

    // 2. Claim idempotency key BEFORE executing any AI or database write
    const claimed = await claimIdempotentMessageId(msg.id, ownerEmail, msg.from);
    if (!claimed) {
      continue;
    }

    // 3. Route verified users to Gemini Assistant; reject unlinked/unverified numbers
    if (!otpAttempt.handled) {
      if (!ownerEmail) {
        kind = "unverified";
        replyText = [
          "*SpendWise*",
          "This WhatsApp number is not linked and verified with a SpendWise account yet.",
          "Open SpendWise → Settings → WhatsApp Integration, attach your phone number, and verify it with a 6-digit code to access your finances.",
        ].join("\n");
      } else {
        kind = "assistant";
        try {
          const assistantRes = await handleConversationalWhatsAppMessage({
            ctx: msg.simulatedAuth
              ? { userEmail: ownerEmail, userToken: msg.simulatedAuth.userToken }
              : { userEmail: ownerEmail, useServiceRole: true },
            phoneDigits: msg.from.replace(/[^\d]/g, ""),
            text: msg.text,
          });
          replyText = assistantRes.replyText;
          dataMutated = assistantRes.dataMutated;
          requiresConfirmation = assistantRes.requiresConfirmation;
        } catch (err) {
          if (err instanceof SupabaseServerConfigError) {
            replyText =
              "SpendWise server database configuration is incomplete for background WhatsApp webhooks. Please verify server environment settings.";
          } else {
            replyText =
              "Unable to process that SpendWise request right now. Please try again in a moment.";
          }
        }
      }
    }

    const item: WhatsAppInboxItem = {
      id: msg.id,
      messageId: msg.id,
      from: msg.from,
      contactName: msg.contactName,
      text: msg.text,
      replyText,
      timestamp: msg.timestamp,
      source: msg.source,
      event: input.eventName || "whatsapp.message.received",
      kind,
      dataMutated,
      requiresConfirmation,
      replySent: false,
      replyError: null,
      syncedToClient: !dataMutated,
      syncedAt: dataMutated ? null : new Date().toISOString(),
      ownerEmail,
      matchedProfilePhone,
    };

    if (msg.source === "webhook" && input.sendAutoReply !== false && client) {
      const replyTarget = sanitizePhoneNumber(msg.from);
      try {
        await client.messages.markRead({
          phoneNumberId: config.phoneNumberId,
          messageId: msg.id,
        });
      } catch {
        // Non-fatal
      }

      if (replyText && replyTarget) {
        const delivery = await sendWhatsAppChunkedReply({
          to: replyTarget,
          message: replyText,
        });
        if (delivery.sentCount > 0 && !delivery.error) {
          item.replySent = true;
        } else if (delivery.error) {
          item.replyError = delivery.error;
        }
      }
    }

    pushInboxItem(item);
    created.push(item);
  }

  return created;
}

export async function runAuthenticatedWhatsAppChat(input: {
  userEmail: string;
  userToken: string;
  text: string;
  contactName?: string;
}): Promise<{
  item: WhatsAppInboxItem;
  replyText: string;
  dataMutated: boolean;
  requiresConfirmation: boolean;
  activeAccountId?: string;
  activeAccountName?: string;
  errorCode?: string;
}> {
  const email = input.userEmail.trim().toLowerCase();
  const binding = getProfileBindingForUser(email);

  if (!binding || !binding.verified) {
    const err = new Error(
      "Link and verify your WhatsApp number via OTP before using the WhatsApp AI Assistant."
    ) as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }

  const res = await handleConversationalWhatsAppMessage({
    ctx: { userEmail: email, userToken: input.userToken },
    phoneDigits: binding.phoneDigits,
    text: input.text,
  });

  const msgId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  processedMessageIds.add(msgId);

  const item: WhatsAppInboxItem = {
    id: msgId,
    messageId: msgId,
    from: binding.displayPhone,
    contactName: input.contactName || "SpendWise User",
    text: input.text.trim(),
    replyText: res.replyText,
    timestamp: new Date().toISOString(),
    source: "assistant_chat",
    event: "whatsapp.assistant.chat",
    kind: "assistant",
    dataMutated: res.dataMutated,
    requiresConfirmation: res.requiresConfirmation,
    replySent: false,
    replyError: null,
    syncedToClient: !res.dataMutated,
    syncedAt: res.dataMutated ? null : new Date().toISOString(),
    ownerEmail: email,
    matchedProfilePhone: binding.displayPhone,
  };

  pushInboxItem(item);

  return {
    item,
    replyText: res.replyText,
    dataMutated: res.dataMutated,
    requiresConfirmation: res.requiresConfirmation,
    activeAccountId: res.activeAccountId,
    activeAccountName: res.activeAccountName,
    errorCode: res.errorCode,
  };
}

export async function pullRecentInboundFromKapso(ownerEmail: string): Promise<{
  addedCount: number;
  profilePhoneRequired: boolean;
  verificationRequired: boolean;
}> {
  const binding = getProfileBindingForUser(ownerEmail);
  if (!binding) {
    return { addedCount: 0, profilePhoneRequired: true, verificationRequired: true };
  }
  if (!binding.verified) {
    return { addedCount: 0, profilePhoneRequired: false, verificationRequired: true };
  }

  const client = createKapsoClient();
  if (!client) return { addedCount: 0, profilePhoneRequired: false, verificationRequired: false };
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

      if (!arePhonesMatched(from, binding.phoneDigits)) {
        continue;
      }

      const claimed = await claimIdempotentMessageId(msg.id, binding.email, from);
      if (!claimed) continue;

      let replyText = "";
      let dataMutated = false;
      let requiresConfirmation = false;

      try {
        const assistantRes = await handleConversationalWhatsAppMessage({
          ctx: { userEmail: binding.email, useServiceRole: true },
          phoneDigits: binding.phoneDigits,
          text: bodyText.trim(),
        });
        replyText = assistantRes.replyText;
        dataMutated = assistantRes.dataMutated;
        requiresConfirmation = assistantRes.requiresConfirmation;
      } catch {
        replyText = "Received via Kapso sync.";
      }

      const item: WhatsAppInboxItem = {
        id: msg.id,
        messageId: msg.id,
        from,
        contactName: msg.kapso?.contactName,
        text: bodyText.trim(),
        replyText,
        timestamp: msg.timestamp
          ? new Date(Number(msg.timestamp) * 1000 || msg.timestamp).toISOString()
          : new Date().toISOString(),
        source: "kapso_sync",
        event: "whatsapp.message.received",
        kind: "assistant",
        dataMutated,
        requiresConfirmation,
        replySent: false,
        replyError: null,
        syncedToClient: !dataMutated,
        syncedAt: dataMutated ? null : new Date().toISOString(),
        ownerEmail: binding.email,
        matchedProfilePhone: binding.displayPhone,
      };
      pushInboxItem(item);
      addedCount += 1;
    }
    return { addedCount, profilePhoneRequired: false, verificationRequired: false };
  } catch {
    return { addedCount: 0, profilePhoneRequired: false, verificationRequired: false };
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
    persistInboxState();
  }
  return updated;
}

export function clearUserWhatsAppRuntime(userEmail: string) {
  clearConversationSessionsForUser(userEmail);
}
