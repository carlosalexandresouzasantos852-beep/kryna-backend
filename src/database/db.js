// src/database/db.js
// Conexão com PostgreSQL e criação automática das tabelas

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

// ── Testa a conexão ──────────────────────────────────────────────────────────
pool.connect((err, client, release) => {
  if (err) {
    console.error('[DB] Erro ao conectar no PostgreSQL:', err.message);
    return;
  }
  release();
  console.log('[DB] PostgreSQL conectado com sucesso!');
});

// ── Cria as tabelas se não existirem ─────────────────────────────────────────
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Sessões do Express (gerenciadas pelo connect-pg-simple)
      CREATE TABLE IF NOT EXISTS "session" (
        "sid"    varchar NOT NULL COLLATE "default",
        "sess"   json    NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

      -- Usuários autenticados via Discord OAuth2
      CREATE TABLE IF NOT EXISTS users (
        id            VARCHAR(20)  PRIMARY KEY,   -- Discord user ID
        username      VARCHAR(100) NOT NULL,
        discriminator VARCHAR(4),
        avatar        VARCHAR(200),
        email         VARCHAR(200),
        access_token  TEXT,
        refresh_token TEXT,
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW()
      );

      -- Configurações gerais por servidor
      CREATE TABLE IF NOT EXISTS guild_configs (
        guild_id      VARCHAR(20) PRIMARY KEY,
        guild_name    VARCHAR(100),
        guild_icon    VARCHAR(200),
        prefix        VARCHAR(10)  DEFAULT '!',
        language      VARCHAR(10)  DEFAULT 'pt-BR',
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW()
      );

      -- Configurações de entrada/saída de membros
      CREATE TABLE IF NOT EXISTS guild_welcome (
        guild_id              VARCHAR(20) PRIMARY KEY REFERENCES guild_configs(guild_id) ON DELETE CASCADE,
        welcome_enabled       BOOLEAN DEFAULT FALSE,
        welcome_channel_id    VARCHAR(20),
        welcome_message       TEXT DEFAULT 'Bem-vindo(a) ao servidor, {user}! 🎉',
        welcome_delete_after  INTEGER DEFAULT 0,
        leave_enabled         BOOLEAN DEFAULT FALSE,
        leave_channel_id      VARCHAR(20),
        leave_message         TEXT DEFAULT '{user} saiu do servidor. 😢',
        leave_delete_after    INTEGER DEFAULT 0
      );

      -- Cargo automático ao entrar
      CREATE TABLE IF NOT EXISTS guild_autorole (
        id            SERIAL PRIMARY KEY,
        guild_id      VARCHAR(20) REFERENCES guild_configs(guild_id) ON DELETE CASCADE,
        role_id       VARCHAR(20) NOT NULL,
        delay_seconds INTEGER DEFAULT 0,
        after_message BOOLEAN DEFAULT FALSE,
        UNIQUE(guild_id, role_id)
      );

      -- Comandos personalizados por prefixo
      CREATE TABLE IF NOT EXISTS guild_custom_commands (
        id          SERIAL PRIMARY KEY,
        guild_id    VARCHAR(20) REFERENCES guild_configs(guild_id) ON DELETE CASCADE,
        trigger     VARCHAR(100) NOT NULL,
        response    TEXT NOT NULL,
        created_at  TIMESTAMP DEFAULT NOW()
      );

      -- Canais bloqueados para comandos
      CREATE TABLE IF NOT EXISTS guild_blocked_channels (
        id          SERIAL PRIMARY KEY,
        guild_id    VARCHAR(20) REFERENCES guild_configs(guild_id) ON DELETE CASCADE,
        channel_id  VARCHAR(20) NOT NULL,
        UNIQUE(guild_id, channel_id)
      );

      -- Configurações de moderação
      CREATE TABLE IF NOT EXISTS guild_moderation (
        guild_id            VARCHAR(20) PRIMARY KEY REFERENCES guild_configs(guild_id) ON DELETE CASCADE,
        block_invites       BOOLEAN DEFAULT FALSE,
        log_events          BOOLEAN DEFAULT FALSE,
        log_channel_id      VARCHAR(20),
        punishment_channel  VARCHAR(20),
        warn_auto_punish    BOOLEAN DEFAULT FALSE,
        warn_limit          INTEGER DEFAULT 3
      );

      -- Sistema de experiência/XP
      CREATE TABLE IF NOT EXISTS guild_xp_config (
        guild_id          VARCHAR(20) PRIMARY KEY REFERENCES guild_configs(guild_id) ON DELETE CASCADE,
        xp_enabled        BOOLEAN DEFAULT FALSE,
        xp_per_message    INTEGER DEFAULT 15,
        xp_cooldown       INTEGER DEFAULT 60,
        xp_multiplier     NUMERIC(3,1) DEFAULT 1.0,
        levelup_channel   VARCHAR(20),
        levelup_message   TEXT DEFAULT 'Parabéns {user}, você subiu para o nível {level}! 🎉'
      );

      -- XP dos membros por servidor
      CREATE TABLE IF NOT EXISTS member_xp (
        id          SERIAL PRIMARY KEY,
        guild_id    VARCHAR(20) NOT NULL,
        user_id     VARCHAR(20) NOT NULL,
        xp          INTEGER DEFAULT 0,
        level       INTEGER DEFAULT 0,
        last_msg    TIMESTAMP,
        UNIQUE(guild_id, user_id)
      );

      -- Prêmios por servidor
      CREATE TABLE IF NOT EXISTS guild_rewards (
        id          SERIAL PRIMARY KEY,
        guild_id    VARCHAR(20) REFERENCES guild_configs(guild_id) ON DELETE CASCADE,
        name        VARCHAR(200) NOT NULL,
        cost        INTEGER DEFAULT 0,
        description TEXT,
        created_at  TIMESTAMP DEFAULT NOW()
      );

      -- Notificações por usuário
      CREATE TABLE IF NOT EXISTS user_notifications (
        user_id                   VARCHAR(20) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        rep_reminder              BOOLEAN DEFAULT TRUE,
        marriage_received         BOOLEAN DEFAULT TRUE,
        marriage_ended            BOOLEAN DEFAULT TRUE,
        affinity_low              BOOLEAN DEFAULT FALSE,
        marriage_renewed          BOOLEAN DEFAULT TRUE,
        love_letter               BOOLEAN DEFAULT TRUE,
        level_up                  BOOLEAN DEFAULT TRUE,
        giveaway_ended            BOOLEAN DEFAULT FALSE
      );

      -- Reputações entre usuários
      CREATE TABLE IF NOT EXISTS user_reputations (
        id          SERIAL PRIMARY KEY,
        from_id     VARCHAR(20) NOT NULL,
        to_id       VARCHAR(20) NOT NULL,
        guild_id    VARCHAR(20),
        created_at  TIMESTAMP DEFAULT NOW(),
        UNIQUE(from_id, to_id, guild_id)
      );

      -- Punições (ban, mute, warn, kick)
      CREATE TABLE IF NOT EXISTS guild_punishments (
        id          SERIAL PRIMARY KEY,
        guild_id    VARCHAR(20) NOT NULL,
        user_id     VARCHAR(20) NOT NULL,
        mod_id      VARCHAR(20) NOT NULL,
        type        VARCHAR(20) NOT NULL,   -- ban | mute | warn | kick | castigo
        reason      TEXT,
        expires_at  TIMESTAMP,
        active      BOOLEAN DEFAULT TRUE,
        created_at  TIMESTAMP DEFAULT NOW()
      );

      -- Contador de membros (canais de voz/texto com contagem)
      CREATE TABLE IF NOT EXISTS guild_member_counters (
        id              SERIAL PRIMARY KEY,
        guild_id        VARCHAR(20) REFERENCES guild_configs(guild_id) ON DELETE CASCADE,
        channel_id      VARCHAR(20) NOT NULL,
        channel_type    VARCHAR(20) DEFAULT 'total',  -- total | online | bots
        template        VARCHAR(100) DEFAULT 'Membros: {count}'
      );

      -- Personalização do painel do usuário
      CREATE TABLE IF NOT EXISTS user_customization (
        user_id         VARCHAR(20) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        banner_url      TEXT,
        accent_color    VARCHAR(7) DEFAULT '#c084fc',
        profile_layout  VARCHAR(30) DEFAULT 'default',
        show_xp         BOOLEAN DEFAULT TRUE,
        show_rep        BOOLEAN DEFAULT TRUE,
        show_marriage   BOOLEAN DEFAULT TRUE,
        show_rewards    BOOLEAN DEFAULT FALSE
      );

      -- API keys dos usuários
      CREATE TABLE IF NOT EXISTS user_api_keys (
        user_id     VARCHAR(20) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        api_key     VARCHAR(64) UNIQUE NOT NULL,
        created_at  TIMESTAMP DEFAULT NOW(),
        last_used   TIMESTAMP
      );
    `);

    console.log('[DB] Tabelas verificadas/criadas com sucesso!');
  } catch (err) {
    console.error('[DB] Erro ao criar tabelas:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };
