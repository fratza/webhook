const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");

/** Initialize environment */
dotenv.config();
const env = process.env.NODE_ENV || "development";
const PORT = process.env.PORT || 3000;

/** Import routers */
const WEBHOOK_ROUTER = require("./routes/webhook");
const FIRESTORE_ROUTER = require("./routes/firestore");

/** Initialize Firebase Admin */
const admin = require("./config/firebase");

/** Initialize Express app */
const app = express();

/** Middleware for parsing request bodies */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Define comprehensive CORS options
const corsOptions = {
  origin: "*",  // Allow all origins
  methods: "GET,POST,PUT,DELETE,OPTIONS",
  allowedHeaders: "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  credentials: false,
  maxAge: 86400 // 24 hours in seconds - caches preflight request results
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests for all routes
app.options("*", cors(corsOptions));

// Add custom CORS headers as a fallback
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  
  // Handle preflight OPTIONS requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  next();
});

/** Middleware to log requests */
app.use("/", (req, res, next) => {
  console.log(`[INCOMING REQUEST] ${req.method} ${req.url}`);
  res.on("finish", () => {
    console.log(
      `[REQUEST SUCCESSFUL] ${req.method} ${req.url} with status ${res.statusCode}`
    );
  });
  next();
});

/** Log environment variables */
console.log(`[ENVIRONMENT:PORT] ${env}:${PORT}`);

/**
 * Route serving webhook controller.
 * @name /api/webhooks
 */
app.use("/api/webhooks", WEBHOOK_ROUTER);

/**
 * Route serving firestore operations.
 * @name /api/firestore
 */
app.use("/api/firestore", FIRESTORE_ROUTER);

/**
 * Global error handlers for unhandled exceptions and rejections
 */
process.on("unhandledRejection", (reason, promise) => {
  console.error(`[ERROR - Unhandled Rejection]: ${reason}`);
});
process.on("uncaughtException", (error) => {
  console.error(`[ERROR - Uncaught Exception]: ${error.message}`);
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`[SERVER] Server is running on http://localhost:${PORT}`);
});

module.exports = app;
