const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const admin = require("firebase-admin");
const WebhookService = require("./services/webhook.service");
const FirestoreService = require("./services/firestore.service");
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

// Initialize Firestore and services
const db = admin.firestore();
const webhookService = new WebhookService(admin, db);
const firestoreService = new FirestoreService(db);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Store registered webhooks
const webhooks = new Map();

// Endpoint to delete a document by ID
app.delete(
  "/api/delete/firestore/:collection/:documentId",
  async (req, res) => {
    try {
      const { collection, documentId } = req.params;

      const result = await firestoreService.deleteDocumentById(
        collection,
        documentId
      );

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      res.json(result);
    } catch (error) {
      console.error("Error deleting document from Firestore:", error);
      res
        .status(500)
        .json({ error: "Failed to delete document from Firestore" });
    }
  }
);

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

  const originalJson = res.json;

  res.json = function (body) {
    // Log response
    console.log("[Webhook] Response status:", res.statusCode);
    console.log("[Webhook] Response body:", JSON.stringify(body, null, 2));

    // Call the original res.json
    return originalJson.call(this, body);
  };

  try {
    if (webhookId === "browseAI") {
      console.log(`Initiating ${webhookId} process...`);
      console.log("Request body:", req.body);
      const result = await webhookService.processBrowseAIWebhook(req.body);
      res.status(200).json(result);
    } else {
      throw new Error(`Unsupported webhook type: ${webhookId}`);
    }
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process webhook",
      details: error.stack,
    });
  }
});

// GET

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

// Endpoint to fetch data from Firestore
app.get("/api/firestore/:collection", async (req, res) => {
  try {
    const { collection } = req.params;
    const documentIds = await firestoreService.fetchFromCollection(collection);
    res.json(documentIds);
  } catch (error) {
    console.error("Error fetching from Firestore:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch document IDs from Firestore" });
  }
});

// Endpoint to fetch a single document by ID
app.get("/api/firestore/:collection/:documentId", async (req, res) => {
  try {
    const { collection, documentId } = req.params;

    const document = await firestoreService.fetchDocumentById(
      collection,
      documentId
    );

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json(document);
  } catch (error) {
    console.error("Error fetching document from Firestore:", error);
    res.status(500).json({ error: "Failed to fetch document from Firestore" });
  }
});

// Endpoint to fetch categories (array names) from a document
app.get("/api/firestore/:collection/:documentId/category", async (req, res) => {
  try {
    const { collection, documentId } = req.params;

    const result = await firestoreService.fetchCategoriesFromDocument(
      collection,
      documentId
    );

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error("Error fetching categories from Firestore:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch categories from Firestore" });
  }
});

// Endpoint to handle category/subcategory pattern
app.get(
  "/api/firestore/:collection/:documentId/category=:subcategory",
  async (req, res) => {
    try {
      const { collection, documentId, subcategory } = req.params;

      // Make subcategory case-insensitive by converting to lowercase
      // We'll search through all categories to find a case-insensitive match
      const result = await firestoreService.fetchCategoriesFromDocument(
        collection,
        documentId
      );

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      // Find the actual category name with correct case
      const subcategoryLower = subcategory.toLowerCase();
      const matchedCategory = result.categories.find(
        (category) => category.toLowerCase() === subcategoryLower
      );

      if (!matchedCategory) {
        return res.status(404).json({
          error: `Category '${subcategory}' not found`,
          availableCategories: result.categories,
        });
      }

      // Use the correctly cased category name for the data fetch
      const categoryResult = await firestoreService.fetchCategoryData(
        collection,
        documentId,
        matchedCategory
      );

      if (!categoryResult.success) {
        return res.status(404).json({ error: categoryResult.error });
      }

      res.json(categoryResult);
    } catch (error) {
      console.error("Error fetching subcategory data from Firestore:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch subcategory data from Firestore" });
    }
  }
);

// Endpoint to fetch only array names from a document
app.get("/api/firestore/:collection/:documentId/", async (req, res) => {
  try {
    const { collection, documentId } = req.params;

    const result = await firestoreService.fetchCategoriesFromDocument(
      collection,
      documentId
    );

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    // Format the categories as requested
    const formattedResponse = {
      Categories: result.categories,
    };

    // Return the formatted array names
    res.json(formattedResponse);
  } catch (error) {
    console.error("Error fetching array names from Firestore:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch array names from Firestore" });
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
