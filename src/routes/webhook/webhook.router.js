const express = require('express');
const { BrowseAIService } = require('../../services/browseAI/browseAI.service');
const cors = require('cors');

const WEBHOOK_ROUTER = express.Router();
const browseAIService = new BrowseAIService();

// Apply CORS middleware to this router
WEBHOOK_ROUTER.use(cors());
WEBHOOK_ROUTER.options("*", cors());

/**
 * Handles incoming POST requests to dynamic webhook endpoints under `/api/webhooks/:webhookId`.
 *
 * Currently supports:
 * - `browseAI`: Processes webhook data using the `BrowseAIService`.
 *
 * Example usage:
 * - POST to `/api/webhooks/browseAI` with JSON payload
 *
 * @route POST /:webhookId
 * @param {Object} req - The Express request object containing webhook data and params.
 * @param {Object} res - The Express response object used to send responses.
 * @returns {void} Sends a JSON response indicating success or failure.
 */
WEBHOOK_ROUTER.post('/:webhookId', async (req, res) => {
    const webhookId = req.params.webhookId;
    console.log('[Webhook] Incoming request at URL:', webhookId);

    // BrowseAI Webhook
    if (webhookId === 'browseAI') {
        try {
            console.log('[BrowseAI Webhook] Received request');

            const result = await browseAIService.processBrowseAIWebhook(req.body);

            res.json(result);
        } catch (error) {
            console.error('[BrowseAI Webhook] Error:', error);

            res.status(500).json({
                success: false,
                error: error.message || 'Error processing BrowseAI webhook data',
            });
        }
    } else {
        res.status(404).json({
            success: false,
            error: `Webhook handler not found for: ${webhookId}`
        });
    }
});

/**
 * Tests the webhook service status
 *
 * @route GET /status
 * @param {Object} req - The Express request object
 * @param {Object} res - The Express response object used to send responses
 * @returns {void} Sends a JSON response with the webhook service status
 */
WEBHOOK_ROUTER.get('/status', (req, res) => {
    try {
        // Get server uptime
        const uptime = process.uptime();

        // Format uptime
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const formattedUptime = `${days}d ${hours}h ${minutes}m ${seconds}s`;

        // Return status information
        res.json({
            status: 'ok',
            message: 'Webhook service is running',
            timestamp: new Date().toISOString(),
            uptime: formattedUptime,
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
        });
    } catch (error) {
        console.error(`Error checking webhook status: ${error}`);
        res.status(500).json({
            status: 'error',
            message: 'Failed to check webhook status',
            error: error.message,
        });
    }
});

module.exports = WEBHOOK_ROUTER;
