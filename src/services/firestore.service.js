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
      const doc = await this.db.collection(collection).doc(documentId).get();

      if (!doc.exists) {
        return { success: false, error: "Document not found" };
      }

      const categoryData = doc.data()?.data?.[categoryName] || [];

      if (!Array.isArray(categoryData)) {
        return {
          success: false,
          error: `Category '${categoryName}' not found or is not an array`,
        };
      }

      const sortedData = categoryData.slice().sort((a, b) => {
        const getTime = (item) =>
          item.publishedDate?.toMillis?.() ||
          item.createdAt?.toMillis?.() ||
          item.createdAtFormatted?.toMillis?.() ||
          item.publishedDate ||
          item.createdAt ||
          item.createdAtFormatted ||
          0;

        return getTime(b) - getTime(a);
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
