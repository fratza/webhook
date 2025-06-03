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

const corsOptions = {
  origin: "https://ntv360-f37b9.web.app", // 🔒 Specific origin
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

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

module.exports = app;
