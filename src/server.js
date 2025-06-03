/**
 * Main entry point for the application
 * This file imports the Express app and starts the server
 */
const app = require("./app");
const dotenv = require("dotenv");

/** Initialize environment */
dotenv.config();
const env = process.env.NODE_ENV || "development";
const PORT = process.env.PORT || 3000;

/** Start server */
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running in ${env} mode on port ${PORT}`);
  });
}

/** Handle uncaught exceptions and unhandled rejections */
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION! Shutting down...");
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION! Shutting down...");
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

module.exports = app;
