const express = require('express');
const router = express.Router();

// Öffentliche Konfiguration für Datenschutzerklärung und Statusseite
router.get('/', (req, res) => {
  res.json({
    werkstattName: process.env.WERKSTATT_NAME || 'Ihre Werkstatt',
    werkstattStrasse: process.env.WERKSTATT_STRASSE || '',
    werkstattOrt: process.env.WERKSTATT_ORT || '',
    werkstattEmail: process.env.WERKSTATT_EMAIL_KONTAKT || '',
    werkstattTelefon: process.env.WERKSTATT_TELEFON || '',
    loeschungNachTagen: parseInt(process.env.LOESCHUNG_NACH_TAGEN || '30', 10),
    emailEnabled: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
  });
});

module.exports = router;
