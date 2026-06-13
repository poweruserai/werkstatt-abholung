const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

async function sendFertigNotification(vehicle, statusUrl) {
  const t = getTransporter();
  if (!t || !vehicle.kunde_email) return;

  const werkstatt = process.env.WERKSTATT_NAME || 'Ihre Werkstatt';
  const abholZeile = vehicle.abhol_datum
    ? `<p><strong>Geplantes Abholdatum:</strong> ${new Date(vehicle.abhol_datum).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>`
    : '';

  const html = `
<!DOCTYPE html>
<html lang="de">
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:24px;border-radius:12px 12px 0 0;text-align:center">
    <h2 style="color:white;margin:0">&#9989; Ihr Fahrzeug ist fertig!</h2>
  </div>
  <div style="background:#f9f9f9;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e0e0e0;border-top:none">
    <p>Guten Tag,</p>
    <p>Ihr Fahrzeug <strong>${vehicle.fahrzeug}</strong> ist fertig bearbeitet und kann jetzt abgeholt werden.</p>
    ${abholZeile}
    <div style="text-align:center;margin:24px 0">
      <a href="${statusUrl}" style="background:#1a1a2e;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
        Status online anzeigen
      </a>
    </div>
    <hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0">
    <p style="font-size:14px;color:#666">
      Mit freundlichen Grüßen<br>
      <strong>${werkstatt}</strong>
    </p>
    <p style="font-size:11px;color:#999;margin-top:16px">
      Diese E-Mail wurde automatisch verschickt. Ihre E-Mail-Adresse wird ausschließlich für diese Benachrichtigung verwendet und nach Abschluss des Auftrags gelöscht.
    </p>
  </div>
</body>
</html>`;

  const text = `Ihr Fahrzeug ist fertig!\n\nFahrzeug: ${vehicle.fahrzeug}\nStatus: Fertig zum Abholen\n${vehicle.abhol_datum ? `Abholdatum: ${vehicle.abhol_datum}\n` : ''}\nStatus online: ${statusUrl}\n\nMit freundlichen Grüßen\n${werkstatt}`;

  await t.sendMail({
    from: `"${werkstatt}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: vehicle.kunde_email,
    subject: `Ihr Fahrzeug ist abholbereit – ${werkstatt}`,
    text,
    html,
  });
}

module.exports = { sendFertigNotification };
