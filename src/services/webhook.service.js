class WebhookService {
  constructor(admin, db) {
    this.admin = admin;
    this.db = db;

    // Define key fields for deduplication once
    this.keyFields = ["Title", "EventDate", "Location", "Sports"];
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

    // Get the first key-value pair in inputParameters
    const inputParams = task.inputParameters || {};
    const [firstKey, firstValue] = Object.entries(inputParams)[0] || [];

    const originUrl = firstValue || "unknown";
    const docName = this.extractDomainIdentifier(originUrl);

    const timestamp = this.admin.firestore.Timestamp.fromDate(new Date());

    const batch = this.db.batch();

    // Process captured texts
    if (task.capturedTexts) {
      const textsRef = this.db.collection("captured_texts").doc(docName);
      const textsData = this.convertToFirestoreFormat(task.capturedTexts);

      const docSnapshot = await textsRef.get();
      const existingData = docSnapshot.exists ? docSnapshot.data() : null;

      // Pass existing data and originUrl to cleanDataFields
      const processedData = this.cleanDataFields(
        textsData,
        existingData,
        originUrl,
        docName
      );

      if (docSnapshot.exists) {
        const appendData = this.appendNewData(
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
      const screenshotsData = this.convertToFirestoreFormat(
        task.capturedScreenshots
      );
      batch.set(screenshotsRef, {
        data: screenshotsData,
      });
    }

    // Process captured lists
    if (task.capturedLists) {
      const listsRef = this.db.collection("captured_lists").doc(docName);
      const listsData = this.convertToFirestoreFormat(task.capturedLists);

      const docSnapshot = await listsRef.get();
      const existingData = docSnapshot.exists ? docSnapshot.data() : null;

      const processedData = this.cleanDataFields(
        listsData,
        existingData,
        originUrl,
        docName
      );

      if (docSnapshot.exists) {
        const appendData = this.appendNewData(
          docSnapshot,
          processedData,
          originUrl
        );
        batch.set(listsRef, appendData);
      } else {
        // Document doesn't exist, create new document
        const prepData = {
          data: {
            ...processedData,
          },
        };
        batch.set(listsRef, prepData);
      }
    }

    // Commit all batched operations to Firestore
    await batch.commit();
    console.log(
      "[BrowseAI Webhook] Successfully processed and saved data for document:",
      docName
    );

    return {
      success: true,
      message: "Webhook processed successfully",
      docName,
    };
  }

  /**
   * Append new data to existing document data
   * @param {Object} docSnapshot - Firestore document snapshot
   * @param {Object} processedData - New data to append
   * @param {string} originUrl - Origin URL
   * @returns {Object} Merged data
   */
  appendNewData(docSnapshot, processedData, originUrl) {
    const existingData = docSnapshot.data();
    const mergedData = JSON.parse(JSON.stringify(existingData));

    if (!mergedData.data) mergedData.data = {};

    Object.keys(processedData).forEach((key) => {
      const newValue = processedData[key];

      if (Array.isArray(newValue)) {
        const existingArray = mergedData.data[key] || [];
        mergedData.data[key] = [...existingArray, ...newValue];
      } else {
        mergedData.data[key] = newValue;
      }
    });

    return mergedData;
  }

  /**
   * Extract a domain identifier from a URL
   * @param {string} url - The URL to extract from
   * @returns {string} The extracted domain identifier
   */
  extractDomainIdentifier(url) {
    let docName = "unknown";

    try {
      if (url && url !== "unknown") {
        const urlObj = new URL(url);
        const parts = urlObj.hostname.split(".");

        if (parts.length >= 2) {
          const domainParts = parts.slice(-2);
          docName = domainParts.join(".");
        } else {
          docName = urlObj.hostname;
        }
      }
    } catch (error) {
      console.warn("Invalid URL:", url);
    }

    return docName;
  }

  /**
   * Clean data by removing unwanted fields at all nesting levels
   * and add optional Image URL field if needed
   * @param {Object} data - The data to clean
   * @param {Object} existingData - Optional existing data to check for arrays
   * @param {string} originUrl - The origin URL to include in each item
   * @param {string} docName - The document name derived from the origin URL
   * @returns {Object} Cleaned data with unwanted fields removed and optional fields added
   */
  cleanDataFields(
    data,
    existingData = null,
    originUrl = "unknown",
    docName = null
  ) {
    // Early return for non-objects
    if (!data || typeof data !== "object") return data;

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item) =>
        this.cleanDataFields(item, existingData, originUrl, docName)
      );
    }

    // Handle objects
    const cleaned = {};
    const entries = Object.entries(data);

    for (const [key, value] of entries) {
      // Skip position/Position and _STATUS fields
      if (key.toLowerCase() === "position" || key === "_STATUS") continue;

      // Process arrays (like Sports Headlines, etc.)
      if (Array.isArray(value)) {
        cleaned[key] = this.processArrayField(
          key,
          value,
          existingData,
          originUrl,
          docName
        );
      } else {
        // Recursively clean nested objects
        cleaned[key] =
          typeof value === "object"
            ? this.cleanDataFields(value, existingData, originUrl, docName)
            : value;
      }
    }

    return cleaned;
  }

  /**
   * Process an array field, handling deduplication and enrichment
   * @param {string} key - The field key
   * @param {Array} array - The array to process
   * @param {Object} existingData - Existing data to check against
   * @param {string} originUrl - Origin URL
   * @param {string} docName - Document name
   * @returns {Array} Processed array
   */
  processArrayField(key, array, existingData, originUrl, docName) {
    // Check if this array already exists in the existing data
    const existingArray = existingData?.data?.entries?.[key];

    // Process the current array items
    const processedItems = array.map((item, index) => {
      const processedItem = this.cleanDataFields(
        item,
        existingData,
        originUrl,
        docName
      );

      // Generate a unique ID for this item
      const uid = `${key
        .toLowerCase()
        .replace(/\s+/g, "-")}-${Date.now()}-${index}`;

      const newLabel = {
        uid,
        Title: key,
        originUrl, // Add originUrl to each item
        ...processedItem,
      };

      // Add Image URL if it's missing
      if (!("ImageUrl" in processedItem)) {
        newLabel["ImageUrl"] = "";
      } else {
        // Clean ImageUrl by removing query parameters (everything after '?')
        const imageUrl = processedItem["ImageUrl"] || "";
        newLabel["ImageUrl"] = imageUrl.split("?")[0];
      }

      // Special handling for olemisssports.com EventDate field
      this.processEventDate(newLabel, processedItem, docName, originUrl, key);

      return newLabel;
    });

    // Deduplicate items before adding them
    const deduplicated = this.deduplicateItems(processedItems);

    // If the array already exists, append to it; otherwise create a new one
    if (existingArray && Array.isArray(existingArray)) {
      // Deduplicate against existing items
      const finalItems = this.deduplicateAgainstExisting(
        deduplicated,
        existingArray
      );

      return [...existingArray, ...finalItems];
    }

    return deduplicated;
  }

  /**
   * Process event date for special sites like olemisssports.com
   * @param {Object} newLabel - The item being processed
   * @param {Object} processedItem - The processed item data
   * @param {string} docName - Document name
   * @param {string} originUrl - Origin URL
   * @param {string} key - The field key
   */
  processEventDate(newLabel, processedItem, docName, originUrl, key) {
    const isOleMissSite =
      docName === "olemisssports.com" ||
      originUrl.includes("olemisssports.com") ||
      key === "Ole Sport" ||
      newLabel.Title === "Ole Sport";

    if (!isOleMissSite || !processedItem.EventDate) return;

    try {
      const eventDateStr = processedItem.EventDate;
      // Parse dates like "Jun 13\n(Fri)\n-\nJun 23\n(Mon)" or "May 28 (Wed) - May 31 (Sat)"
      const datePattern =
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:\s*\([^)]*\))?(?:\s*[-\n]+)?((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})?/;
      const match = eventDateStr.match(datePattern);

      if (!match) return;

      // Month mapping
      const monthMap = {
        Jan: "01",
        Feb: "02",
        Mar: "03",
        Apr: "04",
        May: "05",
        Jun: "06",
        Jul: "07",
        Aug: "08",
        Sep: "09",
        Oct: "10",
        Nov: "11",
        Dec: "12",
      };

      // Get current year
      const currentYear = new Date().getFullYear();

      // Extract start date components
      const startMonth = match[1];
      const startDay = match[2].padStart(2, "0");
      newLabel[
        "StartDate"
      ] = `${currentYear}-${monthMap[startMonth]}-${startDay}`;

      // Process end date if present
      if (match[3]) {
        const endDateParts = match[3].match(
          /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/
        );
        if (endDateParts) {
          const endMonth = endDateParts[1];
          const endDay = endDateParts[2].padStart(2, "0");
          newLabel[
            "EndDate"
          ] = `${currentYear}-${monthMap[endMonth]}-${endDay}`;
        } else {
          newLabel["EndDate"] = newLabel["StartDate"];
        }
      } else {
        newLabel["EndDate"] = newLabel["StartDate"];
      }
    } catch (error) {
      console.error(`[BrowseAI Webhook] Error processing date:`, error);
    }
  }

  /**
   * Generate a unique key for an item based on specified fields
   * @param {Object} item - The item to generate a key for
   * @returns {string} A unique key string
   */
  generateItemKey(item) {
    const filteredFields = this.keyFields.filter((field) => item[field]);
    return filteredFields.map((field) => `${field}:${item[field]}`).join("|");
  }

  /**
   * Deduplicate items within a single array based on key fields
   * @param {Array} items - Array of items to deduplicate
   * @returns {Array} Deduplicated array
   */
  deduplicateItems(items) {
    if (!Array.isArray(items) || items.length <= 1) return items;

    const uniqueMap = new Map();
    const result = [];

    for (const item of items) {
      const uniqueKey = this.generateItemKey(item);

      if (!uniqueMap.has(uniqueKey)) {
        uniqueMap.set(uniqueKey, true);
        result.push(item);
      }
    }

    return result;
  }

  /**
   * Deduplicate new items against existing items
   * @param {Array} newItems - New items to check
   * @param {Array} existingItems - Existing items to check against
   * @returns {Array} Deduplicated new items
   */
  deduplicateAgainstExisting(newItems, existingItems) {
    if (
      !Array.isArray(newItems) ||
      newItems.length === 0 ||
      !Array.isArray(existingItems) ||
      existingItems.length === 0
    ) {
      return newItems;
    }

    // Create a map of existing items
    const existingMap = new Map();

    for (const item of existingItems) {
      existingMap.set(this.generateItemKey(item), true);
    }

    // Filter out new items that already exist
    return newItems.filter(
      (item) => !existingMap.has(this.generateItemKey(item))
    );
  }
}

module.exports = WebhookService;
