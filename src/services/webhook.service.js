class WebhookService {
  constructor(admin, db) {
    this.admin = admin;
    this.db = db;
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
      return this.admin.firestore.Timestamp.fromDate(data);
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
    console.log(
      "[BrowseAI Webhook] Received data:",
      JSON.stringify(data, null, 2)
    );

    const task = data?.task;
    if (!task?.id) {
      throw new Error("Task ID is required");
    }

    const taskId = task.id;

    // Get the first key-value pair in inputParameters
    const inputParams = task.inputParameters || {};
    const [firstKey, firstValue] = Object.entries(inputParams)[0] || [];

    const originUrl = firstValue || "unknown";

    const timestamp = this.admin.firestore.Timestamp.fromDate(new Date());
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
      const screenshotsRef = this.db
        .collection("captured_screenshots")
        .doc(taskId);
      const screenshotsData = this.convertToFirestoreFormat(
        task.capturedScreenshots
      );
      batch.set(screenshotsRef, {
        taskId,
        originUrl,
        createdAt: timestamp,
        data: screenshotsData,
      });
    }

    // Process captured lists
    if (task.capturedLists) {
      // Use originUrl directly if it's valid, otherwise extract domain name
      let docId = "unknown";

      if (originUrl && originUrl !== "unknown") {
        // If we have a valid origin URL, use it directly as the document ID
        docId = originUrl;
        console.log(
          "[BrowseAI Webhook] Using origin URL as document ID:",
          docId
        );
      } else {
        // Fallback to extracting domain name from URL
        try {
          const urlObj = new URL(originUrl); // e.g., https://www.espn.ph
          const hostnameParts = urlObj.hostname.split("."); // ['www', 'espn', 'ph']
          docId =
            hostnameParts.length > 1
              ? hostnameParts[hostnameParts.length - 2]
              : hostnameParts[0];
        } catch (err) {
          console.warn("Failed to parse originUrl:", originUrl);
        }
      }

      const listsRef = this.db.collection("captured_lists").doc(docId);
      const listsData = this.convertToFirestoreFormat(task.capturedLists);

      // Check if document already exists
      const docSnapshot = await listsRef.get();

      if (docSnapshot.exists) {
        console.log(
          `[BrowseAI Webhook] Document '${docId}' already exists, updating data...`
        );
        // Document exists, merge the new data with existing data
        const existingData = docSnapshot.data();

        // Merge the new lists data with existing data
        const mergedData = {
          ...existingData,
          taskId, // Update with latest task ID
          originUrl, // Update origin URL
          updatedAt: timestamp, // Add update timestamp
          // Keep the existing createdAt timestamp
          data: existingData.data
            ? // If data field exists, merge with new data
              { ...existingData.data, ...listsData }
            : // Otherwise, use new data
              listsData,
        };

        batch.set(listsRef, mergedData);
      } else {
        // Document doesn't exist, create new document
        batch.set(listsRef, {
          taskId,
          originUrl,
          createdAt: timestamp,
          data: listsData,
        });
      }
    }

    await batch.commit();
    console.log("[BrowseAI Webhook] Successfully processed task:", taskId);

    return {
      success: true,
      message: "Webhook processed successfully",
      taskId,
    };
  }
}

module.exports = WebhookService;
