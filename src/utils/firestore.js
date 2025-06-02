const { admin } = require('../config/firebase');

/**
 * Convert data to Firestore-compatible format
 * @param {any} data - Data to convert
 * @returns {any} Firestore-compatible data
 */
function convertToFirestoreFormat(data) {
  if (data === null || data === undefined) {
    return null;
  }

  if (Array.isArray(data)) {
    return data.map((item) => convertToFirestoreFormat(item));
  }

  if (data instanceof Date) {
    return admin.firestore.Timestamp.fromDate(data);
  }

  if (typeof data === "object") {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = convertToFirestoreFormat(value);
    }
    return result;
  }

  return data;
}

module.exports = {
  convertToFirestoreFormat
};
