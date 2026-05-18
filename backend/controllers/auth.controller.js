const users = {}; // Simple in-memory user store

const signup = (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (users[email]) {
    return res.status(400).json({ error: 'User already exists' });
  }
  users[email] = { email, password };
  res.json({ success: true, message: 'Account created successfully' });
};

const login = (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const user = users[email];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({ success: true, email: user.email });
};

module.exports = {
  signup,
  login
};