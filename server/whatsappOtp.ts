import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  arePhonesMatched,
  getKapsoPublicConfig,
  normalizeProfilePhone,
  sendWhatsAppTextMessage,
} from "./kapsoConfig";
import {
  createScopedSupabaseClient,
  SupabaseAccessContext,
  syncProfileWhatsAppStatus,
  tryCreateServiceRoleClient,
} from "./spendwiseSupabase";

export interface ProfilePhoneBinding {
  email: string;
  phoneDigits: string;
  displayPhone: string;
  verified: boolean;
  verifiedAt?: string;
  updatedAt: string;
}

export interface WhatsAppOtpChallenge {
  id: string;
  email: string;
  phoneDigits: string;
  displayPhone: string;
  salt: string;
  otpHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: string;
  createdAt: string;
}

const STATE_FILE_PATH =
  process.env.KAPSO_STATE_FILE?.trim() ||
  path.join("/tmp", "spendwise-kapso-whatsapp-auth.json");

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const bindingsByEmail = new Map<string, ProfilePhoneBinding>();
const otpChallengesByEmail = new Map<string, WhatsAppOtpChallenge>();

function loadAuthState() {
  try {
    if (!fs.existsSync(STATE_FILE_PATH)) return;
    const raw = fs.readFileSync(STATE_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as {
      bindings?: ProfilePhoneBinding[];
      challenges?: WhatsAppOtpChallenge[];
    };
    if (Array.isArray(parsed.bindings)) {
      for (const b of parsed.bindings) {
        if (b?.email && b?.phoneDigits) {
          bindingsByEmail.set(b.email.toLowerCase(), {
            ...b,
            email: b.email.toLowerCase(),
            verified: Boolean(b.verified),
          });
        }
      }
    }
    if (Array.isArray(parsed.challenges)) {
      const now = Date.now();
      for (const c of parsed.challenges) {
        if (c?.email && c?.expiresAt && new Date(c.expiresAt).getTime() > now) {
          otpChallengesByEmail.set(c.email.toLowerCase(), {
            ...c,
            email: c.email.toLowerCase(),
          });
        }
      }
    }
  } catch {
    // Non-fatal cache read failure
  }
}

function persistAuthState() {
  try {
    const payload = {
      bindings: Array.from(bindingsByEmail.values()),
      challenges: Array.from(otpChallengesByEmail.values()),
    };
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(payload), {
      encoding: "utf8",
      mode: 0o600,
    });
  } catch {
    // Non-fatal in read-only environments
  }
}

loadAuthState();

function hashOtpCode(salt: string, otp: string): string {
  return crypto.createHash("sha256").update(`${salt}:${otp}`).digest("hex");
}

function constantTimeMatchHex(hexA: string, hexB: string): boolean {
  const bufA = Buffer.from(hexA, "hex");
  const bufB = Buffer.from(hexB, "hex");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function getProfileBindingForUser(userEmail: string): ProfilePhoneBinding | null {
  return bindingsByEmail.get(userEmail.trim().toLowerCase()) || null;
}

export function getWhatsAppLinkStatusForUser(userEmail: string): {
  binding: ProfilePhoneBinding | null;
  otpPending: boolean;
  pendingPhone?: string;
  otpExpiresAt?: string;
} {
  const email = userEmail.trim().toLowerCase();
  const binding = bindingsByEmail.get(email) || null;
  const challenge = otpChallengesByEmail.get(email);
  const validChallenge =
    challenge && new Date(challenge.expiresAt).getTime() > Date.now() ? challenge : null;

  if (challenge && !validChallenge) {
    otpChallengesByEmail.delete(email);
    persistAuthState();
  }

  return {
    binding,
    otpPending: Boolean(validChallenge),
    pendingPhone: validChallenge?.displayPhone,
    otpExpiresAt: validChallenge?.expiresAt,
  };
}

export function syncProfilePhoneMetadata(input: {
  email: string;
  phone?: string | null;
  countryCode?: string | null;
  preserveVerifiedIfSamePhone?: boolean;
}): ProfilePhoneBinding | null {
  const email = input.email.trim().toLowerCase();
  const normalized = normalizeProfilePhone(input.phone, input.countryCode);

  if (!normalized) {
    bindingsByEmail.delete(email);
    otpChallengesByEmail.delete(email);
    persistAuthState();
    return null;
  }

  const existing = bindingsByEmail.get(email);
  const isSameNumber = Boolean(
    existing && arePhonesMatched(existing.phoneDigits, normalized.phoneDigits)
  );
  const keepVerified = Boolean(input.preserveVerifiedIfSamePhone && isSameNumber && existing?.verified);

  const binding: ProfilePhoneBinding = {
    email,
    phoneDigits: normalized.phoneDigits,
    displayPhone: normalized.displayPhone,
    verified: keepVerified,
    verifiedAt: keepVerified ? existing?.verifiedAt : undefined,
    updatedAt: new Date().toISOString(),
  };

  bindingsByEmail.set(email, binding);
  persistAuthState();
  return binding;
}

export async function requestWhatsAppOtp(
  ctx: SupabaseAccessContext,
  input: { phone: string; countryCode?: string }
): Promise<{
  success: boolean;
  displayPhone?: string;
  expiresAt?: string;
  sentViaWhatsApp: boolean;
  deliveryNote: string;
  previewOtp?: string;
  error?: string;
}> {
  const email = ctx.userEmail.trim().toLowerCase();
  const normalized = normalizeProfilePhone(input.phone, input.countryCode);
  if (!normalized) {
    return {
      success: false,
      sentViaWhatsApp: false,
      deliveryNote: "",
      error: "Enter a valid mobile number with country code (7-15 digits).",
    };
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  const salt = crypto.randomBytes(16).toString("hex");
  const otpHash = hashOtpCode(salt, otp);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS).toISOString();
  const challengeId = `otp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const challenge: WhatsAppOtpChallenge = {
    id: challengeId,
    email,
    phoneDigits: normalized.phoneDigits,
    displayPhone: normalized.displayPhone,
    salt,
    otpHash,
    attempts: 0,
    maxAttempts: MAX_OTP_ATTEMPTS,
    expiresAt,
    createdAt: now.toISOString(),
  };

  otpChallengesByEmail.set(email, challenge);

  // Store pending unverified phone binding until OTP completes
  const existing = bindingsByEmail.get(email);
  const sameVerified = Boolean(
    existing?.verified && arePhonesMatched(existing.phoneDigits, normalized.phoneDigits)
  );
  bindingsByEmail.set(email, {
    email,
    phoneDigits: normalized.phoneDigits,
    displayPhone: normalized.displayPhone,
    verified: sameVerified,
    verifiedAt: sameVerified ? existing?.verifiedAt : undefined,
    updatedAt: now.toISOString(),
  });
  persistAuthState();

  // Persist challenge in Supabase if table exists (non-fatal if migration hasn't run)
  try {
    const client = createScopedSupabaseClient(ctx);
    await client.from("whatsapp_otp_challenges").insert({
      id: challenge.id,
      user_email: email,
      phone_digits: challenge.phoneDigits,
      display_phone: challenge.displayPhone,
      otp_hash: `${salt}:${otpHash}`,
      attempts: 0,
      expires_at: expiresAt,
    });
  } catch {
    // Non-fatal if optional migration table is not yet applied
  }

  const config = getKapsoPublicConfig();
  let sentViaWhatsApp = false;
  let deliveryNote = "";

  if (config.apiKeyConfigured) {
    try {
      await sendWhatsAppTextMessage({
        to: normalized.phoneDigits,
        message: [
          `*SpendWise Verification Code:* ${otp}`,
          `Use this code in SpendWise Settings → WhatsApp Integration (valid for 10 minutes), or reply here with:`,
          `LINK ${otp}`,
        ].join("\n"),
      });
      sentViaWhatsApp = true;
      deliveryNote = `Verification code sent to ${normalized.displayPhone} via WhatsApp.`;
    } catch (err) {
      deliveryNote = `Could not send WhatsApp OTP automatically (${
        err instanceof Error ? err.message : "Kapso error"
      }).`;
    }
  } else {
    deliveryNote =
      "KAPSO_API_KEY is not configured in the server environment, so outbound WhatsApp delivery is disabled. Enter the preview verification code below or simulate sending `LINK <code>` from WhatsApp.";
  }

  return {
    success: true,
    displayPhone: normalized.displayPhone,
    expiresAt,
    sentViaWhatsApp,
    deliveryNote,
    // Only expose previewOtp when Kapso outbound delivery is unavailable (local/preview env)
    previewOtp: !sentViaWhatsApp ? otp : undefined,
  };
}

async function finalizeVerifiedBinding(
  challenge: WhatsAppOtpChallenge,
  ctx?: SupabaseAccessContext
): Promise<ProfilePhoneBinding> {
  const nowIso = new Date().toISOString();

  // Ensure no other user holds a verified link on this exact phone number
  for (const [otherEmail, b] of bindingsByEmail.entries()) {
    if (otherEmail !== challenge.email && b.verified && arePhonesMatched(b.phoneDigits, challenge.phoneDigits)) {
      bindingsByEmail.set(otherEmail, {
        ...b,
        verified: false,
        verifiedAt: undefined,
        updatedAt: nowIso,
      });
    }
  }

  const verifiedBinding: ProfilePhoneBinding = {
    email: challenge.email,
    phoneDigits: challenge.phoneDigits,
    displayPhone: challenge.displayPhone,
    verified: true,
    verifiedAt: nowIso,
    updatedAt: nowIso,
  };

  bindingsByEmail.set(challenge.email, verifiedBinding);
  otpChallengesByEmail.delete(challenge.email);
  persistAuthState();

  const targetCtx: SupabaseAccessContext | null =
    ctx || (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ? { userEmail: challenge.email, useServiceRole: true } : null);

  if (targetCtx) {
    await syncProfileWhatsAppStatus(targetCtx, {
      verified: true,
      whatsappDisplayPhone: verifiedBinding.displayPhone,
    });
    try {
      const client = createScopedSupabaseClient(targetCtx);
      await client
        .from("whatsapp_otp_challenges")
        .update({ verified_at: nowIso })
        .eq("id", challenge.id);
    } catch {
      // Non-fatal
    }
  }

  return verifiedBinding;
}

export async function verifyWhatsAppOtpForUser(
  ctx: SupabaseAccessContext,
  code: string
): Promise<{ verified: boolean; binding?: ProfilePhoneBinding; error?: string }> {
  const email = ctx.userEmail.trim().toLowerCase();
  const cleanCode = code.replace(/[^\d]/g, "");
  if (cleanCode.length !== 6) {
    return { verified: false, error: "Enter the 6-digit verification code." };
  }

  const challenge = otpChallengesByEmail.get(email);
  if (!challenge) {
    return { verified: false, error: "No active OTP verification request found. Request a new code." };
  }

  if (Date.now() > new Date(challenge.expiresAt).getTime()) {
    otpChallengesByEmail.delete(email);
    persistAuthState();
    return { verified: false, error: "Verification code has expired. Request a new code." };
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    otpChallengesByEmail.delete(email);
    persistAuthState();
    return { verified: false, error: "Too many invalid attempts. Request a new verification code." };
  }

  const candidateHash = hashOtpCode(challenge.salt, cleanCode);
  if (!constantTimeMatchHex(challenge.otpHash, candidateHash)) {
    challenge.attempts += 1;
    otpChallengesByEmail.set(email, challenge);
    persistAuthState();
    const remaining = Math.max(0, challenge.maxAttempts - challenge.attempts);
    return {
      verified: false,
      error:
        remaining > 0
          ? `Invalid verification code. ${remaining} attempt(s) remaining.`
          : "Invalid verification code. Maximum attempts reached; request a new code.",
    };
  }

  const binding = await finalizeVerifiedBinding(challenge, ctx);
  return { verified: true, binding };
}

export async function tryVerifyWhatsAppOtpFromInbound(
  fromPhone: string,
  text: string
): Promise<{
  handled: boolean;
  verified: boolean;
  binding?: ProfilePhoneBinding;
  replyText?: string;
}> {
  const match = text.trim().match(/^(?:link|verify)\s+(\d{6})$/i);
  if (!match) {
    return { handled: false, verified: false };
  }

  const code = match[1];
  const incomingDigits = fromPhone.replace(/[^\d]/g, "");
  if (incomingDigits.length < 7) {
    return {
      handled: true,
      verified: false,
      replyText: "Unable to verify sender phone number.",
    };
  }

  const matchingChallenges = Array.from(otpChallengesByEmail.values()).filter(
    (c) => arePhonesMatched(incomingDigits, c.phoneDigits) && Date.now() <= new Date(c.expiresAt).getTime()
  );

  if (matchingChallenges.length === 0) {
    return {
      handled: true,
      verified: false,
      replyText:
        "No active SpendWise OTP verification request was found for this number. Request a new verification code from SpendWise → Settings → WhatsApp Integration.",
    };
  }

  for (const challenge of matchingChallenges) {
    if (challenge.attempts >= challenge.maxAttempts) continue;
    const candidateHash = hashOtpCode(challenge.salt, code);
    if (constantTimeMatchHex(challenge.otpHash, candidateHash)) {
      const binding = await finalizeVerifiedBinding(challenge);
      return {
        handled: true,
        verified: true,
        binding,
        replyText: `Verified! Your WhatsApp number (${binding.displayPhone}) is now linked to ${binding.email}. You can now ask about your accounts, balances, EMIs, or log transactions.`,
      };
    }
    challenge.attempts += 1;
    otpChallengesByEmail.set(challenge.email, challenge);
  }

  persistAuthState();
  return {
    handled: true,
    verified: false,
    replyText: "Invalid or expired verification code. Please check the code in SpendWise Settings and try again.",
  };
}

export async function unlinkWhatsAppForUser(
  ctx: SupabaseAccessContext
): Promise<{ unlinked: boolean; previousPhone?: string }> {
  const email = ctx.userEmail.trim().toLowerCase();
  const prev = bindingsByEmail.get(email);
  bindingsByEmail.delete(email);
  otpChallengesByEmail.delete(email);
  persistAuthState();

  await syncProfileWhatsAppStatus(ctx, {
    verified: false,
    phoneLocalOrFull: null,
    whatsappDisplayPhone: null,
  });

  try {
    const client = createScopedSupabaseClient(ctx);
    await client.from("whatsapp_conversations").delete().eq("user_email", email);
    await client.from("whatsapp_otp_challenges").delete().eq("user_email", email);
  } catch {
    // Non-fatal if optional migration tables are absent
  }

  return {
    unlinked: true,
    previousPhone: prev?.displayPhone,
  };
}

export async function resolveVerifiedProfileForSender(
  fromPhone: string
): Promise<ProfilePhoneBinding | null> {
  const incomingDigits = fromPhone.replace(/[^\d]/g, "");
  if (incomingDigits.length < 7) return null;

  for (const binding of bindingsByEmail.values()) {
    if (binding.verified && arePhonesMatched(incomingDigits, binding.phoneDigits)) {
      return binding;
    }
  }

  // Fallback: check Supabase profiles with whatsapp_verified = true when service role is present
  const adminClient = tryCreateServiceRoleClient();
  if (!adminClient) return null;

  try {
    const { data, error } = await adminClient
      .from("profiles")
      .select("email, phone, country_code, whatsapp_verified, whatsapp_phone, whatsapp_linked_at")
      .eq("whatsapp_verified", true);

    if (error || !data) return null;

    for (const row of data) {
      if (!row.email) continue;
      const candidatePhone = row.whatsapp_phone || row.phone;
      const normalized = normalizeProfilePhone(candidatePhone, row.country_code);
      if (normalized && arePhonesMatched(incomingDigits, normalized.phoneDigits)) {
        const binding: ProfilePhoneBinding = {
          email: String(row.email).toLowerCase(),
          phoneDigits: normalized.phoneDigits,
          displayPhone: normalized.displayPhone,
          verified: true,
          verifiedAt: row.whatsapp_linked_at || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        bindingsByEmail.set(binding.email, binding);
        persistAuthState();
        return binding;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function resetOtpStateForTesting() {
  bindingsByEmail.clear();
  otpChallengesByEmail.clear();
  persistAuthState();
}
