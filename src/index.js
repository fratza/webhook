const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const admin = require("firebase-admin");
require("dotenv").config();

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
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
app.post("/api/webhook", async (req, res) => {
  try {
    const incomingData = req.body;
    const timestamp = admin.firestore.Timestamp.fromDate(new Date());

    console.log("Received webhook data:", incomingData);

    // Safely access and log the capturedLists
    const capturedLists = incomingData?.task?.capturedLists;

    if (capturedLists) {
      console.log("Captured Lists:", JSON.stringify(capturedLists, null, 2));
    } else {
      console.log("No capturedLists found in the webhook data.");
    }

    // Extract task data
    const { task } = incomingData;
    const taskId = task?.id;

    if (!taskId) {
      throw new Error("Task ID is required");
    }

    const batch = db.batch();

    // Store capturedTexts
    if (task.capturedTexts) {
      const textsRef = db.collection("captured_texts").doc(taskId);
      batch.set(textsRef, {
        taskId,
        createdAt: timestamp,
        data: convertToFirestoreFormat(task.capturedTexts),
      });
    }

    // Store capturedScreenshots
    if (task.capturedScreenshots) {
      const screenshotsRef = db.collection("captured_screenshots").doc(taskId);
      batch.set(screenshotsRef, {
        taskId,
        createdAt: timestamp,
        data: convertToFirestoreFormat(task.capturedScreenshots),
      });
    }

    // Store capturedLists
    if (task.capturedLists) {
      const listsRef = db.collection("captured_lists").doc(taskId);
      batch.set(listsRef, {
        taskId,
        createdAt: timestamp,
        data: convertToFirestoreFormat(task.capturedLists),
      });
    }

    // Commit all writes
    await batch.commit();

    // Return response
    res.json({
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
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({
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
  if (data === null || data === undefined) return null;

  if (data instanceof Date) {
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
