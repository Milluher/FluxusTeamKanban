const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'fluxus_secret_key_2026';

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { authenticate, JWT_SECRET };
