const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const admin = require("firebase-admin");
require("dotenv").config();

// Initialize Firebase Admin
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : undefined;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  }),
});

const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Store registered webhooks
const webhooks = new Map();

// Generate a secret for webhook
function generateWebhookSecret() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Registers a new webhook by storing its URL, subscribed events, and a secret.
 *
 * @route POST /api/webhooks/register
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing webhook details
 * @param {string} req.body.url - The destination URL to send webhook events to
 * @param {string[]} req.body.events - An array of event names the webhook subscribes to
 * @param {Object} res - Express response object
 *
 * @returns {201|400} Returns 201 with webhook ID and secret on success,
 * or 400 with error message on invalid input
 */
app.post("/api/webhooks/register", (req, res) => {
  const { url, events } = req.body;

  if (!url || !events || !Array.isArray(events)) {
    return res.status(400).json({ error: "Invalid webhook configuration" });
  }

  const webhookId = crypto.randomUUID();
  const secret = generateWebhookSecret();

  webhooks.set(webhookId, {
    url,
    events,
    secret,
  });

  res.status(201).json({
    webhookId,
    secret,
    message: "Webhook registered successfully",
  });
});

/**
 * Lists all registered webhooks.
 *
 * @route GET /api/webhooks
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 *
 * @returns {200} Returns 200 with an array of registered webhooks
 */
app.get("/api/webhooks", (req, res) => {
  const webhookList = Array.from(webhooks.entries()).map(([id, data]) => ({
    id,
    url: data.url,
    events: data.events,
  }));

  res.json(webhookList);
});

// Delete a webhook
app.delete("/api/webhooks/:webhookId", (req, res) => {
  const { webhookId } = req.params;

  if (webhooks.has(webhookId)) {
    webhooks.delete(webhookId);
    res.json({ message: "Webhook deleted successfully" });
  } else {
    res.status(404).json({ error: "Webhook not found" });
  }
});

// Trigger webhook event
app.post("/api/trigger", async (req, res) => {
  const { event, data } = req.body;

  if (!event || !data) {
    return res.status(400).json({ error: "Event and data are required" });
  }

  const triggeredWebhooks = Array.from(webhooks.entries()).filter(
    ([_, webhook]) => webhook.events.includes(event)
  );

  const results = await Promise.all(
    triggeredWebhooks.map(async ([id, webhook]) => {
      try {
        const payload = {
          event,
          data,
          timestamp: new Date().toISOString(),
          webhookId: id,
        };

        const signature = crypto
          .createHmac("sha256", webhook.secret)
          .update(JSON.stringify(payload))
          .digest("hex");

        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature,
          },
          body: JSON.stringify(payload),
        });

        return {
          webhookId: id,
          status: response.status,
          success: response.ok,
        };
      } catch (error) {
        return {
          webhookId: id,
          status: 500,
          success: false,
          error: error.message,
        };
      }
    })
  );

  res.json({
    triggered: results.length,
    results,
  });
});

/**
 * Webhook endpoint that handles any data structure
 *
 * @route POST /api/webhook
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 *
 * @returns {200} Returns 200 with processed webhook data
 */
app.post("/api/webhook/:webhookId", async (req, res) => {
  const webhookId = req.params.webhookId;
  console.log("[Webhook] Incoming request at URL:", webhookId);

  try {
    if (webhookId === "browseAI") {
      // === Your BrowseAI-specific webhook logic ===
      console.log("[BrowseAI Webhook] Starting to process incoming request...");
      const incomingData = req.body;
      const timestamp = admin.firestore.Timestamp.fromDate(new Date());

      console.log(
        "[BrowseAI Webhook] Received data:",
        JSON.stringify(incomingData, null, 2)
      );

      // Example BrowseAI processing:
      const task = incomingData?.task;
      if (!task?.id) {
        throw new Error("Task ID is required");
      }
      const taskId = task.id;

      const batch = db.batch();

      if (task.capturedTexts) {
        const textsRef = db.collection("captured_texts").doc(taskId);
        const textsData = convertToFirestoreFormat(task.capturedTexts);
        batch.set(textsRef, {
          taskId,
          originUrl: task.originUrl,
          createdAt: timestamp,
          data: textsData,
        });
      }

      if (task.capturedScreenshots) {
        const screenshotsRef = db
          .collection("captured_screenshots")
          .doc(taskId);
        const screenshotsData = convertToFirestoreFormat(
          task.capturedScreenshots
        );
        batch.set(screenshotsRef, {
          taskId,
          originUrl: task.originUrl,
          createdAt: timestamp,
          data: screenshotsData,
        });
      }

      if (task.capturedLists) {
        const listsRef = db.collection("captured_lists").doc(taskId);
        const listsData = convertToFirestoreFormat(task.capturedLists);
        batch.set(listsRef, {
          taskId,
          originUrl: task.originUrl,
          createdAt: timestamp,
          data: listsData,
        });
      }

      await batch.commit();
      console.log("[BrowseAI Webhook] Batch write successful!");

      return res.json({
        success: true,
        taskId,
        meta: {
          processedAt: timestamp.toDate().toISOString(),
          collections: [
            "captured_texts",
            "captured_screenshots",
            "captured_lists",
          ],
        },
      });
    }

    // === Default webhook handler for other paths (or fallback) ===
    if (webhookId === "default") {
      console.log("DEFAULT");
      return res.json({
        success: true,
        message: "Default webhook endpoint hit",
      });
    }

    // If no matching route found, send 404
    return res.status(404).json({
      success: false,
      error: "Invalid webhook endpoint",
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Error processing webhook data",
    });
  }
});

/**
 * Starts the webhook middleware server.
 *
 * @route GET /api/webhook
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 *
 * @returns {200} Returns 200 with processed webhook data
 */
app.listen(PORT, () => {
  console.log(`Webhook middleware running on port ${PORT}`);
});

/**
 * Helper function to convert data to Firestore format
 *
 * @param {Object} data - Data to convert
 *
 * @returns {Object} Returns converted data
 */
function convertToFirestoreFormat(data) {
  console.log("[Convert] Starting data conversion...");

  if (data === null || data === undefined) {
    console.log("[Convert] Null or undefined data detected");
    return null;
  }

  if (data instanceof Date) {
    console.log("[Convert] Converting Date to Timestamp");
    return admin.firestore.Timestamp.fromDate(data);
  }

  if (Array.isArray(data)) {
    return data.map((item) => convertToFirestoreFormat(item));
  }

  if (typeof data === "object") {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      // Convert dates in ISO format to Firestore Timestamp
      if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
      ) {
        const date = new Date(value);
        if (!isNaN(date)) {
          result[key] = admin.firestore.Timestamp.fromDate(date);
          continue;
        }
      }
      result[key] = convertToFirestoreFormat(value);
    }
    return result;
  }

  return data;
}
