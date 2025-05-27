// import dayjs from "dayjs";

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
    // if (!task?.id) {
    //   throw new Error("Task ID is required");
    // }

    // const taskId = task.id;

    // Get the first key-value pair in inputParameters
    const inputParams = task.inputParameters || {};
    const [firstKey, firstValue] = Object.entries(inputParams)[0] || [];

    const originUrl = firstValue || "unknown";
    const docId = this.extractDomainIdentifier(originUrl);

    const timestamp = this.admin.firestore.Timestamp.fromDate(new Date());
    // const formattedCreatedAt = dayjs(timestamp.toDate()).format(
    //   "MMMM D, YYYY h:mm A"
    // );
    const batch = this.db.batch();

    // Process captured texts
    if (task.capturedTexts) {
      const textsRef = this.db.collection("captured_texts").doc(docId);
      const textsData = this.convertToFirestoreFormat(task.capturedTexts);
      batch.set(textsRef, {
        // taskId,
        originUrl,
        createdAt: timestamp,
        data: textsData,
      });
    }

    // Process captured screenshots
    if (task.capturedScreenshots) {
      const screenshotsRef = this.db
        .collection("captured_screenshots")
        .doc(docId);
      const screenshotsData = this.convertToFirestoreFormat(
        task.capturedScreenshots
      );
      batch.set(screenshotsRef, {
        // taskId,
        originUrl,
        createdAt: timestamp,
        data: screenshotsData,
      });
    }

    // Process captured lists
    if (task.capturedLists) {
      const listsRef = this.db.collection("captured_lists").doc(docId);
      const listsData = this.convertToFirestoreFormat(task.capturedLists);

      const docSnapshot = await listsRef.get();
      const existingData = docSnapshot.exists ? docSnapshot.data() : null;

      // Pass existing data to cleanDataFields for array validation
      const processedData = this.cleanDataFields(listsData, existingData);

      if (docSnapshot.exists) {
        console.log(
          `[BrowseAI Webhook] Document '${docId}' already exists, updating data...`
        );

        const existingData = docSnapshot.data();

        // Create a deep copy of the existing data to work with
        const mergedData = JSON.parse(JSON.stringify(existingData));

        // Make sure the data structure exists
        if (!mergedData.data) mergedData.data = {};
        if (!mergedData.data.entries) mergedData.data.entries = {};

        // Set or update the originUrl
        mergedData.data.originUrl = mergedData.data.originUrl || originUrl;

        // Process each key in the processed data
        Object.keys(processedData).forEach((key) => {
          const newValue = processedData[key];

          // Check if this is an array that needs to be appended
          if (Array.isArray(newValue)) {
            // Get existing array if it exists
            const existingArray = mergedData.data.entries[key] || [];

            // Append new items to existing array
            mergedData.data.entries[key] = [...existingArray, ...newValue];
            console.log(
              `[BrowseAI Webhook] Appended ${newValue.length} new items to existing ${key} array`
            );
          } else {
            // For non-array values, just use the new value
            mergedData.data.entries[key] = newValue;
          }
        });

        // Add metadata to the entry
        // mergedData.data.lastUpdated = timestamp;
        // mergedData.data.lastUpdatedFormatted = formattedCreatedAt;
        batch.set(listsRef, mergedData);
      } else {
        // Document doesn't exist, create new document
        const prepData = {
          originUrl: originUrl,
          data: {
            processedData,
          },
        };
        batch.set(listsRef, prepData);
      }
    }

    // Commit all batched operations to Firestore
    await batch.commit();
    console.log(
      "[BrowseAI Webhook] Successfully processed and saved data for document:",
      docId
    );

    return {
      success: true,
      message: "Webhook processed successfully",
      docId,
    };
  }

  /**
   * Extract a domain identifier from a URL
   * @param {string} url - The URL to extract from
   * @returns {string} The extracted domain identifier
   */
  extractDomainIdentifier(url) {
    let docId = "unknown";

    try {
      if (url && url !== "unknown") {
        const urlObj = new URL(url); // e.g., https://www.espn.com.ph
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

        console.log(`[BrowseAI Webhook] Extracted '${docId}' from URL: ${url}`);
      }
    } catch (err) {
      console.warn("Failed to parse URL:", url);
    }

    return docId;
  }

  /**
   * Clean data by removing unwanted fields at all nesting levels
   * and add optional Image URL field if needed
   * @param {Object} data - The data to clean
   * @param {Object} existingData - Optional existing data to check for arrays
   * @returns {Object} Cleaned data with unwanted fields removed and optional fields added
   */
  cleanDataFields(data, existingData = null) {
    if (!data || typeof data !== "object") return data;

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item) => this.cleanDataFields(item, existingData));
    }

    // Handle objects
    const cleaned = {};

    // Process object entries in order
    const entries = Object.entries(data);
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];

      // Skip position/Position and _STATUS fields
      if (key.toLowerCase() !== "position" && key !== "_STATUS") {
        // Check if this is an array (like Sports Headlines, etc.)
        if (Array.isArray(value)) {
          // Check if this array already exists in the existing data
          const existingArray =
            existingData &&
            existingData.data &&
            existingData.data.entries &&
            existingData.data.entries[key];

          // Process the current array items
          const processedItems = value.map((item, index) => {
            const processedItem = this.cleanDataFields(item, existingData);

            // Generate a unique ID for this item
            const uid = `${key
              .toLowerCase()
              .replace(/\s+/g, "-")}-${Date.now()}-${index}`;

            const newLabel = {
              uid: uid,
              Title: key,
            };

            // Add all existing fields from the processed item
            Object.keys(processedItem).forEach((itemKey) => {
              newLabel[itemKey] = processedItem[itemKey];

              // Add Image URL if it's missing
              if (!("Image URL" in processedItem)) newLabel["Image URL"] = "";
            });

            return newLabel;
          });

          // If the array already exists, append to it; otherwise create a new one
          if (existingArray && Array.isArray(existingArray)) {
            console.log(
              `[BrowseAI Webhook] Found existing array for '${key}', appending ${processedItems.length} new items`
            );
            cleaned[key] = [...existingArray, ...processedItems];
          } else {
            console.log(
              `[BrowseAI Webhook] Creating new array for '${key}' with ${processedItems.length} items`
            );
            cleaned[key] = processedItems;
          }
        } else {
          // Recursively clean nested objects
          cleaned[key] =
            typeof value === "object"
              ? this.cleanDataFields(value, existingData)
              : value;
        }
      }
    }

    return cleaned;
  }
}

module.exports = WebhookService;
