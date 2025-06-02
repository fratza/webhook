const express = require('express');
const { FirestoreService } = require('../../services/firestore/firestore.service');

const FIRESTORE_ROUTER = express.Router();
const firestoreService = new FirestoreService();

/**
 * Endpoint to delete a document by ID
 * 
 * @route DELETE /:collection/:documentId
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {void} Sends a JSON response indicating success or failure
 */
FIRESTORE_ROUTER.delete('/:collection/:documentId', async (req, res) => {
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
        res
            .status(500)
            .json({ error: "Failed to delete document from Firestore" });
    }
});

module.exports = FIRESTORE_ROUTER;
