const config = require('../config');

function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="MineRace Admin"');
    return res.status(401).send('Unauthorized');
  }
  const decoded = Buffer.from(auth.slice(6), 'base64').toString();
  const colonIdx = decoded.indexOf(':');
  const user = decoded.slice(0, colonIdx);
  const pass = decoded.slice(colonIdx + 1);
  if (user === config.ADMIN_USER && pass === config.ADMIN_PASSWORD) return next();
  res.set('WWW-Authenticate', 'Basic realm="MineRace Admin"');
  return res.status(401).send('Invalid credentials');
}

module.exports = adminAuth;
