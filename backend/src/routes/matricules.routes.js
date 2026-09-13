const express = require('express');
const db = require('../db');

const router = express.Router();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Processar una nova sol·licitud de matrícula des del formulari públic
router.post('/', async (req, res) => {
  const { nom_complet, email, telefon, data_naixement, curs_id, comentaris } = req.body;

  if (!nom_complet || !email || !telefon || !data_naixement || !curs_id) {
    return res.status(400).json({ error: 'Cal omplir tots els camps obligatoris.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'El correu electrònic no és vàlid.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Bloquegem la fila del curs per evitar condicions de carrera amb les places
    const cursRes = await client.query(
      'SELECT id, places_disponibles, actiu FROM cursos WHERE id = $1 FOR UPDATE',
      [curs_id]
    );
    if (cursRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'El curs seleccionat no existeix.' });
    }
    const curs = cursRes.rows[0];
    if (!curs.actiu || curs.places_disponibles <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ja no queden places disponibles en aquest curs.' });
    }

    // Busquem si l'alumne ja existeix per email; si no, el creem
    let alumneRes = await client.query('SELECT id FROM alumnes WHERE email = $1', [email]);
    let alumne_id;

    if (alumneRes.rows.length > 0) {
      alumne_id = alumneRes.rows[0].id;
      await client.query(
        'UPDATE alumnes SET nom_complet = $1, telefon = $2, data_naixement = $3 WHERE id = $4',
        [nom_complet, telefon, data_naixement, alumne_id]
      );
    } else {
      const nouAlumne = await client.query(
        'INSERT INTO alumnes (nom_complet, email, telefon, data_naixement) VALUES ($1, $2, $3, $4) RETURNING id',
        [nom_complet, email, telefon, data_naixement]
      );
      alumne_id = nouAlumne.rows[0].id;
    }

    await client.query(
      'INSERT INTO matricules (alumne_id, curs_id, comentaris, estat) VALUES ($1, $2, $3, $4)',
      [alumne_id, curs_id, comentaris || null, 'pendent']
    );

    await client.query(
      'UPDATE cursos SET places_disponibles = places_disponibles - 1 WHERE id = $1',
      [curs_id]
    );

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Matrícula enviada correctament! Rebràs la confirmació per correu en els propers dies.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ja hi ha una matrícula d\'aquest alumne en aquest curs.' });
    }
    res.status(500).json({ error: 'Error processant la matrícula.' });
  } finally {
    client.release();
  }
});

module.exports = router;
