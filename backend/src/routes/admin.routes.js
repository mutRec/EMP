const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Totes les rutes d'aquest fitxer requereixen sessió d'administrador
router.use(requireAuth);

/* ------------------------------------------------------------------ */
/* MATRÍCULES                                                          */
/* ------------------------------------------------------------------ */

// Llistat de matrícules amb filtres opcionals (estat, curs_id, cerca per nom/email)
router.get('/matricules', async (req, res) => {
  const { estat, curs_id, q } = req.query;
  const conditions = [];
  const params = [];

  if (estat) {
    params.push(estat);
    conditions.push(`m.estat = $${params.length}`);
  }
  if (curs_id) {
    params.push(curs_id);
    conditions.push(`m.curs_id = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(a.nom_complet ILIKE $${params.length} OR a.email ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await db.query(
      `SELECT
         m.id AS matricula_id, a.nom_complet, a.email, a.telefon, a.data_naixement,
         c.id AS curs_id, c.nom AS curs_nom, c.nivell, c.preu,
         m.curs_academic, m.data_matricula, m.estat, m.comentaris
       FROM matricules m
       JOIN alumnes a ON m.alumne_id = a.id
       JOIN cursos c ON m.curs_id = c.id
       ${where}
       ORDER BY m.data_matricula DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obtenint les matrícules.' });
  }
});

// Canviar l'estat d'una matrícula (pendent / confirmada / cancel·lada),
// ajustant les places disponibles del curs de manera coherent.
router.patch('/matricules/:id/estat', async (req, res) => {
  const { id } = req.params;
  const { estat } = req.body;
  const estatsValids = ['pendent', 'confirmada', 'cancel·lada'];

  if (!estatsValids.includes(estat)) {
    return res.status(400).json({ error: 'Estat no vàlid.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const matRes = await client.query('SELECT * FROM matricules WHERE id = $1 FOR UPDATE', [id]);
    if (matRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Matrícula no trobada.' });
    }
    const matricula = matRes.rows[0];
    const eraCancelada = matricula.estat === 'cancel·lada';
    const esCancelada = estat === 'cancel·lada';

    if (!eraCancelada && esCancelada) {
      // Alliberem una plaça en cancel·lar
      await client.query(
        'UPDATE cursos SET places_disponibles = places_disponibles + 1 WHERE id = $1',
        [matricula.curs_id]
      );
    } else if (eraCancelada && !esCancelada) {
      // Reactivem una matrícula: cal que quedi almenys una plaça
      const cursRes = await client.query(
        'SELECT places_disponibles FROM cursos WHERE id = $1 FOR UPDATE',
        [matricula.curs_id]
      );
      if (cursRes.rows[0].places_disponibles <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No es pot reactivar: ja no queden places en aquest curs.' });
      }
      await client.query(
        'UPDATE cursos SET places_disponibles = places_disponibles - 1 WHERE id = $1',
        [matricula.curs_id]
      );
    }

    await client.query('UPDATE matricules SET estat = $1 WHERE id = $2', [estat, id]);
    await client.query('COMMIT');
    res.json({ message: "Estat de la matrícula actualitzat." });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: "Error actualitzant l'estat de la matrícula." });
  } finally {
    client.release();
  }
});

// Eliminar una matrícula (allibera la plaça si no estava ja cancel·lada)
router.delete('/matricules/:id', async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const matRes = await client.query('SELECT * FROM matricules WHERE id = $1 FOR UPDATE', [id]);
    if (matRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Matrícula no trobada.' });
    }
    const matricula = matRes.rows[0];

    if (matricula.estat !== 'cancel·lada') {
      await client.query(
        'UPDATE cursos SET places_disponibles = places_disponibles + 1 WHERE id = $1',
        [matricula.curs_id]
      );
    }

    await client.query('DELETE FROM matricules WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ message: 'Matrícula eliminada correctament.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error eliminant la matrícula.' });
  } finally {
    client.release();
  }
});

/* ------------------------------------------------------------------ */
/* ESTADÍSTIQUES                                                       */
/* ------------------------------------------------------------------ */

router.get('/stats', async (req, res) => {
  try {
    const totals = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE estat = 'pendent') AS pendents,
        COUNT(*) FILTER (WHERE estat = 'confirmada') AS confirmades,
        COUNT(*) FILTER (WHERE estat = 'cancel·lada') AS cancelades,
        COUNT(*) AS total
      FROM matricules
    `);
    const ingressos = await db.query(`
      SELECT COALESCE(SUM(c.preu), 0) AS ingressos_estimats
      FROM matricules m
      JOIN cursos c ON m.curs_id = c.id
      WHERE m.estat IN ('pendent', 'confirmada')
    `);
    const places = await db.query(`
      SELECT COALESCE(SUM(places_totals), 0) AS places_totals,
             COALESCE(SUM(places_disponibles), 0) AS places_disponibles
      FROM cursos
      WHERE actiu = true
    `);

    res.json({
      ...totals.rows[0],
      ingressos_estimats: ingressos.rows[0].ingressos_estimats,
      ...places.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obtenint les estadístiques." });
  }
});

/* ------------------------------------------------------------------ */
/* GESTIÓ DE CURSOS                                                     */
/* ------------------------------------------------------------------ */

// Llistat complet (inclou inactius i sense places, a diferència de l'endpoint públic)
router.get('/cursos', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM cursos ORDER BY nivell, nom');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obtenint els cursos.' });
  }
});

router.post('/cursos', async (req, res) => {
  const { nom, nivell, descripcio, preu, edat_min, edat_max, horari, places_totals } = req.body;

  if (!nom || !nivell || preu === undefined || !places_totals) {
    return res.status(400).json({ error: 'Falten camps obligatoris (nom, nivell, preu, places totals).' });
  }

  try {
    const result = await db.query(
      `INSERT INTO cursos (nom, nivell, descripcio, preu, edat_min, edat_max, horari, places_totals, places_disponibles)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING *`,
      [nom, nivell, descripcio || null, preu, edat_min || null, edat_max || null, horari || null, places_totals]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creant el curs.' });
  }
});

router.put('/cursos/:id', async (req, res) => {
  const { id } = req.params;
  const { nom, nivell, descripcio, preu, edat_min, edat_max, horari, places_totals, actiu } = req.body;

  try {
    const cursActualRes = await db.query('SELECT * FROM cursos WHERE id = $1', [id]);
    if (cursActualRes.rows.length === 0) {
      return res.status(404).json({ error: 'Curs no trobat.' });
    }
    const actual = cursActualRes.rows[0];

    // Recalculem les places disponibles mantenint el nombre d'alumnes ja matriculats
    const matriculats = actual.places_totals - actual.places_disponibles;
    const novesTotals = places_totals !== undefined ? places_totals : actual.places_totals;
    const novesDisponibles = Math.max(novesTotals - matriculats, 0);

    const result = await db.query(
      `UPDATE cursos SET
         nom = COALESCE($1, nom),
         nivell = COALESCE($2, nivell),
         descripcio = $3,
         preu = COALESCE($4, preu),
         edat_min = $5,
         edat_max = $6,
         horari = $7,
         places_totals = $8,
         places_disponibles = $9,
         actiu = COALESCE($10, actiu)
       WHERE id = $11
       RETURNING *`,
      [nom, nivell, descripcio, preu, edat_min, edat_max, horari, novesTotals, novesDisponibles, actiu, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error actualitzant el curs.' });
  }
});

router.delete('/cursos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM cursos WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Curs no trobat.' });
    }
    res.json({ message: 'Curs eliminat correctament.' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({
        error: "No es pot eliminar: hi ha matrícules associades a aquest curs. Desactiva'l en lloc d'eliminar-lo.",
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Error eliminant el curs.' });
  }
});

module.exports = router;
