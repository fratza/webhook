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
        return { success: false, error: 'Document not found' };
      }
      
      await docRef.delete();
      return { success: true, message: 'Document deleted successfully' };
    } catch (error) {
      console.error("Error deleting document from Firestore:", error);
      throw error;
    }
  }
}

module.exports = FirestoreService;
