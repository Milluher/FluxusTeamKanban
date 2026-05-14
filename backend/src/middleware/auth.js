const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'fluxus_secret_key_2026';

function authenticate(req, res, next) {
  // Prefer httpOnly cookie; fall back to Authorization header for API clients
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { authenticate, JWT_SECRET };
