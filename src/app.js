const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');

/** Initialize environment */
dotenv.config();
const env = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 3000;

/** Import routers */
const WEBHOOK_ROUTER = require('./routes/webhook');
const FIRESTORE_ROUTER = require('./routes/firestore');

/** Initialize Firebase Admin */
const admin = require('./config/firebase');

/** Initialize Express app */
const app = express();

/** Middleware for parsing request bodies */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/** Enable CORS for all origins */
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle OPTIONS preflight requests
app.options('*', cors());

/** Middleware to log requests */
app.use('/', (req, res, next) => {
    console.log(`[INCOMING REQUEST] ${req.method} ${req.url}`);
    res.on('finish', () => {
        console.log(`[REQUEST SUCCESSFUL] ${req.method} ${req.url} with status ${res.statusCode}`);
    });
    next();
});

/** Log environment variables */
console.log(`[ENVIRONMENT:PORT] ${env}:${PORT}`);

/**
 * Route serving webhook controller.
 * @name /api/webhooks
 */
app.use('/api/webhooks', WEBHOOK_ROUTER);

/**
 * Route serving firestore operations.
 * @name /api/firestore
 */
app.use('/api/firestore', FIRESTORE_ROUTER);

/**
 * Global error handlers for unhandled exceptions and rejections
 */
process.on('unhandledRejection', (reason, promise) => {
    console.error(`[ERROR - Unhandled Rejection]: ${reason}`);
});
process.on('uncaughtException', (error) => {
    console.error(`[ERROR - Uncaught Exception]: ${error.message}`);
});

/**
 * Start server
 */
app.listen(PORT, () => {
    console.log(`[SERVER] Server is running on http://localhost:${PORT}`);
});

module.exports = app;
