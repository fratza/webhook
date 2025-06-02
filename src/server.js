/**
 * Main entry point for the application
 * This file imports the Express app and starts the server
 */
const app = require('./app');

// Start the server if not imported by another module
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[SERVER] Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
