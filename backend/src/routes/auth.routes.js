const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Limitem els intents d'inici de sessió per mitigar atacs de força bruta
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuts
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Massa intents d'inici de sessió. Torna-ho a provar més tard." },
});

const COOKIE_NAME = 'emp_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 8 * 60 * 60 * 1000, // 8 hores
};

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Cal indicar l'usuari i la contrasenya." });
  }

  try {
    const result = await db.query('SELECT * FROM admins WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuari o contrasenya incorrectes.' });
    }

    const admin = result.rows[0];
    const passwordOk = await bcrypt.compare(password, admin.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Usuari o contrasenya incorrectes.' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    res.json({ username: admin.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error iniciant sessió." });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTIONS, maxAge: undefined });
  res.json({ message: 'Sessió tancada correctament.' });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.admin.username });
});

module.exports = router;
