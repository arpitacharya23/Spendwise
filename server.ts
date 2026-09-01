import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health and API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "SpendWise - Expense Tracker & Splitwise" });
  });

  app.get("/api/v1/health", (req, res) => {
    res.json({ status: "ok", version: "1.2.0", timestamp: new Date().toISOString() });
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
        description: "Official REST API for SpendWise expense tracking & iOS Shortcuts automation",
      },
      paths: {
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
