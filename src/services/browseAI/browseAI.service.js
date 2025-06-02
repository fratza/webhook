const { admin, db } = require('../../config/firebase');
const { extractDomainIdentifier, cleanDataFields, appendNewData } = require('../../utils/browseai');
const { convertToFirestoreFormat } = require('../../utils/firestore');

/**
 * Service class for handling BrowseAI webhook operations
 */
class BrowseAIService {
  constructor() {
    this.db = db;
    this.admin = admin;
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
    const inputParams = task.inputParameters || {};
    const [firstKey, firstValue] = Object.entries(inputParams)[0] || [];

    const originUrl = firstValue || "unknown";
    const docName = extractDomainIdentifier(originUrl);

    const timestamp = this.admin.firestore.Timestamp.fromDate(new Date());

    const batch = this.db.batch();

    // Process captured texts
    if (task.capturedTexts) {
      const textsRef = this.db.collection("captured_texts").doc(docName);
      const textsData = convertToFirestoreFormat(task.capturedTexts);

      const docSnapshot = await textsRef.get();
      const existingData = docSnapshot.exists ? docSnapshot.data() : null;

      // Pass existing data and originUrl to cleanDataFields
      const processedData = cleanDataFields(
        textsData,
        existingData,
        originUrl,
        docName
      );

      if (docSnapshot.exists) {
        const appendData = appendNewData(
          docSnapshot,
          processedData,
          originUrl
        );
        batch.set(textsRef, appendData);
      } else {
        // Document doesn't exist, create new document
        const prepData = {
          data: {
            ...processedData,
          },
        };
        batch.set(textsRef, prepData);
      }
    }

    // Process captured screenshots
    if (task.capturedScreenshots) {
      const screenshotsRef = this.db
        .collection("captured_screenshots")
        .doc(docName);
      const screenshotsData = convertToFirestoreFormat(
        task.capturedScreenshots
      );
      batch.set(screenshotsRef, {
        data: screenshotsData,
        timestamp,
        originUrl,
      });
    }

    // Process captured lists
    if (task.capturedLists) {
      const listsRef = this.db.collection("captured_lists").doc(docName);
      const listsData = convertToFirestoreFormat(task.capturedLists);

      const docSnapshot = await listsRef.get();
      const existingData = docSnapshot.exists ? docSnapshot.data() : null;

      const processedData = cleanDataFields(
        listsData,
        existingData,
        originUrl,
        docName
      );

      if (docSnapshot.exists) {
        const appendData = appendNewData(docSnapshot, processedData, originUrl);
        batch.set(listsRef, appendData);
      } else {
        const prepData = {
          data: {
            ...processedData,
          },
        };
        batch.set(listsRef, prepData);
      }
    }

    // Commit all the batch operations
    try {
      await batch.commit();
      console.log(`[BrowseAI Webhook] Batch committed successfully for ${docName}`);
      return {
        success: true,
        message: "Webhook data processed successfully",
        docName,
      };
    } catch (error) {
      console.error("[BrowseAI Webhook] Error committing batch:", error);
      throw new Error(`Failed to commit batch: ${error.message}`);
    }
  }
}

module.exports = { BrowseAIService };
