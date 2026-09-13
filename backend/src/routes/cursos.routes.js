const express = require('express');
const db = require('../db');

const router = express.Router();

const ORDRE_NIVELLS = `
  CASE nivell
    WHEN 'sensibilitzacio' THEN 1
    WHEN 'iniciacio' THEN 2
    WHEN 'elemental' THEN 3
    WHEN 'professional' THEN 4
    WHEN 'adults' THEN 5
    ELSE 6
  END
`;

// Llistat públic de cursos actius amb places disponibles (per al formulari de matrícula)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, nom, nivell, descripcio, preu, edat_min, edat_max, horari,
             places_totals, places_disponibles
      FROM cursos
      WHERE actiu = true
      ORDER BY ${ORDRE_NIVELLS}, nom
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obtenint els cursos.' });
  }
});

module.exports = router;
