// src/server.js
// Servidor principal da Crina Dashboard

require('dotenv').config();

const express       = require('express');
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

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

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Segurança ────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false // desativa para facilitar o carregamento do painel HTML
}));

app.use(cors({
  origin:      process.env.DASHBOARD_URL,
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
  secret:            process.env.SESSION_SECRET,
  resave:            false,
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

// ── Arquivos estáticos (seus HTML/CSS) ───────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── Rotas da API ─────────────────────────────────────────────────────────────
app.use('/auth',                    authRoutes);
app.use('/api/guilds',              guildRoutes);
app.use('/api/guilds/:guildId/config', configRoutes);
app.use('/api/user',                userRoutes);

// ── Health check (Discloud usa isso para saber se está online) ───────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', bot: 'Crina', timestamp: new Date().toISOString() });
});

// ── Rota fallback → serve o painel HTML ──────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Inicia banco, bot e servidor ─────────────────────────────────────────────
async function start() {
  try {
    await initDatabase();
    await startBot();

    app.listen(PORT, () => {
      console.log(`\n╔══════════════════════════════════════╗`);
      console.log(`║   🌸 Crina Dashboard rodando!         ║`);
      console.log(`║   URL: http://localhost:${PORT}          ║`);
      console.log(`╚══════════════════════════════════════╝\n`);
    });
  } catch (err) {
    console.error('[SERVER] Erro fatal ao iniciar:', err.message);
    process.exit(1);
  }
}

start();
