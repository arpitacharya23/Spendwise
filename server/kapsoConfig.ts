import { WhatsAppClient, GraphApiError } from "@kapso/whatsapp-cloud-api";
import {
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
  geminiConfigured: boolean;
  supabaseServiceRoleConfigured: boolean;
}

const DEFAULT_KAPSO_PROJECT_ID = "d2e5058e-fd40-43c7-a180-23b0e085399e";
const DEFAULT_WHATSAPP_CONFIG_ID = "163330a8-e3e1-4673-b1cb-626000d0c18b";
const DEFAULT_PHONE_NUMBER_ID = "1561127940407191";
const DEFAULT_CONNECTED_NUMBER = "+91 94188 32998";
const KAPSO_BASE_URL = "https://api.kapso.ai/meta/whatsapp";

export function getKapsoPublicConfig(): KapsoPublicConfig {
  const apiKey = process.env.KAPSO_API_KEY?.trim() || "";
  const webhookSecret = process.env.KAPSO_WEBHOOK_SECRET?.trim() || "";
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  return {
    projectId: process.env.KAPSO_PROJECT_ID?.trim() || DEFAULT_KAPSO_PROJECT_ID,
    projectName: "SpendWise",
    whatsappConfigId: process.env.KAPSO_WHATSAPP_CONFIG_ID?.trim() || DEFAULT_WHATSAPP_CONFIG_ID,
    phoneNumberId: process.env.KAPSO_PHONE_NUMBER_ID?.trim() || DEFAULT_PHONE_NUMBER_ID,
    connectedNumber: process.env.KAPSO_CONNECTED_NUMBER?.trim() || DEFAULT_CONNECTED_NUMBER,
    baseUrl: KAPSO_BASE_URL,
    apiKeyConfigured: Boolean(apiKey),
    webhookSecretConfigured: Boolean(webhookSecret),
    geminiConfigured: Boolean(geminiKey),
    supabaseServiceRoleConfigured: Boolean(serviceRoleKey),
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

export function chunkWhatsAppMessage(text: string, maxLength = 3500): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= maxLength) return [clean];

  const chunks: string[] = [];
  let remaining = clean;

  while (remaining.length > maxLength) {
    let splitIdx = remaining.lastIndexOf("\n\n", maxLength);
    if (splitIdx < Math.floor(maxLength * 0.4)) {
      splitIdx = remaining.lastIndexOf("\n", maxLength);
    }
    if (splitIdx < Math.floor(maxLength * 0.4)) {
      splitIdx = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIdx <= 0) {
      splitIdx = maxLength;
    }

    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
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

export async function sendWhatsAppChunkedReply(input: {
  to: string;
  message: string;
}): Promise<{ sentCount: number; messageIds: string[]; error?: string }> {
  const chunks = chunkWhatsAppMessage(input.message, 3500);
  const messageIds: string[] = [];

  for (const chunk of chunks) {
    try {
      const res = await sendWhatsAppTextMessage({ to: input.to, message: chunk });
      if (res.messageId) messageIds.push(res.messageId);
    } catch (err) {
      return {
        sentCount: messageIds.length,
        messageIds,
        error: err instanceof Error ? err.message : "Failed to deliver WhatsApp reply",
      };
    }
  }

  return { sentCount: chunks.length, messageIds };
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
