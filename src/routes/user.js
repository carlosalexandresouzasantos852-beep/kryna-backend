// src/routes/user.js
// Rotas pessoais do usuário logado

const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const { isAuthenticated } = require('../middlewares/auth');
const { pool } = require('../database/db');

// ════════════════════════════════════════════════════════════
//  NOTIFICAÇÕES
// ════════════════════════════════════════════════════════════

// GET /api/user/notifications
router.get('/notifications', isAuthenticated, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM user_notifications WHERE user_id = $1',
    [req.user.id]
  );
  res.json(rows[0] || {});
});

// PUT /api/user/notifications
router.put('/notifications', isAuthenticated, async (req, res) => {
  const {
    rep_reminder, marriage_received, marriage_ended,
    affinity_low, marriage_renewed, love_letter,
    level_up, giveaway_ended
  } = req.body;

  await pool.query(`
    UPDATE user_notifications SET
      rep_reminder       = $1,
      marriage_received  = $2,
      marriage_ended     = $3,
      affinity_low       = $4,
      marriage_renewed   = $5,
      love_letter        = $6,
      level_up           = $7,
      giveaway_ended     = $8
    WHERE user_id = $9
  `, [
    rep_reminder, marriage_received, marriage_ended,
    affinity_low, marriage_renewed, love_letter,
    level_up, giveaway_ended,
    req.user.id
  ]);

  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  PERSONALIZAÇÃO
// ════════════════════════════════════════════════════════════

// GET /api/user/customization
router.get('/customization', isAuthenticated, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM user_customization WHERE user_id = $1',
    [req.user.id]
  );
  res.json(rows[0] || {});
});

// PUT /api/user/customization
router.put('/customization', isAuthenticated, async (req, res) => {
  const { banner_url, accent_color, profile_layout, show_xp, show_rep, show_marriage, show_rewards } = req.body;

  await pool.query(`
    UPDATE user_customization SET
      banner_url     = $1,
      accent_color   = $2,
      profile_layout = $3,
      show_xp        = $4,
      show_rep       = $5,
      show_marriage  = $6,
      show_rewards   = $7
    WHERE user_id = $8
  `, [banner_url, accent_color, profile_layout, show_xp, show_rep, show_marriage, show_rewards, req.user.id]);

  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  API KEYS
// ════════════════════════════════════════════════════════════

// GET /api/user/api-key
router.get('/api-key', isAuthenticated, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT api_key, created_at, last_used FROM user_api_keys WHERE user_id = $1',
    [req.user.id]
  );

  if (!rows.length) {
    // Gera automaticamente na primeira vez
    const key = 'crina_sk_' + crypto.randomBytes(24).toString('hex');
    await pool.query(
      'INSERT INTO user_api_keys (user_id, api_key) VALUES ($1, $2)',
      [req.user.id, key]
    );
    return res.json({ api_key: key, created_at: new Date(), last_used: null });
  }

  res.json(rows[0]);
});

// POST /api/user/api-key/regenerate
router.post('/api-key/regenerate', isAuthenticated, async (req, res) => {
  const key = 'crina_sk_' + crypto.randomBytes(24).toString('hex');

  await pool.query(`
    INSERT INTO user_api_keys (user_id, api_key, created_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      api_key    = EXCLUDED.api_key,
      created_at = NOW(),
      last_used  = NULL
  `, [req.user.id, key]);

  res.json({ success: true, api_key: key });
});

// ════════════════════════════════════════════════════════════
//  REPUTAÇÕES
// ════════════════════════════════════════════════════════════

// GET /api/user/reputations
router.get('/reputations', isAuthenticated, async (req, res) => {
  const [received, given] = await Promise.all([
    pool.query(
      'SELECT * FROM user_reputations WHERE to_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    ),
    pool.query(
      'SELECT * FROM user_reputations WHERE from_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    )
  ]);

  res.json({
    received_count: received.rowCount,
    given_count:    given.rowCount,
    received:       received.rows,
    given:          given.rows
  });
});

// ════════════════════════════════════════════════════════════
//  PRÊMIOS PESSOAIS
// ════════════════════════════════════════════════════════════

// GET /api/user/rewards
router.get('/rewards', isAuthenticated, async (req, res) => {
  // Busca prêmios ganhos (via sorteios/servidor) — tabela simples de exemplo
  // Adapte para a sua lógica de sorteios
  res.json({ rewards: [] });
});

module.exports = router;
