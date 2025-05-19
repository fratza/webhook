const admin = require('firebase-admin');

class WebhookService {
  constructor() {
    this.db = admin.firestore();
  }

  /**
   * Convert data to Firestore-compatible format
   * @param {any} data - Data to convert
   * @returns {any} Firestore-compatible data
   */
  convertToFirestoreFormat(data) {
    if (data === null || data === undefined) {
      return null;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.convertToFirestoreFormat(item));
    }

    if (data instanceof Date) {
      return admin.firestore.Timestamp.fromDate(data);
    }

    if (typeof data === "object") {
      const result = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.convertToFirestoreFormat(value);
      }
      return result;
    }

    return data;
  }

  /**
   * Process BrowseAI webhook data
   * @param {Object} data - Webhook payload
   * @returns {Promise<Object>} Processing result
   */
  async processBrowseAIWebhook(data) {
    console.log("[BrowseAI Webhook] Starting to process incoming request...");
    console.log("[BrowseAI Webhook] Received data:", JSON.stringify(data, null, 2));

    const task = data?.task;
    if (!task?.id) {
      throw new Error("Task ID is required");
    }

    const taskId = task.id;
    const originUrl = task.originUrl || "unknown";
    const timestamp = admin.firestore.Timestamp.fromDate(new Date());
    const batch = this.db.batch();

    // Process captured texts
    if (task.capturedTexts) {
      const textsRef = this.db.collection("captured_texts").doc(taskId);
      const textsData = this.convertToFirestoreFormat(task.capturedTexts);
      batch.set(textsRef, {
        taskId,
        originUrl,
        createdAt: timestamp,
        data: textsData,
      });
    }

    // Process captured screenshots
    if (task.capturedScreenshots) {
      const screenshotsRef = this.db.collection("captured_screenshots").doc(taskId);
      const screenshotsData = this.convertToFirestoreFormat(task.capturedScreenshots);
      batch.set(screenshotsRef, {
        taskId,
        originUrl,
        createdAt: timestamp,
        data: screenshotsData,
      });
    }

    // Process captured lists
    if (task.capturedLists) {
      const listsRef = this.db.collection("captured_lists").doc(taskId);
      const listsData = this.convertToFirestoreFormat(task.capturedLists);
      batch.set(listsRef, {
        taskId,
        originUrl,
        createdAt: timestamp,
        data: listsData,
      });
    }

    await batch.commit();
    console.log("[BrowseAI Webhook] Successfully processed task:", taskId);

    return {
      success: true,
      message: "Webhook processed successfully",
      taskId
    };
  }
}

module.exports = new WebhookService();
