// src/routes/guilds.js
// Gerencia a listagem de servidores e criação de config inicial

const express = require('express');
const router  = express.Router();
const { isAuthenticated } = require('../middlewares/auth');
const { getManageableGuilds, getGuildChannels, getGuildRoles } = require('../utils/discord');
const { pool } = require('../database/db');

// GET /api/guilds
// Lista todos os servidores onde o usuário é dono/admin
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const guilds = await getManageableGuilds(req.user.access_token);

    const total       = guilds.length;
    const withBot     = guilds.filter(g => g.hasBot).length;
    const withoutBot  = total - withBot;

    res.json({
      total,
      configurable: withBot,
      withoutBot,
      guilds
    });
  } catch (err) {
    console.error('[/api/guilds]', err.message);
    res.status(500).json({ error: 'Erro ao buscar servidores.' });
  }
});

// GET /api/guilds/:guildId/channels
// Retorna os canais de um servidor
router.get('/:guildId/channels', isAuthenticated, async (req, res) => {
  try {
    const channels = await getGuildChannels(req.params.guildId);
    res.json(channels);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar canais.' });
  }
});

// GET /api/guilds/:guildId/roles
// Retorna os cargos de um servidor
router.get('/:guildId/roles', isAuthenticated, async (req, res) => {
  try {
    const roles = await getGuildRoles(req.params.guildId);
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar cargos.' });
  }
});

// POST /api/guilds/:guildId/init
// Cria a config inicial do servidor no banco (chamado ao abrir o painel)
router.post('/:guildId/init', isAuthenticated, async (req, res) => {
  const { guildId } = req.params;
  const { name, icon } = req.body;

  try {
    await pool.query(`
      INSERT INTO guild_configs (guild_id, guild_name, guild_icon)
      VALUES ($1, $2, $3)
      ON CONFLICT (guild_id) DO UPDATE SET
        guild_name = EXCLUDED.guild_name,
        guild_icon = EXCLUDED.guild_icon,
        updated_at = NOW()
    `, [guildId, name, icon]);

    // Garante que as sub-tabelas existam
    await pool.query(`
      INSERT INTO guild_welcome (guild_id) VALUES ($1) ON CONFLICT DO NOTHING
    `, [guildId]);
    await pool.query(`
      INSERT INTO guild_moderation (guild_id) VALUES ($1) ON CONFLICT DO NOTHING
    `, [guildId]);
    await pool.query(`
      INSERT INTO guild_xp_config (guild_id) VALUES ($1) ON CONFLICT DO NOTHING
    `, [guildId]);

    res.json({ success: true });
  } catch (err) {
    console.error('[/api/guilds/:id/init]', err.message);
    res.status(500).json({ error: 'Erro ao inicializar servidor.' });
  }
});

module.exports = router;
