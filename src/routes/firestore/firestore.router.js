const express = require("express");
const {
  FirestoreService,
} = require("../../services/firestore/firestore.service");
const cors = require("cors");

const FIRESTORE_ROUTER = express.Router();
const firestoreService = new FirestoreService();

// Define the same CORS options as in app.js
const corsOptions = {
  origin: [
    "https://ntv360-f37b9.web.app",
    "https://ntv360-f37b9.firebaseapp.com",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],
  credentials: true,
  optionsSuccessStatus: 204,
};

// Apply CORS middleware with specific options
FIRESTORE_ROUTER.use(cors(corsOptions));
FIRESTORE_ROUTER.options("*", cors(corsOptions));

/**
 * Test endpoint to verify CORS configuration
 *
 * @route GET /cors-test
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {void} Sends a JSON response with CORS headers
 */
FIRESTORE_ROUTER.get("/cors-test", (req, res) => {
  res.json({
    success: true,
    message: "CORS test successful",
    headers: {
      "access-control-allow-origin": res.getHeader(
        "Access-Control-Allow-Origin"
      ),
      "access-control-allow-methods": res.getHeader(
        "Access-Control-Allow-Methods"
      ),
      "access-control-allow-headers": res.getHeader(
        "Access-Control-Allow-Headers"
      ),
    },
  });
});

/**
 * Endpoint to list all documents in a collection
 *
 * @route GET /:collection
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {void} Sends a JSON response with all documents in the collection
 */
FIRESTORE_ROUTER.get("/:collection", async (req, res) => {
  try {
    const { collection } = req.params;
    console.log(
      `[FIRESTORE] Listing all documents in collection ${collection}`
    );

    const collectionRef = firestoreService.db.collection(collection);
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
      console.log(`[FIRESTORE] No documents found in collection ${collection}`);
      return res.json({
        success: true,
        message: `No documents found in collection ${collection}`,
        data: [],
      });
    }

    const documents = [];
    snapshot.forEach((doc) => {
      documents.push({
        id: doc.id,
        data: doc.data(),
      });
    });

    console.log(
      `[FIRESTORE] Found ${documents.length} documents in collection ${collection}`
    );
    res.json({
      success: true,
      count: documents.length,
      data: documents,
    });
  } catch (error) {
    console.error("Error listing documents from Firestore:", error);
    res.status(500).json({ error: "Failed to list documents from Firestore" });
  }
});

/**
 * Endpoint to get a document by ID from a collection
 *
 * @route GET /:collection/:documentId
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {void} Sends a JSON response with the document data
 */
FIRESTORE_ROUTER.get("/:collection/:documentId", async (req, res) => {
  try {
    const { collection, documentId } = req.params;
    console.log(
      `[FIRESTORE] Getting document ${documentId} from collection ${collection}`
    );

    const docRef = firestoreService.db.collection(collection).doc(documentId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: `Document with ID ${documentId} not found in collection ${collection}`,
      });
    }

    res.json({
      success: true,
      data: doc.data(),
    });
  } catch (error) {
    console.error("Error retrieving document from Firestore:", error);
    res
      .status(500)
      .json({ error: "Failed to retrieve document from Firestore" });
  }
});

/**
 * Endpoint to delete a document by ID
 *
 * @route DELETE /:collection/:documentId
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {void} Sends a JSON response indicating success or failure
 */
FIRESTORE_ROUTER.delete("/:collection/:documentId", async (req, res) => {
  try {
    const { collection, documentId } = req.params;

    const result = await firestoreService.deleteDocumentById(
      collection,
      documentId
    );

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error("Error deleting document from Firestore:", error);
    res.status(500).json({ error: "Failed to delete document from Firestore" });
  }
});

module.exports = FIRESTORE_ROUTER;
