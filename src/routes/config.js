// src/routes/config.js
// Todas as rotas de configuração de um servidor específico

const express = require('express');
const router  = express.Router({ mergeParams: true }); // herda :guildId
const { isAuthenticated } = require('../middlewares/auth');
const { pool }   = require('../database/db');
const discord    = require('../utils/discord');

// ── Helper: verifica se o usuário tem acesso ao servidor ─────────────────────
async function checkAccess(req, res) {
  const guilds = await discord.getManageableGuilds(req.user.access_token);
  const guild  = guilds.find(g => g.id === req.params.guildId);
  if (!guild)  res.status(403).json({ error: 'Acesso negado a este servidor.' });
  return guild;
}

// ════════════════════════════════════════════════════════════
//  VISÃO GERAL
// ════════════════════════════════════════════════════════════

// GET /api/guilds/:guildId/config
router.get('/', isAuthenticated, async (req, res) => {
  const guild = await checkAccess(req, res);
  if (!guild) return;

  try {
    const [cfg, welcome, mod, xp] = await Promise.all([
      pool.query('SELECT * FROM guild_configs WHERE guild_id = $1',   [req.params.guildId]),
      pool.query('SELECT * FROM guild_welcome WHERE guild_id = $1',   [req.params.guildId]),
      pool.query('SELECT * FROM guild_moderation WHERE guild_id = $1',[req.params.guildId]),
      pool.query('SELECT * FROM guild_xp_config WHERE guild_id = $1', [req.params.guildId]),
    ]);

    res.json({
      guild,
      config:     cfg.rows[0]     || null,
      welcome:    welcome.rows[0] || null,
      moderation: mod.rows[0]     || null,
      xp:         xp.rows[0]      || null
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar configurações.' });
  }
});

// ════════════════════════════════════════════════════════════
//  PREFIXO
// ════════════════════════════════════════════════════════════

// PUT /api/guilds/:guildId/config/prefix
router.put('/prefix', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { prefix } = req.body;
  if (!prefix || prefix.length > 5)
    return res.status(400).json({ error: 'Prefixo inválido (máx. 5 caracteres).' });

  try {
    await pool.query(
      'UPDATE guild_configs SET prefix = $1, updated_at = NOW() WHERE guild_id = $2',
      [prefix, req.params.guildId]
    );
    res.json({ success: true, prefix });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar prefixo.' });
  }
});

// ════════════════════════════════════════════════════════════
//  COMANDOS PERSONALIZADOS
// ════════════════════════════════════════════════════════════

// GET /api/guilds/:guildId/config/custom-commands
router.get('/custom-commands', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { rows } = await pool.query(
    'SELECT * FROM guild_custom_commands WHERE guild_id = $1 ORDER BY id',
    [req.params.guildId]
  );
  res.json(rows);
});

// POST /api/guilds/:guildId/config/custom-commands
router.post('/custom-commands', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { trigger, response } = req.body;
  if (!trigger || !response)
    return res.status(400).json({ error: 'Trigger e resposta são obrigatórios.' });

  const { rows } = await pool.query(
    'INSERT INTO guild_custom_commands (guild_id, trigger, response) VALUES ($1,$2,$3) RETURNING *',
    [req.params.guildId, trigger, response]
  );
  res.json(rows[0]);
});

// DELETE /api/guilds/:guildId/config/custom-commands/:id
router.delete('/custom-commands/:id', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  await pool.query(
    'DELETE FROM guild_custom_commands WHERE id = $1 AND guild_id = $2',
    [req.params.id, req.params.guildId]
  );
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  CANAIS BLOQUEADOS
// ════════════════════════════════════════════════════════════

// GET /api/guilds/:guildId/config/blocked-channels
router.get('/blocked-channels', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { rows } = await pool.query(
    'SELECT * FROM guild_blocked_channels WHERE guild_id = $1',
    [req.params.guildId]
  );
  res.json(rows);
});

// POST /api/guilds/:guildId/config/blocked-channels
router.post('/blocked-channels', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { channel_id } = req.body;
  await pool.query(
    'INSERT INTO guild_blocked_channels (guild_id, channel_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    [req.params.guildId, channel_id]
  );
  res.json({ success: true });
});

// DELETE /api/guilds/:guildId/config/blocked-channels/:channelId
router.delete('/blocked-channels/:channelId', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  await pool.query(
    'DELETE FROM guild_blocked_channels WHERE guild_id = $1 AND channel_id = $2',
    [req.params.guildId, req.params.channelId]
  );
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  BOAS-VINDAS / SAÍDA
// ════════════════════════════════════════════════════════════

// GET /api/guilds/:guildId/config/welcome
router.get('/welcome', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { rows } = await pool.query(
    'SELECT * FROM guild_welcome WHERE guild_id = $1',
    [req.params.guildId]
  );
  res.json(rows[0] || {});
});

// PUT /api/guilds/:guildId/config/welcome
router.put('/welcome', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const {
    welcome_enabled, welcome_channel_id, welcome_message, welcome_delete_after,
    leave_enabled,   leave_channel_id,   leave_message,   leave_delete_after
  } = req.body;

  await pool.query(`
    UPDATE guild_welcome SET
      welcome_enabled      = $1,
      welcome_channel_id   = $2,
      welcome_message      = $3,
      welcome_delete_after = $4,
      leave_enabled        = $5,
      leave_channel_id     = $6,
      leave_message        = $7,
      leave_delete_after   = $8
    WHERE guild_id = $9
  `, [
    welcome_enabled, welcome_channel_id, welcome_message, welcome_delete_after,
    leave_enabled,   leave_channel_id,   leave_message,   leave_delete_after,
    req.params.guildId
  ]);
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  CARGO AUTOMÁTICO
// ════════════════════════════════════════════════════════════

// GET /api/guilds/:guildId/config/autorole
router.get('/autorole', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { rows } = await pool.query(
    'SELECT * FROM guild_autorole WHERE guild_id = $1',
    [req.params.guildId]
  );
  res.json(rows);
});

// POST /api/guilds/:guildId/config/autorole
router.post('/autorole', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { role_id, delay_seconds, after_message } = req.body;
  const { rows } = await pool.query(`
    INSERT INTO guild_autorole (guild_id, role_id, delay_seconds, after_message)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (guild_id, role_id) DO UPDATE SET
      delay_seconds = EXCLUDED.delay_seconds,
      after_message = EXCLUDED.after_message
    RETURNING *
  `, [req.params.guildId, role_id, delay_seconds || 0, after_message || false]);
  res.json(rows[0]);
});

// DELETE /api/guilds/:guildId/config/autorole/:roleId
router.delete('/autorole/:roleId', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  await pool.query(
    'DELETE FROM guild_autorole WHERE guild_id = $1 AND role_id = $2',
    [req.params.guildId, req.params.roleId]
  );
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  MODERAÇÃO
// ════════════════════════════════════════════════════════════

// GET /api/guilds/:guildId/config/moderation
router.get('/moderation', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { rows } = await pool.query(
    'SELECT * FROM guild_moderation WHERE guild_id = $1',
    [req.params.guildId]
  );
  res.json(rows[0] || {});
});

// PUT /api/guilds/:guildId/config/moderation
router.put('/moderation', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { block_invites, log_events, log_channel_id, punishment_channel, warn_auto_punish, warn_limit } = req.body;
  await pool.query(`
    UPDATE guild_moderation SET
      block_invites      = $1,
      log_events         = $2,
      log_channel_id     = $3,
      punishment_channel = $4,
      warn_auto_punish   = $5,
      warn_limit         = $6
    WHERE guild_id = $7
  `, [block_invites, log_events, log_channel_id, punishment_channel, warn_auto_punish, warn_limit, req.params.guildId]);
  res.json({ success: true });
});

// GET /api/guilds/:guildId/config/punishments
router.get('/punishments', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { rows } = await pool.query(
    'SELECT * FROM guild_punishments WHERE guild_id = $1 ORDER BY created_at DESC LIMIT 50',
    [req.params.guildId]
  );
  res.json(rows);
});

// POST /api/guilds/:guildId/config/punishments/ban
router.post('/punishments/ban', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { user_id, reason } = req.body;
  try {
    await discord.banUser(req.params.guildId, user_id, reason);
    await pool.query(
      'INSERT INTO guild_punishments (guild_id,user_id,mod_id,type,reason) VALUES($1,$2,$3,$4,$5)',
      [req.params.guildId, user_id, req.user.id, 'ban', reason]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/guilds/:guildId/config/punishments/unban
router.post('/punishments/unban', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { user_id } = req.body;
  try {
    await discord.unbanUser(req.params.guildId, user_id);
    await pool.query(
      'UPDATE guild_punishments SET active = FALSE WHERE guild_id=$1 AND user_id=$2 AND type=$3',
      [req.params.guildId, user_id, 'ban']
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/guilds/:guildId/config/punishments/mute
router.post('/punishments/mute', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { user_id, mute_role_id, reason } = req.body;
  try {
    await discord.muteUser(req.params.guildId, user_id, mute_role_id);
    await pool.query(
      'INSERT INTO guild_punishments (guild_id,user_id,mod_id,type,reason) VALUES($1,$2,$3,$4,$5)',
      [req.params.guildId, user_id, req.user.id, 'mute', reason]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/guilds/:guildId/config/channel/lock
router.post('/channel/lock', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { channel_id } = req.body;
  try {
    await discord.lockChannel(channel_id, req.params.guildId);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/guilds/:guildId/config/channel/unlock
router.post('/channel/unlock', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { channel_id } = req.body;
  try {
    await discord.unlockChannel(channel_id, req.params.guildId);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/guilds/:guildId/config/channel/purge
router.post('/channel/purge', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { channel_id, amount } = req.body;
  try {
    const deleted = await discord.purgeMessages(channel_id, req.params.guildId, amount);
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  EXPERIÊNCIA / XP
// ════════════════════════════════════════════════════════════

// GET /api/guilds/:guildId/config/xp
router.get('/xp', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { rows } = await pool.query(
    'SELECT * FROM guild_xp_config WHERE guild_id = $1',
    [req.params.guildId]
  );
  res.json(rows[0] || {});
});

// PUT /api/guilds/:guildId/config/xp
router.put('/xp', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { xp_enabled, xp_per_message, xp_cooldown, xp_multiplier, levelup_channel, levelup_message } = req.body;
  await pool.query(`
    UPDATE guild_xp_config SET
      xp_enabled      = $1,
      xp_per_message  = $2,
      xp_cooldown     = $3,
      xp_multiplier   = $4,
      levelup_channel = $5,
      levelup_message = $6
    WHERE guild_id = $7
  `, [xp_enabled, xp_per_message, xp_cooldown, xp_multiplier, levelup_channel, levelup_message, req.params.guildId]);
  res.json({ success: true });
});

// GET /api/guilds/:guildId/config/xp/leaderboard
router.get('/xp/leaderboard', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { rows } = await pool.query(
    'SELECT * FROM member_xp WHERE guild_id = $1 ORDER BY xp DESC LIMIT 20',
    [req.params.guildId]
  );
  res.json(rows);
});

// ════════════════════════════════════════════════════════════
//  PRÊMIOS DO SERVIDOR
// ════════════════════════════════════════════════════════════

// GET /api/guilds/:guildId/config/rewards
router.get('/rewards', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { rows } = await pool.query(
    'SELECT * FROM guild_rewards WHERE guild_id = $1 ORDER BY id',
    [req.params.guildId]
  );
  res.json(rows);
});

// POST /api/guilds/:guildId/config/rewards
router.post('/rewards', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { name, cost, description } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO guild_rewards (guild_id, name, cost, description) VALUES($1,$2,$3,$4) RETURNING *',
    [req.params.guildId, name, cost, description]
  );
  res.json(rows[0]);
});

// DELETE /api/guilds/:guildId/config/rewards/:id
router.delete('/rewards/:id', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  await pool.query(
    'DELETE FROM guild_rewards WHERE id = $1 AND guild_id = $2',
    [req.params.id, req.params.guildId]
  );
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  CONTADOR DE MEMBROS
// ════════════════════════════════════════════════════════════

// GET /api/guilds/:guildId/config/counters
router.get('/counters', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { rows } = await pool.query(
    'SELECT * FROM guild_member_counters WHERE guild_id = $1',
    [req.params.guildId]
  );
  res.json(rows);
});

// POST /api/guilds/:guildId/config/counters
router.post('/counters', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  const { channel_id, channel_type, template } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO guild_member_counters (guild_id, channel_id, channel_type, template) VALUES($1,$2,$3,$4) RETURNING *',
    [req.params.guildId, channel_id, channel_type, template]
  );
  res.json(rows[0]);
});

// DELETE /api/guilds/:guildId/config/counters/:id
router.delete('/counters/:id', isAuthenticated, async (req, res) => {
  if (!await checkAccess(req, res)) return;
  await pool.query(
    'DELETE FROM guild_member_counters WHERE id = $1 AND guild_id = $2',
    [req.params.id, req.params.guildId]
  );
  res.json({ success: true });
});

module.exports = router;
