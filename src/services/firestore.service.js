class FirestoreService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Fetch list of document IDs from a collection
   * @param {string} collection - Collection name
   * @returns {Promise<Array>} Array of document IDs
   */
  async fetchFromCollection(collection) {
    try {
      const snapshot = await this.db.collection(collection).get();
      const documentIds = snapshot.docs.map((doc) => doc.id);
      return {
        documents: documentIds,
      };
    } catch (error) {
      console.error("Error fetching documents from Firestore:", error);
      throw error;
    }
  }

  /**
   * Fetch a single document by ID from a collection
   * @param {string} collection - Collection name
   * @param {string} documentId - Document ID
   * @returns {Promise<Object|null>} Document data or null if not found
   */
  async fetchDocumentById(collection, documentId) {
    try {
      const docRef = this.db.collection(collection).doc(documentId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return null;
      }

      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error("Error fetching document from Firestore:", error);
      throw error;
    }
  }

  /**
   * Delete a document by ID from a collection
   * @param {string} collection - Collection name
   * @param {string} documentId - Document ID to delete
   * @returns {Promise<Object>} Result of the delete operation
   */
  async deleteDocumentById(collection, documentId) {
    try {
      const docRef = this.db.collection(collection).doc(documentId);

      // Check if document exists before deleting
      const doc = await docRef.get();
      if (!doc.exists) {
        return { success: false, error: "Document not found" };
      }

      await docRef.delete();
      return { success: true, message: "Document deleted successfully" };
    } catch (error) {
      console.error("Error deleting document from Firestore:", error);
      throw error;
    }
  }

  /**
   * Fetch array names (categories) from a document
   * @param {string} collection - Collection name
   * @param {string} documentId - Document ID
   * @returns {Promise<Object>} Object containing array names in the document
   */
  async fetchCategoriesFromDocument(collection, documentId) {
    try {
      const docRef = this.db.collection(collection).doc(documentId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return { success: false, error: "Document not found" };
      }

      const data = doc.data();

      // Get the data object which contains the arrays
      const docData = data.data || {};

      // Find all keys that are arrays
      const categories = Object.keys(docData).filter((key) => {
        return Array.isArray(docData[key]);
      });

      return {
        success: true,
        documentId,
        categories,
      };
    } catch (error) {
      console.error("Error fetching categories from Firestore:", error);
      throw error;
    }
  }

  /**
   * Fetch data from a specific category in a document
   * @param {string} collection - Collection name
   * @param {string} documentId - Document ID
   * @param {string} categoryName - Category/array name to fetch
   * @returns {Promise<Object>} Object containing the category data
   */
  async fetchCategoryData(collection, documentId, categoryName) {
    try {
      const docRef = this.db.collection(collection).doc(documentId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return { success: false, error: "Document not found" };
      }

      const data = doc.data();
      const docData = data.data || {};

      // Check if the category exists and is an array
      if (!docData[categoryName] || !Array.isArray(docData[categoryName])) {
        return {
          success: false,
          error: `Category '${categoryName}' not found or is not an array`,
        };
      }

      // Sort the data in descending order by publishedDate or createdAt
      const sortedData = [...docData[categoryName]].sort((a, b) => {
        // Try to use publishedDate first, then fall back to createdAt
        const dateA =
          a.publishedDate || a.createdAt || a.createdAtFormatted || 0;
        const dateB =
          b.publishedDate || b.createdAt || b.createdAtFormatted || 0;

        // If the dates are Firestore timestamps, convert them to milliseconds
        const timeA = dateA && dateA.toMillis ? dateA.toMillis() : dateA;
        const timeB = dateB && dateB.toMillis ? dateB.toMillis() : dateB;

        // Sort in descending order (newest first)
        return timeB - timeA;
      });

      return {
        success: true,
        documentId,
        categoryName,
        data: sortedData,
        count: sortedData.length,
      };
    } catch (error) {
      console.error("Error fetching category data from Firestore:", error);
      throw error;
    }
  }
}

module.exports = FirestoreService;
