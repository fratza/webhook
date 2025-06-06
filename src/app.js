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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/** Enable CORS for all routes */
app.use(cors());
app.options("*", cors());

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
 * API checkup endpoint to verify the API is working
 * @name /api/checkup
 */
app.get("/api/checkup", (req, res) => {
  const status = {
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: env,
    uptime: process.uptime(),
  };
  res.status(200).json(status);
});

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

module.exports = app;
