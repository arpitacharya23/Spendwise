import "dotenv/config";
import express from "express";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { createServer as createViteServer } from "vite";
import {
  acknowledgeInboxItems,
  arePhonesMatched,
  getKapsoPublicConfig,
  getProfileBindingForUser,
  listInboxItemsForUser,
  processInboundWhatsAppMessages,
  pullRecentInboundFromKapso,
  registerProfilePhoneBinding,
  sanitizePhoneNumber,
  sendWhatsAppTextMessage,
  verifyIncomingWebhookSignature,
  verifyKapsoConnection,
} from "./server/kapsoWhatsApp";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://kdjptkhfvzvsevzbcmik.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_U073qwpspSpADzBXfs55dA_h842lmUO";

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

async function startServer() {
  const app = express();
  const PORT = 3000;

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
    res.json({ status: "ok", version: "1.2.0", timestamp: new Date().toISOString() });
  });

  // ---------------------------------------------------------------------------
  // Kapso WhatsApp Integration Routes
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
        transactionsParsed: processed.filter((p) => Boolean(p.parsedTx && p.ownerEmail)).length,
      });
    } catch (err) {
      console.error("Kapso webhook processing error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to process WhatsApp webhook payload.",
      });
    }
  });

  // Attach/sync the signed-in user's Profile phone number & default account for WhatsApp routing
  app.post(
    "/api/v1/whatsapp/register-profile",
    requireAuthenticatedUser,
    async (req: AuthenticatedRequest, res) => {
      const userEmail = req.userEmail!;
      const bodyPhone = typeof req.body?.phone === "string" ? req.body.phone : undefined;
      const bodyCountryCode =
        typeof req.body?.countryCode === "string" ? req.body.countryCode : undefined;
      const defaultAccountId =
        typeof req.body?.defaultAccountId === "string" ? req.body.defaultAccountId : undefined;

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
        defaultAccountId,
      });

      return res.json({
        success: true,
        registered: Boolean(binding),
        binding,
        reconciledCount,
      });
    }
  );

  // Authenticated status & config metadata for the SpendWise Settings UI
  app.get("/api/v1/whatsapp/status", requireAuthenticatedUser, (req: AuthenticatedRequest, res) => {
    const config = getKapsoPublicConfig();
    const userItems = listInboxItemsForUser(req.userEmail!);
    const pendingSyncCount = userItems.filter((i) => i.parsedTx && !i.syncedToClient).length;
    const profileBinding = getProfileBindingForUser(req.userEmail!);

    return res.json({
      success: true,
      config,
      profileBinding,
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
    let profilePhoneRequired = !getProfileBindingForUser(req.userEmail!);

    if (shouldPull) {
      const pullRes = await pullRecentInboundFromKapso(req.userEmail!);
      pulledCount = pullRes.addedCount;
      profilePhoneRequired = pullRes.profilePhoneRequired;
    }

    const items = listInboxItemsForUser(req.userEmail!);
    return res.json({
      success: true,
      pulledCount,
      profilePhoneRequired,
      profileBinding: getProfileBindingForUser(req.userEmail!),
      items,
      pendingSyncCount: items.filter((i) => i.parsedTx && !i.syncedToClient).length,
    });
  });

  // Acknowledge WhatsApp transactions once imported into SpendWise ledger
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

  // Authenticated inbound simulator for testing natural-language WhatsApp expense parsing
  app.post("/api/v1/whatsapp/simulate-inbound", requireAuthenticatedUser, async (req: AuthenticatedRequest, res) => {
    const { from, text, contactName } = req.body || {};
    if (typeof text !== "string" || !text.trim() || text.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        error: "Valid 'text' message (1-1000 chars) is required.",
      });
    }

    const binding = getProfileBindingForUser(req.userEmail!);
    if (!binding) {
      return res.status(400).json({
        success: false,
        error: "Attach a mobile number to your SpendWise profile before logging WhatsApp transactions.",
      });
    }

    const sanitizedFrom = sanitizePhoneNumber(from);
    if (sanitizedFrom && !arePhonesMatched(sanitizedFrom, binding.phoneDigits)) {
      return res.status(400).json({
        success: false,
        error: `Sender number must match your attached profile number (${binding.displayPhone}).`,
      });
    }

    const processed = await processInboundWhatsAppMessages({
      simulated: {
        from: binding.displayPhone,
        contactName: typeof contactName === "string" ? contactName.slice(0, 60) : "SpendWise Profile",
        text: text.trim(),
        ownerEmail: req.userEmail!,
        matchedProfilePhone: binding.displayPhone,
        defaultAccountId: binding.defaultAccountId,
      },
      sendAutoReply: false,
    });

    return res.status(201).json({
      success: true,
      item: processed[0] || null,
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
