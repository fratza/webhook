const { db } = require('../../config/firebase');

/**
 * Service class for handling Firestore operations
 */
class FirestoreService {
  constructor() {
    this.db = db;
  }

  /**
   * Delete a document by ID from a collection
   * @param {string} collection - Firestore collection name
   * @param {string} documentId - Document ID to delete
   * @returns {Promise<Object>} Result of the delete operation
   */
  async deleteDocumentById(collection, documentId) {
    try {
      const docRef = this.db.collection(collection).doc(documentId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return {
          success: false,
          error: `Document with ID ${documentId} not found in collection ${collection}`,
        };
      }

      await docRef.delete();

      return {
        success: true,
        message: `Document with ID ${documentId} deleted successfully from collection ${collection}`,
      };
    } catch (error) {
      console.error("Error in deleteDocumentById:", error);
      throw error;
    }
  }
}

module.exports = { FirestoreService };
