const express = require('express');
const db = require('../database');

const router = express.Router();

const STATUS_LABELS = {
  angenommen: 'Angenommen',
  in_bearbeitung: 'In Bearbeitung',
  wartet_auf_teile: 'Wartet auf Ersatzteile',
  fertig: 'Fertig zum Abholen',
  abgeholt: 'Abgeholt',
};

router.get('/:token', (req, res) => {
  const vehicle = db.prepare(`
    SELECT fahrzeug, status, abhol_datum, fertig_datum, updated_at
    FROM vehicles WHERE token = ?
  `).get(req.params.token);

  if (!vehicle) {
    return res.status(404).json({ error: 'Kein Auftrag gefunden' });
  }

  res.json({
    fahrzeug: vehicle.fahrzeug,
    status: vehicle.status,
    statusLabel: STATUS_LABELS[vehicle.status] || vehicle.status,
    abhol_datum: vehicle.abhol_datum,
    fertig_datum: vehicle.fertig_datum,
    aktualisiert: vehicle.updated_at,
    werkstatt: process.env.WERKSTATT_NAME || 'Ihre Werkstatt',
  });
});

module.exports = router;
