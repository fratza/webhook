/**
 * Main entry point for the application
 * This file imports the Express app and starts the server
 */
const app = require("./app");
const dotenv = require("dotenv");
const cors = require("cors");

/** Initialize environment */
dotenv.config();
const env = process.env.NODE_ENV || "development";
const PORT = process.env.PORT || 3000;

/** Import custom middleware */
const corsMiddleware = require("./middleware/cors.middleware");

/** Apply CORS middleware at the server level as well for maximum coverage */
app.use(corsMiddleware);

/** Add a diagnostic endpoint at the server level */
app.get('/api/cors-diagnostic', (req, res) => {
  // Set CORS headers explicitly
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Return diagnostic information
  res.json({
    success: true,
    message: 'CORS diagnostic endpoint',
    headers: {
      'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin'),
      'access-control-allow-methods': res.getHeader('Access-Control-Allow-Methods'),
      'access-control-allow-headers': res.getHeader('Access-Control-Allow-Headers')
    },
    environment: env,
    nodeVersion: process.version
  });
});

/** Start server */
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running in ${env} mode on port ${PORT}`);
    console.log(`CORS diagnostic endpoint available at: http://localhost:${PORT}/api/cors-diagnostic`);
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
