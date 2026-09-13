require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const cursosRoutes = require('./routes/cursos.routes');
const matriculesRoutes = require('./routes/matricules.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Orígens permesos per CORS (el frontend estàtic servit per nginx)
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:8080').split(',');

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true, // necessari perquè el navegador enviï la cookie de sessió
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Rutes públiques
app.use('/api/cursos', cursosRoutes);
app.use('/api/matricules', matriculesRoutes);

// Autenticació i panell d'administració
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no trobada.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error intern del servidor.' });
});

app.listen(PORT, () => {
  console.log(`🎵 API de l'EMP escoltant al port ${PORT}`);
});
