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
      // Always extract the middle part of the domain as document ID
      let docId = "unknown";

      try {
        if (originUrl && originUrl !== "unknown") {
          const urlObj = new URL(originUrl); // e.g., https://www.espn.com.ph
          const hostnameParts = urlObj.hostname.split("."); // ['www', 'espn', 'com', 'ph']

          // Extract the middle part (like "espn" from "www.espn.com.ph")
          if (hostnameParts.length >= 3) {
            // For domains with at least 3 parts (www.espn.com, www.espn.ph, etc.)
            // Take the second part (index 1)
            docId = hostnameParts[1];
          } else if (hostnameParts.length === 2) {
            // For domains with 2 parts (espn.com, espn.ph, etc.)
            // Take the first part (index 0)
            docId = hostnameParts[0];
          } else {
            // For single part domains (localhost, etc.)
            docId = hostnameParts[0];
          }

          console.log(
            `[BrowseAI Webhook] Extracted '${docId}' from URL: ${originUrl}`
          );
        }
      } catch (err) {
        console.warn("Failed to parse originUrl:", originUrl);
      }

      const listsRef = this.db.collection("captured_lists").doc(docId);
      const listsData = this.convertToFirestoreFormat(task.capturedLists);

      // Check if document already exists
      const docSnapshot = await listsRef.get();

      // Remove 'Position' from listsData
      const { Position, ...filteredListsData } = listsData;

      if (docSnapshot.exists) {
        console.log(
          `[BrowseAI Webhook] Document '${docId}' already exists, updating data...`
        );

        const existingData = docSnapshot.data();

        const mergedData = {
          ...existingData,
          data: {
            ...existingData.data,
            [taskId]: {
              ...filteredListsData,
              createdAt: timestamp,
            },
          },
        };

        batch.set(listsRef, mergedData);
      } else {
        // Document doesn't exist, create new document
        const prepData = {
          data: {
            originUrl,
            [taskId]: {
              ...filteredListsData,
              createdAt: timestamp,
            },
          },
        };
        batch.set(listsRef, prepData);
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
