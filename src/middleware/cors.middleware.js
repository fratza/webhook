/**
 * Enhanced CORS middleware to ensure CORS headers are set on all responses
 * This middleware uses both the standard header method and the setHeader method
 * to maximize compatibility across different hosting environments
 */
function corsMiddleware(req, res, next) {
  // Store the original end method to intercept it
  const originalEnd = res.end;
  
  // Set CORS headers using standard method
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours in seconds
  
  // Also set headers using setHeader method for maximum compatibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Override the end method to ensure CORS headers are set
  res.end = function() {
    // Set CORS headers again right before sending the response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Log the final headers for debugging
    console.log('[CORS] Final headers for', req.method, req.url, {  
      'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin'),
      'access-control-allow-methods': res.getHeader('Access-Control-Allow-Methods'),
      'access-control-allow-headers': res.getHeader('Access-Control-Allow-Headers')
    });
    
    // Call the original end method
    return originalEnd.apply(this, arguments);
  };
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    console.log('[CORS] Handling OPTIONS preflight request for', req.url);
    return res.status(200).end();
  }
  
  // Log initial CORS headers for debugging
  console.log('[CORS] Initial headers set for', req.method, req.url);
  
  next();
}

module.exports = corsMiddleware;
