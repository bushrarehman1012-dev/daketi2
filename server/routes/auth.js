const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { users } = require('../db');

const router = express.Router();
const JWT_SECRET  = process.env.JWT_SECRET || 'daketi-default-secret-change-in-prod';
const JWT_EXPIRES = '30d';

function makeToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, displayName, email, password } = req.body;

    if (!username?.trim() || !password)
      return res.status(400).json({ error: 'Username and password are required' });
    if (username.trim().length < 3)
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    if (users.findByUsername(username))
      return res.status(409).json({ error: 'Username already taken' });
    if (email?.trim() && users.findByEmail(email))
      return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = users.create({
      username: username.trim(),
      displayName: (displayName || username).trim(),
      email: email?.trim() || null,
      passwordHash,
    });

    res.json({ token: makeToken(user.id), user: users.public(user) });
  } catch (e) {
    console.error('register error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password are required' });

    const user = users.findByUsername(username);
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid username or password' });

    users.touch(user.id);
    res.json({ token: makeToken(user.id), user: users.public(user) });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me — verify token + refresh user info
router.get('/me', authMiddleware, (req, res) => {
  const user = users.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  users.touch(req.userId);
  res.json({ user: users.public(user) });
});

module.exports = { router, authMiddleware, JWT_SECRET };
