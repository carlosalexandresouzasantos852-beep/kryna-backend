// src/server.js
// Servidor principal da Crina Dashboard

require('dotenv').config();

const express       = require('express');
const session       = require('express-session');
const PgSession     = require('connect-pg-simple')(session);
const passport      = require('./auth/passport');
const helmet        = require('helmet');
const cors          = require('cors');
const path          = require('path');

const { pool, initDatabase } = require('./database/db');
const { startBot }           = require('./utils/discord');

// Rotas
const authRoutes   = require('./routes/auth');
const guildRoutes  = require('./routes/guilds');
const configRoutes = require('./routes/config');
const userRoutes   = require('./routes/user');

// ✅ CRIA O APP PRIMEIRO (ESSENCIAL)
const app  = express();
const PORT = process.env.PORT || 3000;

// ── Segurança ────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: process.env.DASHBOARD_URL || "*",
  credentials: true
}));

// ── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Sessão com PostgreSQL ────────────────────────────────────────────────────
app.use(session({
  store: new PgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: false
  }),
  secret: process.env.SESSION_SECRET || "fallback_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 dias
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

// ── Passport ─────────────────────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());

// ── Arquivos estáticos ───────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── Rotas da API ─────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api/guilds', guildRoutes);
app.use('/api/guilds/:guildId/config', configRoutes);
app.use('/api/user', userRoutes);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    bot: 'Crina',
    timestamp: new Date().toISOString()
  });
});

// ── Fallback (SPA / painel) ──────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Inicialização ────────────────────────────────────────────────────────────
async function start() {
  try {
    await initDatabase();
    await startBot();

    app.listen(PORT, () => {
      console.log(`\n╔══════════════════════════════════════╗`);
      console.log(`║   🌸 Crina Dashboard rodando!       ║`);
      console.log(`║   URL: https://seu-app.onrender.com ║`);
      console.log(`╚══════════════════════════════════════╝\n`);
    });

  } catch (err) {
    console.error('[SERVER] Erro fatal ao iniciar:', err);
    process.exit(1);
  }
}

start();
