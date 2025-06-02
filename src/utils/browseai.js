/**
 * Extract domain identifier from a URL
 * @param {string} url - URL to extract domain from
 * @returns {string} Domain identifier
 */
function extractDomainIdentifier(url) {
  try {
    if (!url || typeof url !== 'string') {
      console.warn('[extractDomainIdentifier] Invalid URL:', url);
      return 'unknown';
    }

    // Add protocol if missing
    let processedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      processedUrl = 'https://' + url;
    }

    const urlObj = new URL(processedUrl);
    const hostname = urlObj.hostname;

    // Extract domain parts
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      // For common domains like example.com, return 'example'
      // For subdomains like sub.example.com, return 'sub-example'
      if (parts.length > 2 && parts[0] !== 'www') {
        return `${parts[0]}-${parts[parts.length - 2]}`.toLowerCase();
      }
      return parts[parts.length - 2].toLowerCase();
    }
    return hostname.toLowerCase();
  } catch (error) {
    console.error('[extractDomainIdentifier] Error parsing URL:', error);
    // Return a sanitized version of the URL if parsing fails
    return url.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  }
}

/**
 * Clean and process data fields
 * @param {Object} data - Data to clean
 * @param {Object|null} existingData - Existing data to compare against
 * @param {string} originUrl - Origin URL
 * @param {string} docName - Document name
 * @returns {Object} Cleaned data
 */
function cleanDataFields(data, existingData, originUrl, docName) {
  // If no existing data, just return the new data
  if (!existingData) {
    return data;
  }

  // Process data based on document type and structure
  return data;
}

/**
 * Append new data to existing document
 * @param {Object} docSnapshot - Firestore document snapshot
 * @param {Object} newData - New data to append
 * @param {string} originUrl - Origin URL
 * @returns {Object} Updated data
 */
function appendNewData(docSnapshot, newData, originUrl) {
  const existingData = docSnapshot.data();
  
  // Create a deep copy of existing data
  const updatedData = JSON.parse(JSON.stringify(existingData));
  
  // Merge new data with existing data
  if (updatedData.data) {
    // If data is an array, append new items
    if (Array.isArray(updatedData.data)) {
      updatedData.data = [...updatedData.data, ...newData];
    } else {
      // If data is an object, merge properties
      updatedData.data = { ...updatedData.data, ...newData };
    }
  } else {
    updatedData.data = newData;
  }
  
  // Update metadata
  updatedData.lastUpdated = new Date();
  updatedData.originUrl = originUrl;
  
  return updatedData;
}

module.exports = {
  extractDomainIdentifier,
  cleanDataFields,
  appendNewData
};
