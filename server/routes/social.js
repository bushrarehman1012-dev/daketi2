const express = require('express');
const { friendships, games, searchUsers, users } = require('../db');
const { authMiddleware } = require('./auth');

const router = express.Router();

// ── Friends ───────────────────────────────────────────────────────────────────

// GET /api/friends — get friend list + pending requests
router.get('/', authMiddleware, (req, res) => {
  res.json(friendships.getForUser(req.userId));
});

// POST /api/friends/request — send friend request
router.post('/request', authMiddleware, (req, res) => {
  const { targetUserId } = req.body;
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });
  if (targetUserId === req.userId) return res.status(400).json({ error: 'Cannot friend yourself' });
  const target = users.findById(targetUserId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  const f = friendships.send(req.userId, targetUserId);
  res.json(f);
});

// POST /api/friends/:id/respond — accept or decline
router.post('/:id/respond', authMiddleware, (req, res) => {
  const { accept } = req.body;
  const f = friendships.respond(req.params.id, req.userId, !!accept);
  if (!f) return res.status(404).json({ error: 'Friendship not found' });
  res.json(f);
});

// DELETE /api/friends/:userId — remove friend
router.delete('/:userId', authMiddleware, (req, res) => {
  friendships.remove(req.userId, req.params.userId);
  res.json({ ok: true });
});

// GET /api/friends/search?q= — search users by name
router.get('/search', authMiddleware, (req, res) => {
  const results = searchUsers(req.query.q, req.userId);
  res.json(results);
});

// ── Game history ──────────────────────────────────────────────────────────────

// GET /api/history — get completed games for the logged-in user
router.get('/history', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
  res.json(games.getHistory(req.userId, limit));
});

module.exports = router;
