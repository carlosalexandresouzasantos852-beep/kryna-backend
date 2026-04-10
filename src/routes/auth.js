// src/routes/auth.js
// Rotas de login, callback e logout via Discord OAuth2

const express  = require('express');
const passport = require('../auth/passport');
const router   = express.Router();

// Redireciona para o Discord para autenticação
router.get('/discord', passport.authenticate('discord'));

// Callback após o usuário autorizar no Discord
router.get('/discord/callback',
  passport.authenticate('discord', {
    failureRedirect: `${process.env.DASHBOARD_URL}/?erro=login_falhou`
  }),
  (req, res) => {
    // Login bem-sucedido → redireciona para o painel
    res.redirect(`${process.env.DASHBOARD_URL}/painel.html`);
  }
);

// Retorna os dados do usuário logado (usado pelo frontend)
router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ authenticated: false });
  }

  const u = req.user;
  res.json({
    authenticated: true,
    user: {
      id:            u.id,
      username:      u.username,
      discriminator: u.discriminator,
      avatar: u.avatar
        ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/0.png`,
      email: u.email
    }
  });
});

// Logout
router.post('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });
});

module.exports = router;
