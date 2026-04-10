// src/auth/passport.js
// Autenticação Discord via OAuth2 com Passport.js

const passport      = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { pool }      = require('../database/db');

const SCOPES = ['identify', 'email', 'guilds'];

passport.use(new DiscordStrategy(
  {
    clientID:     process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: "https://kryna.onrender.com/auth/discord/callback", // Atualizado para o URL de callback correto
    scope:        SCOPES
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Salva ou atualiza o usuário no banco
      const { rows } = await pool.query(`
        INSERT INTO users (id, username, discriminator, avatar, email, access_token, refresh_token, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (id) DO UPDATE SET
          username      = EXCLUDED.username,
          discriminator = EXCLUDED.discriminator,
          avatar        = EXCLUDED.avatar,
          email         = EXCLUDED.email,
          access_token  = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          updated_at    = NOW()
        RETURNING *
      `, [
        profile.id,
        profile.username,
        profile.discriminator || '0',
        profile.avatar,
        profile.email,
        accessToken,
        refreshToken
      ]);

      const user = rows[0];

      // Cria as configurações de notificação padrão se for novo usuário
      await pool.query(`
        INSERT INTO user_notifications (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
      `, [user.id]);

      // Cria personalização padrão se for novo usuário
      await pool.query(`
        INSERT INTO user_customization (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
      `, [user.id]);

      return done(null, user);
    } catch (err) {
      console.error('[Passport] ERRO COMPLETO:', err);
      return done(err, null);
    }
  }
));

// Serializa apenas o ID na sessão
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Busca o usuário completo pelo ID na sessão
passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    done(null, rows[0] || null);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
