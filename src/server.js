// src/server.js
// Servidor principal da Kryna Dashboard (CORRIGIDO)

require("dotenv").config();

const express   = require("express");
const session   = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const passport  = require("./auth/passport");
const helmet    = require("helmet");
const cors      = require("cors");
const path      = require("path");

const { pool, initDatabase } = require("./database/db");
const { startBot }           = require("./utils/discord");

// Rotas
const authRoutes   = require("./routes/auth");
const guildRoutes  = require("./routes/guilds");
const configRoutes = require("./routes/config");
const userRoutes   = require("./routes/user");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   PROXY (OBRIGATÓRIO NO RENDER)
========================= */
app.set("trust proxy", 1);

/* =========================
   SEGURANÇA
========================= */
app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: process.env.DASHBOARD_URL,
  credentials: true
}));

/* =========================
   BODY PARSER
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   SESSÃO (CORRIGIDO)
========================= */
app.use(session({
  store: new PgSession({
    pool,
    tableName: "session",
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,

  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,

    // 🔥 IMPORTANTE PARA DISCORD + RENDER
    secure: true,
    sameSite: "none"
  }
}));

/* =========================
   PASSPORT
========================= */
app.use(passport.initialize());
app.use(passport.session());

/* =========================
   ARQUIVOS ESTÁTICOS
========================= */
app.use(express.static(path.join(__dirname, "../public")));

/* =========================
   ROTAS API
========================= */
app.use("/auth", authRoutes);
app.use("/api/guilds", guildRoutes);
app.use("/api/guilds/:guildId/config", configRoutes);
app.use("/api/user", userRoutes);

/* =========================
   HEALTH CHECK
========================= */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    bot: "Kryna",
    timestamp: new Date().toISOString()
  });
});

/* =========================
   DEBUG AUTH
========================= */
app.get("/auth/debug", (req, res) => {
  res.json({
    authenticated: req.isAuthenticated?.() || false,
    user: req.user || null,
    session: req.session || null
  });
});

/* =========================
   🔥 PROTEÇÃO DO CALLBACK (CRÍTICO)
========================= */
app.get("/auth/discord/callback",
  passport.authenticate("discord", {
    failureRedirect: "/?erro=login_falhou"
  }),
  (req, res) => {
    // login OK → manda pro dashboard
    res.redirect(`${process.env.DASHBOARD_URL}/painel.html`);
  }
);

/* =========================
   SPA FALLBACK (CORRIGIDO)
   NÃO INTERCEPTA /auth
========================= */
app.get("*", (req, res, next) => {
  if (req.originalUrl.startsWith("/auth")) return next();
  if (req.originalUrl.startsWith("/api")) return next();

  res.sendFile(path.join(__dirname, "../public/index.html"));
});

/* =========================
   START SERVER
========================= */
async function start() {
  try {
    await initDatabase();
    await startBot();

    app.listen(PORT, () => {
      console.log(`\n╔══════════════════════════════╗`);
      console.log(`║   🌸 Kryna Dashboard OK      ║`);
      console.log(`║   PORT: ${PORT}              ║`);
      console.log(`╚══════════════════════════════╝\n`);
    });

  } catch (err) {
    console.error("[SERVER] Erro fatal:", err);
    process.exit(1);
  }
}

start();
