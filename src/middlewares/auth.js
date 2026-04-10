// src/middlewares/auth.js
// Middleware para proteger rotas e verificar permissões

// Verifica se o usuário está logado
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'Não autenticado. Faça login primeiro.' });
}

// Verifica se é uma requisição de API com API Key válida
async function isApiKeyValid(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!key) return res.status(401).json({ error: 'API key não fornecida.' });

  const { pool } = require('../database/db');
  try {
    const { rows } = await pool.query(
      `SELECT u.* FROM user_api_keys k
       JOIN users u ON u.id = k.user_id
       WHERE k.api_key = $1`,
      [key]
    );

    if (!rows.length) return res.status(401).json({ error: 'API key inválida.' });

    // Atualiza last_used
    await pool.query(
      'UPDATE user_api_keys SET last_used = NOW() WHERE api_key = $1',
      [key]
    );

    req.user = rows[0];
    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno.' });
  }
}

// Aceita tanto sessão quanto API key
function isAuthenticatedOrApiKey(req, res, next) {
  if (req.isAuthenticated()) return next();
  return isApiKeyValid(req, res, next);
}

module.exports = { isAuthenticated, isApiKeyValid, isAuthenticatedOrApiKey };
