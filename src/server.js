// src/server.js
// Servidor principal da Crina Dashboard (CORRIGIDO)

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
   🔥 PROXY (RENDER OBRIGATÓRIO)
========================= */
app.set("trust proxy", 1);

/* =========================
   🔐 SEGURANÇA
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
   🔑 SESSÃO (CRÍTICO PARA DISCORD OAUTH)
========================= */
app.use(session({
  store: new PgSession({
    pool,
    tableName: "session",
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || "fallback_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,

    // 🔥 ESSENCIAL PARA DISCORD + RENDER
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
   ROTAS
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
    bot: "Crina",
    timestamp: new Date().toISOString()
  });
});

/* =========================
   CALLBACK DEBUG (OPCIONAL MAS MUITO ÚTIL)
========================= */
app.get("/auth/debug", (req, res) => {
  res.json({
    message: "Auth system running",
    session: req.session || null,
    user: req.user || null
  });
});

/* =========================
   FALLBACK (SPA)
========================= */
app.get("*", (req, res) => {
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
      console.log(`\n╔══════════════════════════════════════╗`);
      console.log(`║   🌸 Kryna Dashboard rodando!       ║`);
      console.log(`║   PORTA: ${PORT}                   ║`);
      console.log(`╚══════════════════════════════════════╝\n`);
    });

  } catch (err) {
    console.error("[SERVER] Erro fatal ao iniciar:", err);
    process.exit(1);
  }
}

start();
