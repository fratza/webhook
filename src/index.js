const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
require("dotenv").config();

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

// Register a new webhook
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

// List registered webhooks
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

// Simple webhook endpoint that returns the received body
app.post("/api/webhook", (req, res) => {
  const { task } = req.body;
  if (task && task.capturedLists && task.capturedLists.Reviews) {
    console.log(
      "Reviews:",
      JSON.stringify(task.capturedLists.Reviews, null, 2)
    );
  }
  res.json(req.body);
});

app.listen(PORT, () => {
  console.log(`Webhook middleware running on port ${PORT}`);
});
