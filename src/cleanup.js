const db = require('./database');

// DSGVO: Abgeholte Fahrzeuge nach X Tagen automatisch löschen
function runCleanup() {
  const tage = parseInt(process.env.LOESCHUNG_NACH_TAGEN || '30', 10);
  const result = db.prepare(`
    DELETE FROM vehicles
    WHERE status = 'abgeholt'
      AND abgeholt_datum IS NOT NULL
      AND abgeholt_datum < datetime('now', '-' || ? || ' days')
  `).run(tage);

  if (result.changes > 0) {
    console.log(`[DSGVO-Cleanup] ${result.changes} Fahrzeug(e) nach ${tage} Tagen gelöscht`);
  }
}

function scheduleCleanup() {
  runCleanup();
  // Täglich um 03:00 Uhr
  const now = new Date();
  const next = new Date();
  next.setHours(3, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const msUntilNext = next - now;

  setTimeout(() => {
    runCleanup();
    setInterval(runCleanup, 24 * 60 * 60 * 1000);
  }, msUntilNext);

  console.log(`[DSGVO-Cleanup] Nächste Bereinigung: ${next.toLocaleString('de-DE')}`);
}

module.exports = { scheduleCleanup };
