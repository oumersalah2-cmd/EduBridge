/**
 * Middleware to protect Studio-only write endpoints using the X-Studio-Key header.
 */
function studioKeyMiddleware(req, res, next) {
  const configuredKey = process.env.STUDIO_KEY;
  const providedKey = req.header('X-Studio-Key');

  if (!configuredKey) {
    return res.status(500).json({
      error: 'Studio authentication is not configured on the server. Please verify environment settings.'
    });
  }

  if (!providedKey || providedKey !== configuredKey) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or missing X-Studio-Key header. Access to studio write operations requires a valid key.'
    });
  }

  next();
}

module.exports = studioKeyMiddleware;
