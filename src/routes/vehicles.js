const express = require('express');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const crypto = require('crypto');
const db = require('../database');
const { requireAuth } = require('../middleware/auth');
const { sendFertigNotification } = require('../mailer');

const router = express.Router();

function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

async function generateQRCode(token) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const url = `${baseUrl}/status/${token}`;
  return QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    color: { dark: '#1a1a2e', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}

function sanitizeEmail(email) {
  if (!email || !email.trim()) return null;
  const e = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

router.get('/', requireAuth, (req, res) => {
  const vehicles = db.prepare(`
    SELECT id, kennzeichen, fahrzeug, status, annahme_datum, abhol_datum,
           fertig_datum, abgeholt_datum, notizen, kunde_email, updated_at
    FROM vehicles
    ORDER BY
      CASE status
        WHEN 'fertig' THEN 1
        WHEN 'wartet_auf_teile' THEN 2
        WHEN 'in_bearbeitung' THEN 3
        WHEN 'angenommen' THEN 4
        WHEN 'abgeholt' THEN 5
      END,
      updated_at DESC
  `).all();
  res.json(vehicles);
});

router.post('/', requireAuth, async (req, res) => {
  const { kennzeichen, fahrzeug, notizen, email } = req.body;
  if (!kennzeichen?.trim() || !fahrzeug?.trim()) {
    return res.status(400).json({ error: 'Kennzeichen und Fahrzeugbezeichnung erforderlich' });
  }

  const id = uuidv4();
  const token = generateToken();
  const kunde_email = sanitizeEmail(email);

  db.prepare(`
    INSERT INTO vehicles (id, token, kennzeichen, fahrzeug, notizen, kunde_email)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, token, kennzeichen.trim().toUpperCase(), fahrzeug.trim(), notizen?.trim() || null, kunde_email);

  const qrCode = await generateQRCode(token);
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  res.status(201).json({
    id,
    qrCode,
    statusUrl: `${baseUrl}/status/${token}`,
    kennzeichen: kennzeichen.trim().toUpperCase(),
    fahrzeug: fahrzeug.trim(),
    emailSet: !!kunde_email,
  });
});

router.get('/:id/qr', requireAuth, async (req, res) => {
  const vehicle = db.prepare('SELECT token FROM vehicles WHERE id = ?').get(req.params.id);
  if (!vehicle) return res.status(404).json({ error: 'Fahrzeug nicht gefunden' });

  const qrCode = await generateQRCode(vehicle.token);
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  res.json({ qrCode, statusUrl: `${baseUrl}/status/${vehicle.token}` });
});

router.patch('/:id', requireAuth, async (req, res) => {
  const { status, abhol_datum, notizen, email } = req.body;
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
  if (!vehicle) return res.status(404).json({ error: 'Fahrzeug nicht gefunden' });

  const validStatus = ['angenommen', 'in_bearbeitung', 'wartet_auf_teile', 'fertig', 'abgeholt'];
  if (status && !validStatus.includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status' });
  }

  const newStatus = status || vehicle.status;
  const now = new Date().toISOString();
  const wasNotFertig = vehicle.status !== 'fertig';

  let fertig_datum = vehicle.fertig_datum;
  let abgeholt_datum = vehicle.abgeholt_datum;

  if (status === 'fertig' && !vehicle.fertig_datum) fertig_datum = now;
  if (status === 'abgeholt' && !vehicle.abgeholt_datum) abgeholt_datum = now;
  if (status !== 'fertig' && status !== 'abgeholt') {
    fertig_datum = null;
    abgeholt_datum = null;
  }

  const newEmail = email !== undefined ? sanitizeEmail(email) : vehicle.kunde_email;

  db.prepare(`
    UPDATE vehicles SET
      status = ?, abhol_datum = ?, notizen = ?,
      fertig_datum = ?, abgeholt_datum = ?,
      kunde_email = ?, updated_at = ?
    WHERE id = ?
  `).run(
    newStatus,
    abhol_datum !== undefined ? (abhol_datum || null) : vehicle.abhol_datum,
    notizen !== undefined ? (notizen?.trim() || null) : vehicle.notizen,
    fertig_datum,
    abgeholt_datum,
    newEmail,
    now,
    req.params.id
  );

  const updated = db.prepare(`
    SELECT id, kennzeichen, fahrzeug, status, annahme_datum, abhol_datum,
           fertig_datum, abgeholt_datum, notizen, kunde_email, updated_at
    FROM vehicles WHERE id = ?
  `).get(req.params.id);

  // E-Mail-Benachrichtigung senden wenn Status auf "fertig" wechselt
  if (newStatus === 'fertig' && wasNotFertig && updated.kunde_email) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const token = db.prepare('SELECT token FROM vehicles WHERE id = ?').get(req.params.id)?.token;
    if (token) {
      sendFertigNotification(updated, `${baseUrl}/status/${token}`)
        .catch(err => console.error('[Mailer] Fehler beim Senden:', err.message));
    }
  }

  res.json(updated);
});

router.delete('/:id', requireAuth, (req, res) => {
  const vehicle = db.prepare('SELECT id FROM vehicles WHERE id = ?').get(req.params.id);
  if (!vehicle) return res.status(404).json({ error: 'Fahrzeug nicht gefunden' });

  db.prepare('DELETE FROM vehicles WHERE id = ?').run(req.params.id);
  res.json({ message: 'Fahrzeug gelöscht' });
});

module.exports = router;
