import "dotenv/config";
import express from "express";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { createServer as createViteServer } from "vite";
import {
  acknowledgeInboxItems,
  arePhonesMatched,
  clearUserWhatsAppRuntime,
  getKapsoPublicConfig,
  getProfileBindingForUser,
  getWhatsAppLinkStatusForUser,
  listInboxItemsForUser,
  processInboundWhatsAppMessages,
  pullRecentInboundFromKapso,
  registerProfilePhoneBinding,
  requestWhatsAppOtp,
  runAuthenticatedWhatsAppChat,
  sanitizePhoneNumber,
  sendWhatsAppTextMessage,
  unlinkWhatsAppForUser,
  verifyIncomingWebhookSignature,
  verifyKapsoConnection,
  verifyWhatsAppOtpForUser,
} from "./server/kapsoWhatsApp";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./server/spendwiseSupabase";

const supabaseAuthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface AuthenticatedRequest extends express.Request {
  rawBody?: Buffer;
  userEmail?: string;
  userToken?: string;
}

async function requireAuthenticatedUser(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Authentication required. Missing Bearer session token.",
    });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Authentication required. Empty Bearer token.",
    });
  }

  try {
    const { data, error } = await supabaseAuthClient.auth.getUser(token);
    if (error || !data?.user?.email) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired user session.",
      });
    }
    req.userEmail = data.user.email.toLowerCase();
    req.userToken = token;
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      error: "Unable to verify user session.",
    });
  }
}

function parseAllowedOrigin(rawOrigin: string): string | null {
  try {
    const parsed = new URL(rawOrigin.trim());
    const isLocalHttp =
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
    if (parsed.protocol !== "https:" && !isLocalHttp) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

const STATIC_ALLOWED_CORS_ORIGINS = new Set<string>([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

if (typeof process.env.ALLOWED_CORS_ORIGINS === "string") {
  for (const entry of process.env.ALLOWED_CORS_ORIGINS.split(",")) {
    const normalized = parseAllowedOrigin(entry);
    if (normalized) {
      STATIC_ALLOWED_CORS_ORIGINS.add(normalized);
    }
  }
}

const ARPITACHARYA_DOMAIN_ORIGIN_REGEX =
  /^https:\/\/(?:[a-z0-9-]+\.)*arpitacharya\.com$/i;

const AI_STUDIO_PREVIEW_ORIGIN_REGEX =
  /^https:\/\/ais-(?:dev|pre)-[a-z0-9-]+-\d+\.[a-z0-9-]+\.run\.app$/i;

function isTrustedCorsOrigin(originHeader: string, req: express.Request): string | null {
  const normalized = parseAllowedOrigin(originHeader);
  if (!normalized) return null;
  if (STATIC_ALLOWED_CORS_ORIGINS.has(normalized)) return normalized;
  if (ARPITACHARYA_DOMAIN_ORIGIN_REGEX.test(normalized)) return normalized;
  if (AI_STUDIO_PREVIEW_ORIGIN_REGEX.test(normalized)) return normalized;

  const forwardedHost = req.headers["x-forwarded-host"];
  const hostHeader =
    (typeof forwardedHost === "string" ? forwardedHost.split(",")[0].trim() : "") ||
    (typeof req.headers.host === "string" ? req.headers.host.trim() : "");
  if (hostHeader) {
    const parsedOrigin = new URL(normalized);
    if (parsedOrigin.host.toLowerCase() === hostHeader.toLowerCase()) {
      return normalized;
    }
  }

  return null;
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const PORT = Number(process.env.PORT) || 3000;

  app.use("/api", (req, res, next) => {
    const originHeader = req.headers.origin;
    if (typeof originHeader === "string" && originHeader.trim()) {
      const trustedOrigin = isTrustedCorsOrigin(originHeader, req);
      if (trustedOrigin) {
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Origin", trustedOrigin);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key");
        res.setHeader("Access-Control-Max-Age", "86400");
        if (req.method === "OPTIONS") {
          return res.status(204).end();
        }
      } else if (req.method === "OPTIONS") {
        return res.status(403).json({
          success: false,
          error: "Origin not allowed by CORS policy.",
        });
      }
    } else if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    return next();
  });

  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        (req as AuthenticatedRequest).rawBody = buf;
      },
    })
  );

  // Health and API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "SpendWise - Expense Tracker & Splitwise" });
  });

  app.get("/api/v1/health", (req, res) => {
    res.json({ status: "ok", version: "2.0.0", timestamp: new Date().toISOString() });
  });

  // ---------------------------------------------------------------------------
  // Kapso WhatsApp AI Financial Assistant Routes
  // ---------------------------------------------------------------------------

  // Publicly exposed webhook receiver for Kapso WhatsApp events (signature-verified)
  app.post("/api/webhooks/kapso", async (req: AuthenticatedRequest, res) => {
    const verification = verifyIncomingWebhookSignature(req.rawBody, req.headers);
    if (!verification.valid) {
      const status = verification.reason?.includes("not configured") ? 503 : 401;
      return res.status(status).json({
        success: false,
        error: verification.reason || "Webhook signature verification failed.",
      });
    }

    const eventHeader =
      typeof req.headers["x-webhook-event"] === "string"
        ? req.headers["x-webhook-event"]
        : "whatsapp.message.received";

    try {
      const processed = await processInboundWhatsAppMessages({
        payload: req.body,
        eventName: eventHeader,
        sendAutoReply: true,
      });

      return res.status(200).json({
        success: true,
        received: true,
        event: eventHeader,
        processedCount: processed.length,
        matchedProfiles: processed.filter((p) => Boolean(p.ownerEmail)).length,
        dataMutations: processed.filter((p) => Boolean(p.dataMutated && p.ownerEmail)).length,
      });
    } catch (err) {
      console.error("Kapso webhook processing error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to process WhatsApp webhook payload.",
      });
    }
  });

  // Sync profile phone metadata on login/profile save (preserves OTP verification for unchanged phone)
  app.post(
    "/api/v1/whatsapp/register-profile",
    requireAuthenticatedUser,
    async (req: AuthenticatedRequest, res) => {
      const userEmail = req.userEmail!;
      const bodyPhone = typeof req.body?.phone === "string" ? req.body.phone : undefined;
      const bodyCountryCode =
        typeof req.body?.countryCode === "string" ? req.body.countryCode : undefined;

      let dbPhone: string | null = null;
      let dbCountryCode: string | null = null;

      if (req.userToken) {
        try {
          const userScopedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${req.userToken}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: profileRow } = await userScopedSupabase
            .from("profiles")
            .select("phone, country_code")
            .eq("email", userEmail)
            .maybeSingle();

          if (profileRow) {
            dbPhone = profileRow.phone || null;
            dbCountryCode = profileRow.country_code || null;
          }
        } catch {
          // Fallback to caller-provided profile fields from verified session
        }
      }

      const effectivePhone = bodyPhone !== undefined ? bodyPhone : dbPhone;
      const effectiveCountryCode = bodyCountryCode !== undefined ? bodyCountryCode : dbCountryCode;

      const { binding, reconciledCount } = registerProfilePhoneBinding({
        email: userEmail,
        phone: effectivePhone,
        countryCode: effectiveCountryCode,
      });

      return res.json({
        success: true,
        registered: Boolean(binding),
        verified: Boolean(binding?.verified),
        binding,
        linkStatus: getWhatsAppLinkStatusForUser(userEmail),
        reconciledCount,
      });
    }
  );

  // Request 6-digit OTP to link and verify a WhatsApp number with the signed-in account
  app.post(
    "/api/v1/whatsapp/link/request-otp",
    requireAuthenticatedUser,
    async (req: AuthenticatedRequest, res) => {
      const phone = typeof req.body?.phone === "string" ? req.body.phone : "";
      const countryCode =
        typeof req.body?.countryCode === "string" ? req.body.countryCode : "+91";

      const result = await requestWhatsAppOtp(
        { userEmail: req.userEmail!, userToken: req.userToken },
        { phone, countryCode }
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error || "Unable to initiate WhatsApp verification.",
        });
      }

      return res.json({
        success: true,
        ...result,
        linkStatus: getWhatsAppLinkStatusForUser(req.userEmail!),
      });
    }
  );

  // Verify 6-digit OTP code from SpendWise Settings UI
  app.post(
    "/api/v1/whatsapp/link/verify-otp",
    requireAuthenticatedUser,
    async (req: AuthenticatedRequest, res) => {
      const code = typeof req.body?.code === "string" ? req.body.code : "";
      const result = await verifyWhatsAppOtpForUser(
        { userEmail: req.userEmail!, userToken: req.userToken },
        code
      );

      if (!result.verified) {
        return res.status(400).json({
          success: false,
          error: result.error || "Verification failed.",
        });
      }

      return res.json({
        success: true,
        verified: true,
        binding: result.binding,
        linkStatus: getWhatsAppLinkStatusForUser(req.userEmail!),
      });
    }
  );

  // Unlink & revoke WhatsApp access for the signed-in user
  app.post(
    "/api/v1/whatsapp/unlink",
    requireAuthenticatedUser,
    async (req: AuthenticatedRequest, res) => {
      const result = await unlinkWhatsAppForUser({
        userEmail: req.userEmail!,
        userToken: req.userToken,
      });
      clearUserWhatsAppRuntime(req.userEmail!);

      return res.json({
        success: true,
        ...result,
        linkStatus: getWhatsAppLinkStatusForUser(req.userEmail!),
      });
    }
  );

  // Authenticated status & config metadata for the SpendWise Settings UI
  app.get("/api/v1/whatsapp/status", requireAuthenticatedUser, (req: AuthenticatedRequest, res) => {
    const config = getKapsoPublicConfig();
    const userItems = listInboxItemsForUser(req.userEmail!);
    const pendingSyncCount = userItems.filter((i) => i.dataMutated && !i.syncedToClient).length;
    const linkStatus = getWhatsAppLinkStatusForUser(req.userEmail!);

    return res.json({
      success: true,
      config,
      profileBinding: linkStatus.binding,
      linkStatus,
      pendingSyncCount,
      totalMessages: userItems.length,
    });
  });

  // Live check against Kapso WhatsApp API
  app.post("/api/v1/whatsapp/verify", requireAuthenticatedUser, async (_req, res) => {
    const result = await verifyKapsoConnection();
    const statusCode = result.connected ? 200 : result.error?.includes("KAPSO_API_KEY") ? 503 : 502;
    return res.status(statusCode).json({
      success: result.connected,
      ...result,
    });
  });

  // Send a WhatsApp text message via Kapso
  app.post("/api/v1/whatsapp/send", requireAuthenticatedUser, async (req, res) => {
    const { to, message } = req.body || {};

    if (!sanitizePhoneNumber(to)) {
      return res.status(400).json({
        success: false,
        error: "Valid recipient phone number (with country code, 7-15 digits) is required.",
      });
    }
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Non-empty 'message' string is required.",
      });
    }

    try {
      const result = await sendWhatsAppTextMessage({ to, message });
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      const error = err as Error & { statusCode?: number };
      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Failed to send WhatsApp message.",
      });
    }
  });

  // Fetch recent WhatsApp inbox items & optionally pull latest inbound messages from Kapso
  app.get("/api/v1/whatsapp/messages", requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    const shouldPull = req.query.pull === "true";
    let pulledCount = 0;
    const currentBinding = getProfileBindingForUser(req.userEmail!);
    let profilePhoneRequired = !currentBinding;
    let verificationRequired = !currentBinding?.verified;

    if (shouldPull) {
      const pullRes = await pullRecentInboundFromKapso(req.userEmail!);
      pulledCount = pullRes.addedCount;
      profilePhoneRequired = pullRes.profilePhoneRequired;
      verificationRequired = pullRes.verificationRequired;
    }

    const items = listInboxItemsForUser(req.userEmail!);
    return res.json({
      success: true,
      pulledCount,
      profilePhoneRequired,
      verificationRequired,
      profileBinding: getProfileBindingForUser(req.userEmail!),
      linkStatus: getWhatsAppLinkStatusForUser(req.userEmail!),
      items,
      pendingSyncCount: items.filter((i) => i.dataMutated && !i.syncedToClient).length,
    });
  });

  // Acknowledge WhatsApp mutations once SpendWise client refreshes Supabase data
  app.post("/api/v1/whatsapp/messages/ack", requireAuthenticatedUser, (req: AuthenticatedRequest, res) => {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.filter((id: unknown): id is string => typeof id === "string")
      : [];

    const acknowledged = acknowledgeInboxItems(ids, req.userEmail!);
    return res.json({
      success: true,
      acknowledged,
    });
  });

  // Authenticated conversational AI assistant endpoint (enforces Supabase RLS via userToken)
  app.post("/api/v1/whatsapp/chat", requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const contactName = typeof req.body?.contactName === "string" ? req.body.contactName : undefined;
    if (!text || text.length > 1500) {
      return res.status(400).json({
        success: false,
        error: "Valid 'text' message (1-1500 chars) is required.",
      });
    }

    try {
      const result = await runAuthenticatedWhatsAppChat({
        userEmail: req.userEmail!,
        userToken: req.userToken!,
        text,
        contactName,
      });

      const status = result.errorCode === "GEMINI_API_KEY_MISSING" ? 503 : 200;
      return res.status(status).json({
        success: status === 200,
        ...result,
      });
    } catch (err) {
      const error = err as Error & { statusCode?: number };
      return res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || "Failed to process WhatsApp AI assistant message.",
      });
    }
  });

  // Reset conversational context for the signed-in user
  app.post("/api/v1/whatsapp/context/clear", requireAuthenticatedUser, (req: AuthenticatedRequest, res) => {
    clearUserWhatsAppRuntime(req.userEmail!);
    return res.json({ success: true });
  });

  // Authenticated inbound simulator for testing WhatsApp messages & OTP linking
  app.post("/api/v1/whatsapp/simulate-inbound", requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    const { from, text, contactName } = req.body || {};
    if (typeof text !== "string" || !text.trim() || text.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        error: "Valid 'text' message (1-1000 chars) is required.",
      });
    }

    const linkStatus = getWhatsAppLinkStatusForUser(req.userEmail!);
    const binding = linkStatus.binding;
    if (!binding) {
      return res.status(400).json({
        success: false,
        error: "Attach and verify a mobile number with your SpendWise account first.",
      });
    }

    const isOtpCommand = /^(?:link|verify)\s+\d{6}$/i.test(text.trim());
    if (!binding.verified && !isOtpCommand) {
      return res.status(403).json({
        success: false,
        error: "Your WhatsApp number is not verified yet. Complete OTP verification first.",
      });
    }

    const sanitizedFrom = sanitizePhoneNumber(from);
    if (sanitizedFrom && !arePhonesMatched(sanitizedFrom, binding.phoneDigits)) {
      return res.status(400).json({
        success: false,
        error: `Sender number must match your linked number (${binding.displayPhone}).`,
      });
    }

    const processed = await processInboundWhatsAppMessages({
      simulated: {
        from: binding.displayPhone,
        contactName: typeof contactName === "string" ? contactName.slice(0, 60) : "SpendWise Profile",
        text: text.trim(),
        ownerEmail: req.userEmail!,
        userToken: req.userToken!,
        matchedProfilePhone: binding.displayPhone,
      },
      sendAutoReply: false,
    });

    return res.status(201).json({
      success: true,
      item: processed[0] || null,
      linkStatus: getWhatsAppLinkStatusForUser(req.userEmail!),
    });
  });

  // iOS Shortcuts quick log endpoint
  app.post("/api/v1/shortcuts/log", (req, res) => {
    const apiKey = req.headers["x-api-key"] || req.headers.authorization;
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: "Missing API Key. Include 'x-api-key' or 'Authorization: Bearer <key>' header.",
      });
    }

    const { amount, title, note, account, category, type = "expense", date } = req.body || {};

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({
        success: false,
        error: "Valid numeric 'amount' is required.",
      });
    }

    const transactionTitle = title || note || "Quick Expense";
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const txDate = date || new Date().toISOString().split("T")[0];

    const transaction = {
      id: transactionId,
      title: transactionTitle,
      amount: Math.abs(Number(amount)),
      type: type === "income" ? "income" : "expense",
      account: account || "Default Account",
      category: category || "General",
      date: txDate,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      notes: note || "Logged via SpendWise API / iOS Shortcut",
      source: "api_shortcut",
      createdAt: new Date().toISOString(),
    };

    return res.status(201).json({
      success: true,
      message: `Successfully logged ${transaction.type} of ${transaction.amount} for "${transaction.title}"`,
      transaction,
    });
  });

  // REST API v1 transactions endpoint
  app.post("/api/v1/transactions", (req, res) => {
    const apiKey = req.headers["x-api-key"] || req.headers.authorization;
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: "Missing API Key. Include 'x-api-key' or 'Authorization: Bearer <key>' header.",
      });
    }

    const { amount, title, type = "expense", accountId, categoryId, notes, date, time } = req.body || {};

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({
        success: false,
        error: "Valid numeric 'amount' is required.",
      });
    }

    if (!title || typeof title !== "string") {
      return res.status(400).json({
        success: false,
        error: "String 'title' is required.",
      });
    }

    const transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      title,
      amount: Math.abs(Number(amount)),
      type,
      accountId: accountId || "default",
      categoryId: categoryId || "general",
      date: date || new Date().toISOString().split("T")[0],
      time: time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      notes: notes || "",
      createdAt: new Date().toISOString(),
    };

    return res.status(201).json({
      success: true,
      message: "Transaction created successfully",
      transaction,
    });
  });

  // REST API v1 specs endpoint
  app.get("/api/v1/specs", (req, res) => {
    res.json({
      openapi: "3.0.0",
      info: {
        title: "SpendWise REST API",
        version: "1.2.0",
        description: "Official REST API for SpendWise expense tracking, Kapso WhatsApp integration & iOS Shortcuts automation",
      },
      paths: {
        "/api/webhooks/kapso": {
          post: {
            summary: "Receive and verify Kapso WhatsApp webhook events (HMAC-SHA256)",
            responses: {
              200: { description: "Webhook processed" },
              401: { description: "Invalid webhook signature" },
            },
          },
        },
        "/api/v1/whatsapp/send": {
          post: {
            summary: "Send WhatsApp message via Kapso Cloud API (Bearer session required)",
            responses: {
              200: { description: "Message accepted by WhatsApp" },
              401: { description: "Unauthorized" },
              503: { description: "Kapso API key not configured" },
            },
          },
        },
        "/api/v1/shortcuts/log": {
          post: {
            summary: "Quick log transaction via iOS Shortcuts / Siri",
            parameters: [],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["amount", "title"],
                    properties: {
                      amount: { type: "number", example: 450 },
                      title: { type: "string", example: "Starbucks Coffee" },
                      account: { type: "string", example: "HDFC Bank" },
                      category: { type: "string", example: "Food & Dining" },
                      type: { type: "string", enum: ["expense", "income"], default: "expense" },
                      note: { type: "string", example: "Quick log" },
                      date: { type: "string", example: "2026-09-01" },
                    },
                  },
                },
              },
            },
            responses: {
              201: { description: "Transaction created successfully" },
              400: { description: "Invalid input parameters" },
              401: { description: "Unauthorized or missing API Key" },
            },
          },
        },
        "/api/v1/transactions": {
          post: {
            summary: "Create full transaction with account and category IDs",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["amount", "title"],
                    properties: {
                      amount: { type: "number" },
                      title: { type: "string" },
                      type: { type: "string", enum: ["expense", "income", "transfer", "settlement", "emi_payment"] },
                      accountId: { type: "string" },
                      categoryId: { type: "string" },
                      notes: { type: "string" },
                      date: { type: "string" },
                      time: { type: "string" },
                    },
                  },
                },
              },
            },
            responses: {
              201: { description: "Transaction created" },
            },
          },
        },
      },
    });
  });

  // JSON 404 fallback for unmatched API routes (never fall through to SPA HTML)
  app.use("/api", (_req, res) => {
    return res.status(404).json({
      success: false,
      error: "API endpoint not found.",
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
