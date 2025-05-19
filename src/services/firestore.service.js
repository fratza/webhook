const admin = require('firebase-admin');

class FirestoreService {
  constructor() {
    this.db = admin.firestore();
  }

  /**
   * Fetch documents from a Firestore collection with optional filtering
   * @param {string} collection - Collection name
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of documents to return
   * @param {Array} options.where - Array of [field, operator, value] for filtering
   * @returns {Promise<Array>} Array of documents
   */
  async fetchFromCollection(collection, options = {}) {
    try {
      const { limit = 10, where } = options;
      let query = this.db.collection(collection);

      // Apply where clause if provided
      if (where) {
        const [field, operator, value] = where;
        query = query.where(field, operator, value);
      }

      // Apply limit
      query = query.limit(parseInt(limit));

      const snapshot = await query.get();
      const data = [];

      snapshot.forEach(doc => {
        data.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('Error fetching from Firestore:', error);
      throw error;
    }
  }
}

module.exports = new FirestoreService();
