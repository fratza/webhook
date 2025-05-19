const admin = require("firebase-admin");

class FirestoreService {
  constructor() {
    this.db = admin.firestore();
  }

  /**
   * Fetch documents from a Firestore collection with optional filtering
   * @param {string} collection - Collection name
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of documents to return
   * @param {Object} options.where - Object with field-value pairs for filtering
   * @returns {Promise<Array>} Array of documents
   */
  async fetchFromCollection(collection, options = {}) {
    try {
      let query = this.db.collection(collection);

      // Apply where clause if provided
      if (options.where) {
        Object.entries(options.where).forEach(([field, value]) => {
          query = query.where(field, '==', value);
        });
      }

      // Apply limit if provided
      if (options.limit) {
        query = query.limit(parseInt(options.limit));
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error fetching documents from Firestore:", error);
      throw error;
    }
  }
}

module.exports = new FirestoreService();
