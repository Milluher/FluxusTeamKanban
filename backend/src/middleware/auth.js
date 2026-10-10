const jwt = require('jsonwebtoken');

/**
 * The key every session token is signed with.
 *
 * There used to be a fallback here — `process.env.JWT_SECRET || 'fluxus_secret_key_2026'`
 * — and production had no JWT_SECRET set, so production was signing real
 * sessions with a literal string committed to a public repository. Anyone able
 * to read the repo could mint a token claiming `role: 'admin'`, because
 * `authenticate` below trusts the token's own contents and every admin gate is
 * a check on `req.user.role`.
 *
 * So there is no fallback. A missing secret stops the process instead of
 * quietly downgrading every session to a published key: the failure mode of
 * refusing to boot is a deploy that visibly does not work, which is far
 * cheaper than one that works insecurely and looks fine.
 */
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error(
    'JWT_SECRET is not set. Refusing to start: without it every session token ' +
      'would be signed with a predictable key. Set it to a long random value ' +
      '(openssl rand -base64 48) on the service and redeploy.'
  );
  process.exit(1);
}

// Short enough to guess or brute-force is no better than a published default.
if (JWT_SECRET.length < 32) {
  console.error(
    `JWT_SECRET is only ${JWT_SECRET.length} characters. Refusing to start: use at ` +
      'least 32 (openssl rand -base64 48).'
  );
  process.exit(1);
}

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
