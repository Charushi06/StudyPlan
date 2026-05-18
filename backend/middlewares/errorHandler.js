const path = require('path');

const page404Path = path.join(__dirname, '../../404.html');
const page500Path = path.join(__dirname, '../../error.html');

const notFoundApiHandler = (req, res) => {
  return res.status(404).json({ error: 'API route not found' });
};

const notFoundHandler = (req, res, next) => {
  if (req.method !== 'GET') return next();
  return res.status(404).sendFile(page404Path);
};

const errorHandler = (err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (res.headersSent) return next(err);
  if (req.path.startsWith('/api')) {
    return res.status(500).json({ error: 'Internal server error' });
  }
  return res.status(500).sendFile(page500Path);
};

module.exports = { notFoundApiHandler, notFoundHandler, errorHandler };