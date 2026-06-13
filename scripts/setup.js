#!/usr/bin/env node
require('dotenv').config();
const bcrypt = require('bcrypt');
const readline = require('readline');
const db = require('../src/database');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function main() {
  console.log('\n=== Werkstatt Abholsystem - Ersteinrichtung ===\n');

  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existingUsers.count > 0) {
    const overwrite = await ask('Es existieren bereits Benutzer. Neuen Benutzer hinzufügen? (j/N): ');
    if (overwrite.toLowerCase() !== 'j') {
      console.log('Abgebrochen.');
      rl.close();
      return;
    }
  }

  const username = await ask('Benutzername (Standard: admin): ') || 'admin';
  const password = await ask('Passwort (min. 8 Zeichen): ');

  if (password.length < 8) {
    console.error('Fehler: Passwort muss mindestens 8 Zeichen haben.');
    rl.close();
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  try {
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
    console.log(`\nBenutzer "${username}" erfolgreich angelegt!`);
    console.log(`\nSystem starten mit: npm start`);
    console.log(`Login unter: ${process.env.BASE_URL || 'http://localhost:3000'}/login\n`);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      console.error(`Fehler: Benutzername "${username}" existiert bereits.`);
    } else {
      console.error('Fehler:', e.message);
    }
    process.exit(1);
  }

  rl.close();
}

main().catch(console.error);
