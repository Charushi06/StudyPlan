const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET || 'study-plan-secret-key-123456';

function generateToken(user) {
  const payload = JSON.stringify({ id: user.id, email: user.email });
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + signature;
}

function verifyToken(token) {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;
    const payload = Buffer.from(payloadB64, 'base64').toString('utf8');
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
    if (signature === expectedSignature) {
      return JSON.parse(payload);
    }
  } catch (e) {}
  return null;
}

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.headers['x-auth-token'];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. Please login.' });
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token. Please login again.' });
  }
  
  req.user = decoded;
  next();
}

module.exports = {
  authenticate,
  verifyToken,
  generateToken,
  JWT_SECRET
};
