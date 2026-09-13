const jwt = require('jsonwebtoken');

/**
 * Middleware que protegeix rutes exigint una sessió d'administrador vàlida.
 * Llegeix el token JWT de la cookie httpOnly 'emp_token'.
 */
function requireAuth(req, res, next) {
  const token = req.cookies?.emp_token;

  if (!token) {
    return res.status(401).json({ error: 'Cal iniciar sessió per accedir-hi.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'La sessió no és vàlida o ha caducat.' });
  }
}

module.exports = { requireAuth };
